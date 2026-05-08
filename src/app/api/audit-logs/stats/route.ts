import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { env } from '@/env'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'
import { requireSuperAdmin } from '@/lib/auth'
import type { ApiResponse } from '@/types'

// GET - Get audit log statistics for dashboard
export async function GET(request: NextRequest) {
  try {
    // Require superadmin role
    const session = await requireSuperAdmin(request)

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30') // Default: last 30 days

    const connection = await pool.getConnection()
    try {
      // Build date filter based on database type
      const dbType = isPostgres ? 'postgresql' : 'mysql'
      let dateFilter: string
      let dateParams: any[] = []
      
      if (dbType === 'postgresql') {
        dateFilter = `created_at >= NOW() - INTERVAL '${days} days'`
      } else {
        dateFilter = `created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`
        dateParams = [days]
      }

      // Get action counts (top actions)
      const actionCountsQuery = `SELECT action, COUNT(*) as count
         FROM audit_logs
         WHERE ${dateFilter}
         GROUP BY action
         ORDER BY count DESC
         LIMIT 10`
      const [actionCounts]: any = await connection.execute(actionCountsQuery, dateParams)

      // Get resource type counts
      const resourceTypeCountsQuery = `SELECT resource_type, COUNT(*) as count
         FROM audit_logs
         WHERE ${dateFilter}
         GROUP BY resource_type
         ORDER BY count DESC`
      const [resourceTypeCounts]: any = await connection.execute(resourceTypeCountsQuery, dateParams)

      // Get daily activity (last 30 days)
      const dateFunc = dbType === 'postgresql' ? 'DATE(created_at)' : 'DATE(created_at)'
      const dailyActivityQuery = `SELECT 
           ${dateFunc} as date,
           COUNT(*) as count
         FROM audit_logs
         WHERE ${dateFilter}
         GROUP BY ${dateFunc}
         ORDER BY date DESC`
      const [dailyActivity]: any = await connection.execute(dailyActivityQuery, dateParams)

      // Get top users by activity
      const topUsersQuery = `SELECT username, COUNT(*) as count
         FROM audit_logs
         WHERE ${dateFilter}
           AND username IS NOT NULL
         GROUP BY username
         ORDER BY count DESC
         LIMIT 10`
      const [topUsers]: any = await connection.execute(topUsersQuery, dateParams)

      // Get total count
      const totalQuery = `SELECT COUNT(*) as total
         FROM audit_logs
         WHERE ${dateFilter}`
      const [totalResult]: any = await connection.execute(totalQuery, dateParams)

      const total = totalResult[0]?.total || 0

      return NextResponse.json({
        success: true,
        data: {
          total,
          actionCounts: actionCounts || [],
          resourceTypeCounts: resourceTypeCounts || [],
          dailyActivity: dailyActivity || [],
          topUsers: topUsers || [],
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

    console.error('Error fetching audit log statistics:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching audit log statistics: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}
