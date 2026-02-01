import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, clearSessionCookie } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const session = requireAuth(request)

    const cookieHeader = clearSessionCookie()

    // Log logout
    await logAuditEvent(
      session.userId,
      session.username,
      'LOGOUT',
      'auth',
      null,
      null,
      getClientIp(request),
      getUserAgent(request)
    )

    const response = NextResponse.json({
      success: true,
      message: 'Logout successful',
    } as ApiResponse)
    
    response.headers.set('Set-Cookie', cookieHeader)
    return response
  } catch (error: any) {
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        } as ApiResponse,
        { status: 401 }
      )
    }

    console.error('Logout error:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
}
