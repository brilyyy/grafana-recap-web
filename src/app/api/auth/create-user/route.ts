import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { hashPassword, requireAuth, isSuperAdmin } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'

/**
 * Create a new user
 * - Superadmin: Can create user directly
 * - Admin/Others: Creates pending request that needs superadmin approval
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = requireAuth(request)
    const isSuperAdminUser = isSuperAdmin(session.role)

    const body = await request.json()
    const { username, email, password, role = 'user' } = body

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Username, email, and password are required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate role
    // Superadmin can assign any role, others can only request admin or user
    const validRoles = isSuperAdminUser 
      ? ['superadmin', 'admin', 'user'] 
      : ['admin', 'user']
    
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message: `Role must be one of: ${validRoles.join(', ')}`,
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: 'Password must be at least 8 characters long',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid email format',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // If not superadmin, create pending request instead
    if (!isSuperAdminUser) {
      // Check if username or email already exists
      const [existingUsers]: any = await pool.execute(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
      )

      if (existingUsers.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'Username or email already exists',
          } as ApiResponse,
          { status: 400 }
        )
      }

      // Check if pending request already exists
      const [existingRequests]: any = await pool.execute(
        'SELECT id FROM pending_user_requests WHERE username = ? OR email = ?',
        [username, email]
      )

      if (existingRequests.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'A registration request with this username or email is already pending',
          } as ApiResponse,
          { status: 400 }
        )
      }

      // Create pending request
      await pool.execute(
        `INSERT INTO pending_user_requests 
         (username, email, password_hash, requested_role, requested_by, status) 
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [username, email, passwordHash, role, session.userId]
      )

      return NextResponse.json({
        success: true,
        message: `User request submitted successfully. Superadmin approval required before user can login.`,
        data: {
          username,
          email,
          requestedRole: role,
          status: 'pending',
        },
      } as ApiResponse)
    }

    // Superadmin can create user directly
    // Check if username or email already exists
    const [existingUsers]: any = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    )

    if (existingUsers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Username or email already exists',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Insert user directly
    const [result]: any = await pool.execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, role]
    )

    // Log the action
    await logAuditEvent(
      session.userId,
      session.username,
      'USER_CREATED',
      'user',
      result.insertId.toString(),
      `Created ${role} user: ${username}`,
      getClientIp(request),
      getUserAgent(request)
    )

    return NextResponse.json({
      success: true,
      message: `User "${username}" created successfully`,
      data: {
        userId: result.insertId,
        username,
        email,
        role,
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
        { status: 401 }
      )
    }

    // Handle duplicate entry
    if (error.code === 'ER_DUP_ENTRY') {
      const field = error.message.includes('username') ? 'username' : 'email'
      return NextResponse.json(
        {
          success: false,
          message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        } as ApiResponse,
        { status: 400 }
      )
    }

    console.error('Create user error:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
}
