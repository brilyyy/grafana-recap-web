import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth'
import type { ApiResponse } from '@/types'

export interface AuditLogEntry {
  id: number
  user_id: number | null
  username: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: Date
}

// GET - Fetch audit logs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    // Require superadmin role
    const session = requireSuperAdmin(request)

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || ''
    const resourceType = searchParams.get('resource_type') || ''
    const username = searchParams.get('username') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const fetchAll = !searchParams.has('page') && !searchParams.has('limit')

    const connection = await pool.getConnection()
    try {
      // Build query with filters
      let query = `
        SELECT 
          id,
          user_id,
          username,
          action,
          resource_type,
          resource_id,
          details,
          ip_address,
          user_agent,
          created_at
        FROM audit_logs
        WHERE 1=1
      `

      const params: any[] = []

      // Filter by action
      if (action) {
        query += ' AND action = ?'
        params.push(action)
      }

      // Filter by resource_type
      if (resourceType) {
        query += ' AND resource_type = ?'
        params.push(resourceType)
      }

      // Filter by username
      if (username) {
        query += ' AND username LIKE ?'
        params.push(`%${username}%`)
      }

      // Filter by date range
      if (startDate) {
        query += ' AND created_at >= ?'
        params.push(startDate)
      }

      if (endDate) {
        query += ' AND created_at <= ?'
        params.push(endDate)
      }

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1`
      const countParams: any[] = []

      if (action) {
        countQuery += ' AND action = ?'
        countParams.push(action)
      }

      if (resourceType) {
        countQuery += ' AND resource_type = ?'
        countParams.push(resourceType)
      }

      if (username) {
        countQuery += ' AND username LIKE ?'
        countParams.push(`%${username}%`)
      }

      if (startDate) {
        countQuery += ' AND created_at >= ?'
        countParams.push(startDate)
      }

      if (endDate) {
        countQuery += ' AND created_at <= ?'
        countParams.push(endDate)
      }

      const [countResult]: any = await connection.execute(countQuery, countParams)
      const total = countResult[0]?.total || 0

      // Order by created_at DESC
      query += ' ORDER BY created_at DESC'

      // Apply pagination if not fetching all
      if (!fetchAll && limit > 0) {
        const offset = (page - 1) * limit
        query += ` LIMIT ${limit} OFFSET ${offset}`
      }

      const [rows]: any = await connection.execute(query, params)

      return NextResponse.json({
        success: true,
        data: rows as AuditLogEntry[],
        total: total,
        page: fetchAll ? 1 : page,
        limit: fetchAll ? total : limit,
        totalPages: fetchAll ? 1 : Math.ceil(total / limit),
      } as ApiResponse<AuditLogEntry[]> & { total: number; page: number; limit: number; totalPages: number })
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

    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching audit logs: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}
