import { createMiddleware, createStart } from '@tanstack/react-start'
import { checkRateLimit, RATE_LIMITS, type RateLimitConfig } from '@/lib/rateLimit'

function getRateLimitConfig(method: string, pathname: string): RateLimitConfig {
  if (pathname.includes('/restart-db')) return RATE_LIMITS.RESTART_DB
  if (pathname.includes('/upload-')) return RATE_LIMITS.UPLOAD
  if (pathname === '/api/auth/check') return RATE_LIMITS.READ
  if (pathname.includes('/auth/')) return RATE_LIMITS.AUTH
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return RATE_LIMITS.WRITE
  return RATE_LIMITS.READ
}

const rateLimitMiddleware = createMiddleware({ type: 'request' })
  .server(async ({ request, next }) => {
    const { pathname } = new URL(request.url)
    const method = request.method

    if (!pathname.startsWith('/api/')) {
      return next()
    }

    const rateLimitConfig = getRateLimitConfig(method, pathname)
    const { allowed, remaining, resetAt } = checkRateLimit(request, rateLimitConfig)

    if (!allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Rate limit exceeded. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(resetAt).toISOString(),
            'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    return next()
  })

export const startInstance = createStart(() => ({
  requestMiddleware: [rateLimitMiddleware],
}))
