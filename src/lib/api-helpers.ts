import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole, getSession, type UserRole, type SessionPayload } from '@/lib/auth'
import type { ApiResponse } from '@/types'

export async function protectRoute(request: NextRequest): Promise<SessionPayload> {
  return requireAuth(request)
}

export async function protectRouteWithRole(request: NextRequest, requiredRole: UserRole): Promise<SessionPayload> {
  return requireRole(request, requiredRole)
}

export function createErrorResponse(message: string, status: number = 500): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, message } as ApiResponse, { status })
}

export function createSuccessResponse<T>(data?: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, message, data } as ApiResponse<T>)
}

export function withAuth<T extends any[]>(
  handler: (request: NextRequest, session: SessionPayload, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    try {
      const session = await protectRoute(request)
      return handler(request, session, ...args)
    } catch (error: any) {
      if (error.message.includes('Unauthorized')) {
        return createErrorResponse('Unauthorized: Authentication required', 401)
      }
      throw error
    }
  }
}

export function withRole<T extends any[]>(
  requiredRole: UserRole,
  handler: (request: NextRequest, session: SessionPayload, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    try {
      const session = await protectRouteWithRole(request, requiredRole)
      return handler(request, session, ...args)
    } catch (error: any) {
      if (error.message.includes('Unauthorized')) {
        return createErrorResponse('Unauthorized: Authentication required', 401)
      }
      if (error.message.includes('Forbidden')) {
        return createErrorResponse('Forbidden: Insufficient permissions', 403)
      }
      throw error
    }
  }
}
