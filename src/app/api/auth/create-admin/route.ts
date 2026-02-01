import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import type { ApiResponse } from '@/types'

/**
 * One-time endpoint to create admin user
 * Should be protected or removed after initial setup
 * For production, this should be done via migration script
 */
export async function POST(request: NextRequest) {
  try {
    // Check if admin already exists
    const [admins]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
    )

    if (admins[0].count > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Admin user already exists. Use login endpoint instead.',
        } as ApiResponse,
        { status: 400 }
      )
    }

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

    const passwordHash = await hashPassword(password)

    await pool.execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, 'admin']
    )

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
    } as ApiResponse)
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
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
