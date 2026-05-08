import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { requireSuperAdmin, hashPassword } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import { env } from '@/env'
import type { ApiResponse } from '@/types'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

function isDuplicateError(error: any): boolean {
  return error?.code === 'ER_DUP_ENTRY' || error?.code === 1062 || error?.code === '23505'
}

/**
 * Approve a pending user request (superadmin only)
 * Superadmin can assign any role (superadmin/admin/user)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require superadmin role
    const session = await requireSuperAdmin(request)

    const { id } = await params
    const requestId = parseInt(id)
    if (isNaN(requestId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request ID',
        } as ApiResponse,
        { status: 400 }
      )
    }

    const body = await request.json()
    const { approvedRole } = body

    // Validate approvedRole
    if (!approvedRole || !['superadmin', 'admin', 'user'].includes(approvedRole)) {
      return NextResponse.json(
        {
          success: false,
          message: 'approvedRole must be one of: superadmin, admin, user',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Get the pending request
    const [requests]: any = await pool.execute(
      'SELECT * FROM pending_user_requests WHERE id = ? AND status = ?',
      [requestId, 'pending']
    )

    if (requests.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Pending request not found or already processed',
        } as ApiResponse,
        { status: 404 }
      )
    }

    const pendingRequest = requests[0]

    // Start transaction
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Create user with approved role
      const insertSql = isPostgres
        ? 'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id'
        : 'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
      const [userRows] = await connection.execute(insertSql,
        [pendingRequest.username, pendingRequest.email, pendingRequest.password_hash, approvedRole]
      )
      const userId = isPostgres
        ? (userRows[0] as any)?.id
        : (userRows[0] as any)?.insertId ?? 0

      // Update pending request status
      await connection.execute(
        `UPDATE pending_user_requests 
         SET status = 'approved', 
             approved_role = ?, 
             approved_by = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [approvedRole, session.userId, requestId]
      )

      // Commit transaction
      await connection.commit()

      // Log the action
      await logAuditEvent(
        session.userId,
        session.username,
        'USER_REQUEST_APPROVED',
        'pending_user_request',
        requestId.toString(),
        `Approved user request: ${pendingRequest.username} with role: ${approvedRole}`,
        getClientIp(request),
        getUserAgent(request)
      )

      return NextResponse.json({
        success: true,
        message: `User request approved. User "${pendingRequest.username}" created with role "${approvedRole}"`,
        data: {
          userId,
          username: pendingRequest.username,
          email: pendingRequest.email,
          role: approvedRole,
        },
      } as ApiResponse)
    } catch (error: any) {
      // Rollback transaction
      await connection.rollback()

      if (isDuplicateError(error)) {
        const field = error.message?.includes('username') ? 'username' : 'email'
        return NextResponse.json(
          {
            success: false,
            message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
          } as ApiResponse,
          { status: 400 }
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

    console.error('Approve user request error:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
}
