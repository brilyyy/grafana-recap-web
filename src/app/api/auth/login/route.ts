import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { hashPassword, verifyPassword, setSession, requireAuth, getSession } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import type { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    enforceRateLimit(request, RATE_LIMITS.AUTH)

    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Username and password are required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Find user by username
    const [users]: any = await pool.execute(
      'SELECT id, username, email, password_hash, role FROM users WHERE username = ?',
      [username]
    )

    if (users.length === 0) {
      // Log failed login attempt
      await logAuditEvent(
        null,
        username,
        'LOGIN_FAILED',
        'auth',
        null,
        'Invalid username',
        getClientIp(request),
        getUserAgent(request)
      )

      return NextResponse.json(
        {
          success: false,
          message: 'Invalid username or password',
        } as ApiResponse,
        { status: 401 }
      )
    }

    const user = users[0]

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash)

    if (!isValidPassword) {
      // Log failed login attempt
      await logAuditEvent(
        user.id,
        username,
        'LOGIN_FAILED',
        'auth',
        null,
        'Invalid password',
        getClientIp(request),
        getUserAgent(request)
      )

      return NextResponse.json(
        {
          success: false,
          message: 'Invalid username or password',
        } as ApiResponse,
        { status: 401 }
      )
    }

    // Create session
    const sessionPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    }

    const cookieHeader = setSessionCookie(sessionPayload)

    // Log successful login
    await logAuditEvent(
      user.id,
      username,
      'LOGIN_SUCCESS',
      'auth',
      null,
      `Role: ${user.role}`,
      getClientIp(request),
      getUserAgent(request)
    )

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    } as ApiResponse)
    
    response.headers.set('Set-Cookie', cookieHeader)
    return response
  } catch (error: any) {
    if (error.statusCode === 429) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        } as ApiResponse,
        { status: 429 }
      )
    }

    console.error('Login error:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
}
