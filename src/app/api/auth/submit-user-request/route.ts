import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { hashPassword, getSession } from '@/lib/auth'
import type { ApiResponse } from '@/types'

/**
 * Submit a user registration request (creates pending request, not actual user)
 * Anyone can submit a request, but it needs superadmin approval
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, password, requestedRole = 'user' } = body

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

    // Validate requestedRole
    if (!['admin', 'user'].includes(requestedRole)) {
      return NextResponse.json(
        {
          success: false,
          message: 'requestedRole must be either "admin" or "user"',
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

    // Check if username or email already exists in users table
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

    // Check if username or email already exists in pending_user_requests table
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

    // Hash password
    const passwordHash = await hashPassword(password)

    // Get current user session if exists (for requested_by field)
    const session = getSession(request)
    const requestedById = session?.userId || null

    // Insert pending request
    await pool.execute(
      `INSERT INTO pending_user_requests 
       (username, email, password_hash, requested_role, requested_by, status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [username, email, passwordHash, requestedRole, requestedById]
    )

    return NextResponse.json({
      success: true,
      message: 'Registration request submitted successfully. Please wait for superadmin approval.',
      data: {
        username,
        email,
        requestedRole,
      },
    } as ApiResponse)
  } catch (error: any) {
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

    console.error('Submit user request error:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
}
