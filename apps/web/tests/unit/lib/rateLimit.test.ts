import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, enforceRateLimit } from '@/lib/rateLimit'

function makeRequest(ip = '1.2.3.4', path = '/api/test'): Request {
  return new Request(`http://localhost${path}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first request', () => {
    const r = checkRateLimit(makeRequest('10.0.0.1', '/unique1'), { maxRequests: 3, windowMs: 60_000 })
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(2)
  })

  it('counts down remaining correctly', () => {
    const req = () => makeRequest('10.0.0.2', '/unique2')
    const config = { maxRequests: 3, windowMs: 60_000 }
    expect(checkRateLimit(req(), config).remaining).toBe(2)
    expect(checkRateLimit(req(), config).remaining).toBe(1)
    expect(checkRateLimit(req(), config).remaining).toBe(0)
  })

  it('blocks at the limit boundary', () => {
    const req = () => makeRequest('10.0.0.3', '/unique3')
    const config = { maxRequests: 2, windowMs: 60_000 }
    checkRateLimit(req(), config) // 1
    checkRateLimit(req(), config) // 2 — at limit
    const r = checkRateLimit(req(), config) // 3 — over
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('resets the window after windowMs elapses', () => {
    const req = () => makeRequest('10.0.0.4', '/unique4')
    const config = { maxRequests: 1, windowMs: 60_000 }
    checkRateLimit(req(), config) // uses up quota
    vi.advanceTimersByTime(60_001) // past window
    const r = checkRateLimit(req(), config)
    expect(r.allowed).toBe(true)
  })

  it('keys by IP+path — different paths have independent counters', () => {
    const config = { maxRequests: 1, windowMs: 60_000 }
    checkRateLimit(makeRequest('10.0.0.5', '/path-a'), config) // exhausts /path-a
    const r = checkRateLimit(makeRequest('10.0.0.5', '/path-b'), config)
    expect(r.allowed).toBe(true)
  })
})

describe('enforceRateLimit', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('throws with statusCode 429 when limit exceeded', () => {
    const req = () => makeRequest('10.0.0.10', '/enforce-test')
    const config = { maxRequests: 1, windowMs: 60_000 }
    enforceRateLimit(req(), config) // pass
    try {
      enforceRateLimit(req(), config)
      expect.fail('should have thrown')
    } catch (e: any) {
      expect(e.statusCode).toBe(429)
      expect(e.remaining).toBe(0)
      expect(typeof e.resetAt).toBe('string')
    }
  })

  it('does not throw when under limit', () => {
    expect(() =>
      enforceRateLimit(makeRequest('10.0.0.11', '/under-limit'), { maxRequests: 10, windowMs: 60_000 }),
    ).not.toThrow()
  })
})
