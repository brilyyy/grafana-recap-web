import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { auth } from '@/lib/better-auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import type { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, RATE_LIMITS.AUTH)

    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required' } as ApiResponse,
        { status: 400 }
      )
    }

    // Look up email by username (BetterAuth signs in by email)
    let users: any
    const [result]: any = await pool.execute(
      'SELECT id, username, email, role FROM users WHERE username = ?',
      [username]
    )
    users = result

    if (users.length === 0) {
      await logAuditEvent(null, username, 'LOGIN_FAILED', 'auth', null, 'Invalid username', getClientIp(request), getUserAgent(request))
      return NextResponse.json(
        { success: false, message: 'Invalid username or password' } as ApiResponse,
        { status: 401 }
      )
    }

    const user = users[0]

    // Use BetterAuth to sign in – it verifies the password and creates the session cookie
    let sessionUser: any
    try {
      const result = await auth.api.signInEmail({
        body: { email: user.email, password },
        headers: request.headers,
      })
      sessionUser = result.user
    } catch {
      await logAuditEvent(user.id, username, 'LOGIN_FAILED', 'auth', null, 'Invalid password', getClientIp(request), getUserAgent(request))
      return NextResponse.json(
        { success: false, message: 'Invalid username or password' } as ApiResponse,
        { status: 401 }
      )
    }

    await logAuditEvent(user.id, username, 'LOGIN_SUCCESS', 'auth', null, `Role: ${user.role}`, getClientIp(request), getUserAgent(request))

    return NextResponse.json({
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
  } catch (error: any) {
    if (error.statusCode === 429) {
      return NextResponse.json({ success: false, message: error.message } as ApiResponse, { status: 429 })
    }
    console.error('Login error:', error.message)
    return NextResponse.json({ success: false, message: 'Internal server error' } as ApiResponse, { status: 500 })
  }
}
