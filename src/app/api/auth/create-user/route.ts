import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'

/**
 * Create a new user (admin only)
 * Requires admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin role
    const session = requireRole(request, 'admin')

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
    if (role !== 'admin' && role !== 'user') {
      return NextResponse.json(
        {
          success: false,
          message: 'Role must be either "admin" or "user"',
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

    // Insert user
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
