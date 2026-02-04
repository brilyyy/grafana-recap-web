import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, RATE_LIMITS, type RateLimitConfig } from '@/lib/rateLimit'

/**
 * Public API routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/check',
]

/**
 * Admin-only routes
 */
const ADMIN_ROUTES = [
  '/api/restart-db',
]

/**
 * Rate limit configuration per route pattern
 */
function getRateLimitConfig(pathname: string): RateLimitConfig {
  if (pathname.includes('/restart-db')) {
    return RATE_LIMITS.RESTART_DB
  }
  if (pathname.includes('/upload-')) {
    return RATE_LIMITS.UPLOAD
  }
  // Auth check endpoint gets higher limit since it's called frequently for validation
  if (pathname === '/api/auth/check') {
    return RATE_LIMITS.READ // Use READ limit (100/min) for auth check
  }
  if (pathname.includes('/auth/')) {
    return RATE_LIMITS.AUTH
  }
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(pathname)) {
    return RATE_LIMITS.WRITE
  }
  return RATE_LIMITS.READ
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Apply rate limiting
  try {
    const rateLimitConfig = getRateLimitConfig(pathname)
    const { allowed, remaining, resetAt } = checkRateLimit(request, rateLimitConfig)

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Rate limit exceeded. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(resetAt).toISOString(),
            'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // Add rate limit headers to response
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', rateLimitConfig.maxRequests.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', new Date(resetAt).toISOString())
    
    return response
  } catch (error) {
    console.error('Rate limiting error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
