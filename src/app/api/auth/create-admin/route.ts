import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import type { ApiResponse } from '@/types'

function isDuplicateError(error: any): boolean {
  return error?.code === 'ER_DUP_ENTRY' || error?.code === 1062 || error?.code === '23505'
}

/**
 * Create admin user (first-time setup only)
 * If admin already exists, creates pending request instead
 * For production, this should be done via migration script
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, password } = body

    if (!username || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Username, email, and password are required',
        } as ApiResponse,
        { status: 400 }
      )
    }

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

    // Check if admin already exists
    const [admins]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin' OR role = 'superadmin'"
    )

    const passwordHash = await hashPassword(password)

    // If admin/superadmin already exists, create pending request instead
    if (admins[0].count > 0) {
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
         VALUES (?, ?, ?, ?, NULL, 'pending')`,
        [username, email, passwordHash, 'admin']
      )

      return NextResponse.json({
        success: true,
        message: 'Admin registration request submitted successfully. Please wait for superadmin approval.',
        data: {
          username,
          email,
          requestedRole: 'admin',
          status: 'pending',
        },
      } as ApiResponse)
    }

    // No admin exists yet - create admin directly (first-time setup)
    await pool.execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, 'admin']
    )

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully (first-time setup)',
    } as ApiResponse)
  } catch (error: any) {
    if (isDuplicateError(error)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Username or email already exists',
        } as ApiResponse,
        { status: 400 }
      )
    }

    console.error('Create admin error:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
}
