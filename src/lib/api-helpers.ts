import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole, getSession, type UserRole } from '@/lib/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import type { ApiResponse } from '@/types'

/**
 * Helper to protect API routes with authentication
 * Returns session if authenticated, throws error if not
 */
export function protectRoute(request: NextRequest) {
  return requireAuth(request)
}

/**
 * Helper to protect API routes with role-based access
 * Returns session if authorized, throws error if not
 */
export function protectRouteWithRole(
  request: NextRequest,
  requiredRole: UserRole
) {
  return requireRole(request, requiredRole)
}

/**
 * Helper to create error response
 */
export function createErrorResponse(
  message: string,
  status: number = 500
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      message,
    } as ApiResponse,
    { status }
  )
}

/**
 * Helper to create success response
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    message,
    data,
  } as ApiResponse<T>)
}

/**
 * Wrapper for API route handlers with authentication
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, session: ReturnType<typeof requireAuth>, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    try {
      const session = protectRoute(request)
      return handler(request, session, ...args)
    } catch (error: any) {
      if (error.message.includes('Unauthorized')) {
        return createErrorResponse('Unauthorized: Authentication required', 401)
      }
      throw error
    }
  }
}

/**
 * Wrapper for API route handlers with role-based access
 */
export function withRole<T extends any[]>(
  requiredRole: UserRole,
  handler: (request: NextRequest, session: ReturnType<typeof requireRole>, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    try {
      const session = protectRouteWithRole(request, requiredRole)
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
