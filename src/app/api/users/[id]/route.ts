import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'

// PATCH - Update user role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require superadmin role
    const session = await requireSuperAdmin(request)

    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid user ID',
        } as ApiResponse,
        { status: 400 }
      )
    }

    const body = await request.json()
    const { role } = body

    // Validate role
    if (!role || !['superadmin', 'admin', 'user'].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Valid role (superadmin, admin, or user) is required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Prevent superadmin from changing their own role
    if (userId === session.userId && role !== 'superadmin') {
      return NextResponse.json(
        {
          success: false,
          message: 'You cannot change your own role',
        } as ApiResponse,
        { status: 400 }
      )
    }

    const connection = await pool.getConnection()
    try {
      // Get current user data
      const [userResult]: any = await connection.execute(
        'SELECT id, username, email, role FROM users WHERE id = ?',
        [userId]
      )

      if (userResult.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'User not found',
          } as ApiResponse,
          { status: 404 }
        )
      }

      const user = userResult[0]
      const oldRole = user.role

      // If role is the same, no need to update
      if (oldRole === role) {
        return NextResponse.json({
          success: true,
          message: 'User role is already set to this value',
          data: {
            id: userId,
            role: role,
          },
        } as ApiResponse)
      }

      // Update user role
      await connection.execute(
        'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [role, userId]
      )

      // Log audit event
      await logAuditEvent(
        session.userId,
        session.username,
        'USER_ROLE_UPDATED',
        'users',
        userId.toString(),
        `Updated user role for ${user.username} (id: ${userId}): "${oldRole}" → "${role}"`,
        getClientIp(request),
        getUserAgent(request)
      )

      return NextResponse.json({
        success: true,
        message: `User role updated successfully. ${user.username} role changed from "${oldRole}" to "${role}"`,
        data: {
          id: userId,
          username: user.username,
          email: user.email,
          role: role,
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

    console.error('Error updating user role:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error updating user role: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}
