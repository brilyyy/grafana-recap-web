import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'

/**
 * Manual trigger endpoint for BALE processing
 * POST /api/bale/process-manual?date=YYYY-MM-DD
 * 
 * If date parameter is not provided, processes H-1 (yesterday)
 */
export async function POST(request: NextRequest) {
  try {
    const session = requireAuth(request)
    
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

    // Get optional date parameter
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    
    let processingDate: Date | null = null
    
    if (dateParam) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(dateParam)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD format',
          } as ApiResponse,
          { status: 400 }
        )
      }
      
      processingDate = new Date(dateParam)
      if (isNaN(processingDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid date value',
          } as ApiResponse,
          { status: 400 }
        )
      }
    }

    const connection = await pool.getConnection()
    try {
      const adapter = await import('@/lib/db').then(m => m.adapter)
      const isPostgres = adapter.getDatabaseType() === 'postgresql'

      const dateParamForDB = processingDate 
        ? processingDate.toISOString().split('T')[0]
        : null

      if (isPostgres) {
        await connection.execute('SELECT sp_process_bale_daily($1)', [dateParamForDB])
      } else {
        await connection.execute('CALL sp_process_bale_daily(?)', [dateParamForDB])
      }

      // Get the latest processing log entry
      const [logResult]: any = await connection.execute(
        `SELECT * FROM app_processing_log 
         WHERE app_name = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        ['Bale']
      )

      const logEntry = logResult[0]

      // Log audit event
      await logAuditEvent(
        session.userId,
        session.username,
        'BALE_PROCESSING_MANUAL_TRIGGER',
        'app_processing_log',
        logEntry?.id?.toString() || 'unknown',
        `Manually triggered BALE processing${processingDate ? ` for date ${dateParam}` : ' (H-1)'}. Status: ${logEntry?.status || 'unknown'}`,
        getClientIp(request),
        getUserAgent(request)
      )

      return NextResponse.json({
        success: true,
        message: `BALE processing triggered successfully${processingDate ? ` for date ${dateParam}` : ' (H-1)'}`,
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
    
    console.error('Error triggering BALE processing:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error triggering BALE processing: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}
