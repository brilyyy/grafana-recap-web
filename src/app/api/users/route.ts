import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth'
import type { ApiResponse } from '@/types'

export interface User {
  id: number
  username: string
  email: string
  role: 'superadmin' | 'admin' | 'user'
  created_at: Date
  updated_at: Date
}

// GET - Fetch all users
export async function GET(request: NextRequest) {
  try {
    // Require superadmin role
    const session = requireSuperAdmin(request)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const fetchAll = !searchParams.has('page') && !searchParams.has('limit')

    const connection = await pool.getConnection()
    try {
      // Build query with filters
      let query = `
        SELECT 
          id,
          username,
          email,
          role,
          created_at,
          updated_at
        FROM users
        WHERE 1=1
      `

      const params: any[] = []

      // Filter by role
      if (role && ['superadmin', 'admin', 'user'].includes(role)) {
        query += ' AND role = ?'
        params.push(role)
      }

      // Search filter
      if (search) {
        query += ' AND (username LIKE ? OR email LIKE ?)'
        const searchPattern = `%${search}%`
        params.push(searchPattern, searchPattern)
      }

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM users WHERE 1=1`
      const countParams: any[] = []

      if (role && ['superadmin', 'admin', 'user'].includes(role)) {
        countQuery += ' AND role = ?'
        countParams.push(role)
      }

      if (search) {
        countQuery += ' AND (username LIKE ? OR email LIKE ?)'
        const searchPattern = `%${search}%`
        countParams.push(searchPattern, searchPattern)
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
        data: rows as User[],
        total: total,
        page: fetchAll ? 1 : page,
        limit: fetchAll ? total : limit,
        totalPages: fetchAll ? 1 : Math.ceil(total / limit),
      } as ApiResponse<User[]> & { total: number; page: number; limit: number; totalPages: number })
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

    console.error('Error fetching users:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching users: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}
