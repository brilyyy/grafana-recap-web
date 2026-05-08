import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { env } from '@/env'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'
import { requireSuperAdmin } from '@/lib/auth'
import type { ApiResponse } from '@/types'
import { catalogEntryToLogFilter, getCatalogEntryById } from '@/domain/recap/catalog'

interface ProcessingLog {
  id: number
  app_name: string
  processing_date: string
  status: 'running' | 'success' | 'failed'
  records_processed: number
  records_inserted: number
  start_time: string
  end_time: string | null
  error_message: string | null
  recap_kind: string
  catalog_entry_id: string | null
}

// GET - Fetch processing logs by job (catalog_entry_id), month, and year
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request)

    const { searchParams } = new URL(request.url)
    const catalogEntryId = searchParams.get('catalog_entry_id')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    if (!catalogEntryId || !month || !year) {
      return NextResponse.json(
        {
          success: false,
          message: 'catalog_entry_id, month, and year are required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    const entry = getCatalogEntryById(catalogEntryId)
    if (!entry) {
      return NextResponse.json(
        {
          success: false,
          message: `Unknown catalog_entry_id: ${catalogEntryId}`,
        } as ApiResponse,
        { status: 400 }
      )
    }
    const logFilter = catalogEntryToLogFilter(entry)

    // Validate month (1-12)
    const monthNum = parseInt(month)
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid month. Must be between 1 and 12',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate year
    const yearNum = parseInt(year)
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid year',
        } as ApiResponse,
        { status: 400 }
      )
    }

    const connection = await pool.getConnection()
    try {
      // Build query to get the latest processing log for each date of one job.
      const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
      const dbType = isPostgres ? 'postgresql' : 'mysql'
      
      // Calculate last day of month
      const lastDay = new Date(yearNum, monthNum, 0).getDate()
      const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      // Get latest log entry for each processing_date
      let query: string
      if (dbType === 'postgresql') {
        query = `
          SELECT DISTINCT ON (processing_date)
            id,
            app_name,
            catalog_entry_id,
            TO_CHAR(processing_date, 'YYYY-MM-DD') as processing_date,
            status,
            records_processed,
            records_inserted,
            start_time,
            end_time,
            error_message,
            COALESCE(recap_kind, 'success_rate_daily') as recap_kind
          FROM app_processing_log
          WHERE processing_date >= $1::date
            AND processing_date <= $2::date
            AND (
              catalog_entry_id = $3
              OR (
                catalog_entry_id IS NULL
                AND app_name = $4
                AND COALESCE(recap_kind, 'success_rate_daily') = $5
              )
            )
          ORDER BY processing_date DESC, created_at DESC
        `
      } else {
        // MySQL: Use subquery to get latest entry per date
        query = `
          SELECT 
            l1.id,
            l1.app_name,
            l1.catalog_entry_id,
            DATE_FORMAT(l1.processing_date, '%Y-%m-%d') as processing_date,
            l1.status,
            l1.records_processed,
            l1.records_inserted,
            l1.start_time,
            l1.end_time,
            l1.error_message,
            COALESCE(l1.recap_kind, 'success_rate_daily') as recap_kind
          FROM app_processing_log l1
          INNER JOIN (
            SELECT processing_date, MAX(created_at) as max_created_at
            FROM app_processing_log
            WHERE processing_date >= ?
              AND processing_date <= ?
              AND (
                catalog_entry_id = ?
                OR (
                  catalog_entry_id IS NULL
                  AND app_name = ?
                  AND COALESCE(recap_kind, 'success_rate_daily') = ?
                )
              )
            GROUP BY processing_date
          ) l2 ON l1.processing_date = l2.processing_date 
            AND l1.created_at = l2.max_created_at
          WHERE l1.processing_date >= ?
            AND l1.processing_date <= ?
            AND (
              l1.catalog_entry_id = ?
              OR (
                l1.catalog_entry_id IS NULL
                AND l1.app_name = ?
                AND COALESCE(l1.recap_kind, 'success_rate_daily') = ?
              )
            )
          ORDER BY l1.processing_date DESC
        `
      }

      const [logs]: any = dbType === 'postgresql'
        ? await connection.execute(query, [
            startDate,
            endDate,
            logFilter.catalogEntryId,
            logFilter.appName,
            logFilter.recapKind,
          ])
        : await connection.execute(query, [
            startDate,
            endDate,
            logFilter.catalogEntryId,
            logFilter.appName,
            logFilter.recapKind,
            startDate,
            endDate,
            logFilter.catalogEntryId,
            logFilter.appName,
            logFilter.recapKind,
          ])

      const normalizedLogs = (logs || []).map((log: any) => {
        let processingDateStr: string
        if (log.processing_date instanceof Date) {
          const year = log.processing_date.getFullYear()
          const month = String(log.processing_date.getMonth() + 1).padStart(2, '0')
          const day = String(log.processing_date.getDate()).padStart(2, '0')
          processingDateStr = `${year}-${month}-${day}`
        } else if (typeof log.processing_date === 'string') {
          processingDateStr = log.processing_date.split('T')[0]
        } else {
          processingDateStr = log.processing_date
        }
        
        return {
          ...log,
          processing_date: processingDateStr,
        }
      })

      return NextResponse.json({
        success: true,
        data: normalizedLogs as ProcessingLog[],
      } as ApiResponse<ProcessingLog[]>)
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

    console.error('Error fetching processing logs:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching processing logs: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}
