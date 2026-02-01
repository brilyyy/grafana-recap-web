import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import type { ApiResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request)

    if (!session) {
      return NextResponse.json({
        success: false,
        message: 'Not authenticated',
        data: { authenticated: false },
      } as ApiResponse)
    }

    return NextResponse.json({
      success: true,
      message: 'Authenticated',
      data: {
        authenticated: true,
        user: {
          id: session.userId,
          username: session.username,
          role: session.role,
        },
      },
    } as ApiResponse)
  } catch (error: any) {
    console.error('Auth check error:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
}
