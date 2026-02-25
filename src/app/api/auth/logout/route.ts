import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/better-auth'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)

    // BetterAuth clears the session cookie automatically via nextCookies plugin
    await auth.api.signOut({ headers: request.headers })

    await logAuditEvent(session.userId, session.username, 'LOGOUT', 'auth', null, null, getClientIp(request), getUserAgent(request))

    return NextResponse.json({ success: true, message: 'Logout successful' } as ApiResponse)
  } catch (error: any) {
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ success: false, message: error.message } as ApiResponse, { status: 401 })
    }
    console.error('Logout error:', error.message)
    return NextResponse.json({ success: false, message: 'Internal server error' } as ApiResponse, { status: 500 })
  }
}
