interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
  }
}

const rateLimitStore: RateLimitStore = {}

setInterval(
  () => {
    const now = Date.now()
    for (const key in rateLimitStore) {
      if (rateLimitStore[key].resetAt < now) {
        delete rateLimitStore[key]
      }
    }
  },
  5 * 60 * 1000,
).unref?.()

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export const RATE_LIMITS = {
  UPLOAD: { maxRequests: 100, windowMs: 60 * 60 * 1000 },
  READ: { maxRequests: 100, windowMs: 60 * 1000 },
  WRITE: { maxRequests: 50, windowMs: 60 * 1000 },
  AUTH: { maxRequests: 20, windowMs: 60 * 1000 },
} as const

function getRateLimitKey(request: Request, prefix: string): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const path = new URL(request.url).pathname
  return `${prefix}:${ip}:${path}`
}

export function checkRateLimit(
  request: Request,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = getRateLimitKey(request, 'ratelimit')
  const now = Date.now()

  let entry = rateLimitStore[key]

  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    }
    rateLimitStore[key] = entry
  }

  entry.count++

  const remaining = Math.max(0, config.maxRequests - entry.count)
  const allowed = entry.count <= config.maxRequests

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  }
}

export function enforceRateLimit(request: Request, config: RateLimitConfig): void {
  const { allowed, remaining, resetAt } = checkRateLimit(request, config)

  if (!allowed) {
    const resetDate = new Date(resetAt)
    const error = new Error('Rate limit exceeded')
    ;(error as any).statusCode = 429
    ;(error as any).resetAt = resetDate.toISOString()
    ;(error as any).remaining = 0
    throw error
  }
}
