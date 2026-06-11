import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { env } from '@/env'
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

    const dateParamForDB = processingDate ? processingDate.toISOString().split('T')[0] : null
    await db.execute(sql`SELECT public.sp_process_bale_daily(${dateParamForDB}::date)`)

    // Get the latest processing log entry
    const logResult = await db.execute(sql`
      SELECT * FROM app_processing_log
      WHERE app_name = 'Bale'
      ORDER BY created_at DESC
      LIMIT 1
    `)
    const logEntry = logResult.rows[0] as any

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
