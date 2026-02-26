import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { env } from '@/env'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'

/**
 * Generic manual trigger endpoint for application processing
 * POST /api/processing/process-manual
 * Body: { app_name: string, date?: string }
 * 
 * If date parameter is not provided, processes H-1 (yesterday)
 * Date must be < current date (only H-1 and earlier can be processed)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    
    // Check if user has superadmin role
    if (session.role !== 'superadmin') {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized: Only superadmin can trigger manual processing',
        } as ApiResponse,
        { status: 403 }
      )
    }

    const body = await request.json()
    const { app_name, date } = body

    if (!app_name || !app_name.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'app_name is required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    let processingDate: Date | null = null
    let dateParam: string | null = null
    
    if (date) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(date)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD format',
          } as ApiResponse,
          { status: 400 }
        )
      }
      
      // Use date string directly to avoid timezone conversion issues
      // Date format is already YYYY-MM-DD, use it as-is
      dateParam = date
      
      // Validate date format and create Date object for validation only
      processingDate = new Date(date + 'T00:00:00')
      if (isNaN(processingDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid date value',
          } as ApiResponse,
          { status: 400 }
        )
      }

      // Validate: date must be < current date (only H-1 and earlier can be processed)
      // Compare date strings directly (YYYY-MM-DD format) to avoid timezone issues
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      
      if (date >= todayStr) {
        return NextResponse.json(
          {
            success: false,
            message: 'Cannot process future dates. Only H-1 (yesterday) and earlier dates can be processed.',
          } as ApiResponse,
          { status: 400 }
        )
      }
    }

    const connection = await pool.getConnection()
    try {
      const dbType = isPostgres ? 'postgresql' : 'mysql'
      const appNameLower = app_name.toLowerCase().trim()
      
      // Build stored procedure name: sp_process_{app_name}_daily
      const procedureName = `sp_process_${appNameLower}_daily`
      
      // Prepare date parameter for database - use date string directly (YYYY-MM-DD)
      // This avoids timezone conversion issues
      let dateParamForDB = dateParam || null

      // Call stored procedure based on database type
      // For PostgreSQL: use public. prefix (schema) and $1::date cast so the function is found
      // and parameter type matches (avoids "function does not exist" when param is inferred as unknown/text)
      if (dbType === 'postgresql') {
        await connection.execute(`SELECT public.${procedureName}($1::date)`, [dateParamForDB])
      } else {
        await connection.execute(`CALL ${procedureName}(?)`, [dateParamForDB])
      }

      // Get the processing log entry for the specific date that was just processed
      // Use the processing_date if provided, otherwise use H-1 (yesterday)
      let targetDate: string
      if (dateParamForDB) {
        targetDate = dateParamForDB
      } else {
        // Calculate H-1 (yesterday) using date string to avoid timezone issues
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        // Get local date string (YYYY-MM-DD) without timezone conversion
        const year = yesterday.getFullYear()
        const month = String(yesterday.getMonth() + 1).padStart(2, '0')
        const day = String(yesterday.getDate()).padStart(2, '0')
        targetDate = `${year}-${month}-${day}`
      }

      const [logResult]: any = await connection.execute(
        `SELECT * FROM app_processing_log 
         WHERE app_name = ? 
           AND processing_date = ?
         ORDER BY created_at DESC 
         LIMIT 1`,
        [app_name.trim(), targetDate]
      )

      const logEntry = logResult[0]

      // Log audit event
      await logAuditEvent(
        session.userId,
        session.username,
        `${app_name.toUpperCase()}_PROCESSING_MANUAL_TRIGGER`,
        'app_processing_log',
        logEntry?.id?.toString() || 'unknown',
        `Manually triggered ${app_name} processing${processingDate ? ` for date ${dateParam}` : ' (H-1)'}. Status: ${logEntry?.status || 'unknown'}`,
        getClientIp(request),
        getUserAgent(request)
      )

      return NextResponse.json({
        success: true,
        message: `${app_name} processing triggered successfully${processingDate ? ` for date ${dateParam}` : ' (H-1)'}`,
        data: {
          processingDate: processingDate ? dateParam : 'H-1 (yesterday)',
          logEntry: logEntry ? {
            id: logEntry.id,
            status: logEntry.status,
            recordsProcessed: logEntry.records_processed,
            recordsInserted: logEntry.records_inserted,
            startTime: logEntry.start_time,
            endTime: logEntry.end_time,
            errorMessage: logEntry.error_message,
          } : null,
        },
      } as ApiResponse)
    } catch (error: any) {
      const errMsg = error.message ?? String(error)
      // Relation missing (e.g. raw_bale) – procedure runs but table doesn't exist
      if (errMsg.includes('relation') && errMsg.includes('does not exist')) {
        console.error('[process-manual] Missing table:', errMsg)
        return NextResponse.json(
          {
            success: false,
            message: 'raw_bale table does not exist in the database. Ensure the raw_bale table exists (typically created by CDC).',
            detail: errMsg,
          } as ApiResponse,
          { status: 404 }
        )
      }
      // Procedure/function not found
      if (errMsg.includes('does not exist') || errMsg.includes('PROCEDURE') || errMsg.includes('function')) {
        console.error('[process-manual] Procedure call failed:', errMsg)
        return NextResponse.json(
          {
            success: false,
            message: `Processing procedure not found for application: ${app_name}. Please ensure the stored procedure exists.`,
            detail: errMsg,
          } as ApiResponse,
          { status: 404 }
        )
      }

      throw error
    } finally {
      connection.release()
    }
  } catch (error: any) {
    // Handle authentication errors
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        } as ApiResponse,
        { status: 403 }
      )
    }
    
    console.error('Error triggering processing:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error triggering processing: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}
