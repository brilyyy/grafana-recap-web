import { NextRequest } from 'next/server'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
  }
}

// In-memory store (for production, use Redis or similar)
const rateLimitStore: RateLimitStore = {}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetAt < now) {
      delete rateLimitStore[key]
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export const RATE_LIMITS = {
  // Restart DB: 1 request per hour
  RESTART_DB: { maxRequests: 1, windowMs: 60 * 60 * 1000 },
  // Upload endpoints: 10 requests per hour
  UPLOAD: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
  // Read endpoints: 100 requests per minute
  READ: { maxRequests: 100, windowMs: 60 * 1000 },
  // Write endpoints: 50 requests per minute
  WRITE: { maxRequests: 50, windowMs: 60 * 1000 },
  // Auth endpoints: 5 requests per minute
  AUTH: { maxRequests: 5, windowMs: 60 * 1000 },
} as const

/**
 * Get rate limit key for a request
 */
function getRateLimitKey(request: NextRequest, prefix: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown'
  const path = new URL(request.url).pathname
  return `${prefix}:${ip}:${path}`
}

/**
 * Check rate limit for a request
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = getRateLimitKey(request, 'ratelimit')
  const now = Date.now()
  
  let entry = rateLimitStore[key]

  // Initialize or reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    }
    rateLimitStore[key] = entry
  }

  // Increment count
  entry.count++

  const remaining = Math.max(0, config.maxRequests - entry.count)
  const allowed = entry.count <= config.maxRequests

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  }
}

/**
 * Middleware helper to enforce rate limiting
 * Throws error if rate limit exceeded
 */
export function enforceRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): void {
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
