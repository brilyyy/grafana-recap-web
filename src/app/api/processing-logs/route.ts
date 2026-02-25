import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { env } from '@/env'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'
import { requireSuperAdmin } from '@/lib/auth'
import type { ApiResponse } from '@/types'

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
}

// GET - Fetch processing logs by app name, month, and year
export async function GET(request: NextRequest) {
  try {
    const session = await requireSuperAdmin(request)

    const { searchParams } = new URL(request.url)
    const appName = searchParams.get('app_name')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    if (!appName || !month || !year) {
      return NextResponse.json(
        {
          success: false,
          message: 'app_name, month, and year are required',
        } as ApiResponse,
        { status: 400 }
      )
    }

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
      // Build query to get all processing logs for the specified month and year
      // We'll filter by app_name and date range (first day to last day of the month)
      const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
      const dbType = isPostgres ? 'postgresql' : 'mysql'
      
      // Calculate last day of month
      const lastDay = new Date(yearNum, monthNum, 0).getDate()
      const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      // Get latest log entry for each processing_date
      // Using window function to get the most recent entry per date
      let query: string
      if (dbType === 'postgresql') {
        query = `
          SELECT DISTINCT ON (processing_date)
            id,
            app_name,
            TO_CHAR(processing_date, 'YYYY-MM-DD') as processing_date,
            status,
            records_processed,
            records_inserted,
            start_time,
            end_time,
            error_message
          FROM app_processing_log
          WHERE app_name = $1
            AND processing_date >= $2::date
            AND processing_date <= $3::date
          ORDER BY processing_date DESC, created_at DESC
        `
      } else {
        // MySQL: Use subquery to get latest entry per date
        query = `
          SELECT 
            l1.id,
            l1.app_name,
            DATE_FORMAT(l1.processing_date, '%Y-%m-%d') as processing_date,
            l1.status,
            l1.records_processed,
            l1.records_inserted,
            l1.start_time,
            l1.end_time,
            l1.error_message
          FROM app_processing_log l1
          INNER JOIN (
            SELECT processing_date, MAX(created_at) as max_created_at
            FROM app_processing_log
            WHERE app_name = ?
              AND processing_date >= ?
              AND processing_date <= ?
            GROUP BY processing_date
          ) l2 ON l1.processing_date = l2.processing_date 
            AND l1.created_at = l2.max_created_at
          WHERE l1.app_name = ?
            AND l1.processing_date >= ?
            AND l1.processing_date <= ?
          ORDER BY l1.processing_date DESC
        `
      }

      const [logs]: any = dbType === 'postgresql'
        ? await connection.execute(query, [appName, startDate, endDate])
        : await connection.execute(query, [appName, startDate, endDate, appName, startDate, endDate])

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
