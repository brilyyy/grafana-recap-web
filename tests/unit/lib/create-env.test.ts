import { describe, expect, it, afterEach } from 'vitest'
import { z } from 'zod'
import { createEnv, parseEnv, prettifyZodError, EnvValidationError } from '@/lib/create-env'

// ─── prettifyZodError ─────────────────────────────────────────────────────────

describe('prettifyZodError', () => {
  it('formats invalid_type with expected but not "undefined received"', () => {
    const schema = z.object({ X: z.string() })
    const result = schema.safeParse({ X: 42 })
    expect(result.success).toBe(false)
    if (result.success) return
    const msg = prettifyZodError(result.error)
    expect(msg).toContain('expected: string')
    expect(msg).not.toContain('undefined')
  })

  it('formats too_small on string with "minimum length"', () => {
    const schema = z.object({ X: z.string().min(5) })
    const result = schema.safeParse({ X: 'ab' })
    expect(result.success).toBe(false)
    if (result.success) return
    const msg = prettifyZodError(result.error)
    expect(msg).toContain('minimum length: 5')
  })

  it('formats too_small on number without "length"', () => {
    const schema = z.object({ N: z.number().min(10) })
    const result = schema.safeParse({ N: 1 })
    expect(result.success).toBe(false)
    if (result.success) return
    const msg = prettifyZodError(result.error)
    expect(msg).toContain('minimum: 10')
    expect(msg).not.toContain('minimum length')
  })

  it('formats unrecognized_keys with key list', () => {
    const schema = z.object({ A: z.string() }).strict()
    const result = schema.safeParse({ A: 'x', rogue: 1 })
    expect(result.success).toBe(false)
    if (result.success) return
    const msg = prettifyZodError(result.error)
    expect(msg).toContain('rogue')
    expect(msg).toContain('unrecognized keys')
  })

  it('uses "(root)" when path is empty', () => {
    const schema = z.string()
    const result = schema.safeParse(42)
    expect(result.success).toBe(false)
    if (result.success) return
    const msg = prettifyZodError(result.error)
    expect(msg).toContain('(root)')
  })

  it('includes label in header when provided', () => {
    const schema = z.object({ X: z.string() })
    const result = schema.safeParse({})
    expect(result.success).toBe(false)
    if (result.success) return
    const msg = prettifyZodError(result.error, 'server')
    expect(msg).toContain('(server)')
  })

  it('formats invalid_format (URL) with format name', () => {
    const schema = z.object({ U: z.string().url() })
    const result = schema.safeParse({ U: 'not-a-url' })
    expect(result.success).toBe(false)
    if (result.success) return
    const msg = prettifyZodError(result.error)
    expect(msg).toContain('format:')
  })
})

// ─── parseEnv ─────────────────────────────────────────────────────────────────

describe('parseEnv', () => {
  const schema = z.object({ HOST: z.string().min(1), PORT: z.coerce.number().default(5432) })

  it('returns parsed data on valid source', () => {
    const result = parseEnv(schema, { HOST: 'localhost' }, 'test')
    expect(result.HOST).toBe('localhost')
    expect(result.PORT).toBe(5432)
  })

  it('throws EnvValidationError on invalid source', () => {
    expect(() => parseEnv(schema, {}, 'test')).toThrow(EnvValidationError)
  })

  it('calls onError before throwing', () => {
    let called = false
    expect(() =>
      parseEnv(schema, {}, 'test', () => {
        called = true
      }),
    ).toThrow()
    expect(called).toBe(true)
  })

  it('treats empty strings as missing so defaults apply', () => {
    const result = parseEnv(schema, { HOST: 'localhost', PORT: '' }, 'test')
    expect(result.PORT).toBe(5432)
  })

  it('treats empty strings as missing so min(1) rejects', () => {
    expect(() => parseEnv(schema, { HOST: '' }, 'test')).toThrow(EnvValidationError)
  })
})

// ─── createEnv ────────────────────────────────────────────────────────────────

const serverSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
})

const clientSchema = z.object({
  API_URL: z.string().url(),
})

const validServerSource = { DB_HOST: 'localhost', DB_PORT: '5433' }
const validClientSource = { VITE_API_URL: 'https://api.example.com' }

describe('createEnv — happy path', () => {
  it('merges server and stripped client vars', () => {
    const e = createEnv({
      server: serverSchema,
      client: clientSchema,
      clientPrefix: 'VITE_',
      parseFrom: { server: validServerSource, client: validClientSource },
    })
    expect(e.DB_HOST).toBe('localhost')
    expect(e.DB_PORT).toBe(5433)
    expect(e.API_URL).toBe('https://api.example.com')
  })

  it('applies server defaults', () => {
    const e = createEnv({
      server: serverSchema,
      client: clientSchema,
      clientPrefix: 'VITE_',
      parseFrom: { server: { DB_HOST: 'myhost' }, client: validClientSource },
    })
    expect(e.DB_PORT).toBe(5432)
  })
})

describe('createEnv — clientPrefix stripping', () => {
  it('strips prefix before validation', () => {
    const e = createEnv({
      server: serverSchema,
      client: clientSchema,
      clientPrefix: 'VITE_',
      parseFrom: { server: validServerSource, client: { VITE_API_URL: 'https://x.com' } },
    })
    expect(e.API_URL).toBe('https://x.com')
  })

  it('ignores client vars without prefix', () => {
    const e = createEnv({
      server: serverSchema,
      client: clientSchema,
      clientPrefix: 'VITE_',
      parseFrom: {
        server: validServerSource,
        client: { VITE_API_URL: 'https://x.com', API_URL: 'should-be-ignored' },
      },
    })
    // API_URL should come from the prefixed var, not the raw one
    expect(e.API_URL).toBe('https://x.com')
  })
})

describe('createEnv — empty string handling', () => {
  it('treats empty DB_PORT as missing and applies default', () => {
    const e = createEnv({
      server: serverSchema,
      client: clientSchema,
      clientPrefix: 'VITE_',
      parseFrom: {
        server: { DB_HOST: 'localhost', DB_PORT: '' },
        client: validClientSource,
      },
    })
    expect(e.DB_PORT).toBe(5432)
  })

  it('treats empty DB_HOST as missing and throws', () => {
    expect(() =>
      createEnv({
        server: serverSchema,
        client: clientSchema,
        clientPrefix: 'VITE_',
        parseFrom: { server: { DB_HOST: '' }, client: validClientSource },
      }),
    ).toThrow(EnvValidationError)
  })
})

describe('createEnv — skipValidation', () => {
  it('returns raw values without throwing on invalid source', () => {
    const e = createEnv({
      server: serverSchema,
      client: clientSchema,
      clientPrefix: 'VITE_',
      parseFrom: { server: { DB_HOST: 'ok', DB_PORT: 'abc' }, client: { VITE_API_URL: 'not-url' } },
      skipValidation: true,
    })
    // Raw values returned without coercion or validation
    expect((e as Record<string, unknown>).DB_PORT).toBe('abc')
  })
})

describe('createEnv — read-only proxy', () => {
  it('silently ignores assignments (no throw)', () => {
    const e = createEnv({
      server: serverSchema,
      client: clientSchema,
      clientPrefix: 'VITE_',
      parseFrom: { server: validServerSource, client: validClientSource },
    }) as Record<string, unknown>
    expect(() => {
      e.DB_HOST = 'mutated'
    }).not.toThrow()
    // Value unchanged
    expect(e.DB_HOST).toBe('localhost')
  })
})

describe('createEnv — server-on-client guard', () => {
  afterEach(() => {
    // Restore: delete the stub window so other tests run as server
    delete (globalThis as Record<string, unknown>).window
  })

  it('throws when a server-only key is accessed on the client', () => {
    // Simulate browser environment
    ;(globalThis as Record<string, unknown>).window = {}

    const e = createEnv({
      server: serverSchema,
      client: clientSchema,
      clientPrefix: 'VITE_',
      parseFrom: { server: validServerSource, client: validClientSource },
    })

    expect(() => (e as unknown as Record<string, unknown>).DB_HOST).toThrow(
      'Server-only environment variable',
    )
  })

  it('does not throw for client keys on the client', () => {
    ;(globalThis as Record<string, unknown>).window = {}

    const e = createEnv({
      server: serverSchema,
      client: clientSchema,
      clientPrefix: 'VITE_',
      parseFrom: { server: validServerSource, client: validClientSource },
    })

    expect(() => (e as unknown as Record<string, unknown>).API_URL).not.toThrow()
  })

  it('does not parse the server schema on the client (no EnvValidationError for missing server vars)', () => {
    ;(globalThis as Record<string, unknown>).window = {}

    // Pass empty server source — would throw if parsed
    expect(() =>
      createEnv({
        server: serverSchema,
        client: clientSchema,
        clientPrefix: 'VITE_',
        parseFrom: { server: {}, client: validClientSource },
      }),
    ).not.toThrow()
  })

  it('still validates client schema on the client', () => {
    ;(globalThis as Record<string, unknown>).window = {}

    expect(() =>
      createEnv({
        server: serverSchema,
        client: clientSchema,
        clientPrefix: 'VITE_',
        parseFrom: { server: {}, client: { VITE_API_URL: 'not-a-url' } },
      }),
    ).toThrow(EnvValidationError)
  })

  it('does not throw for server key access when guard is disabled', () => {
    ;(globalThis as Record<string, unknown>).window = {}

    const e = createEnv({
      server: serverSchema,
      client: clientSchema,
      clientPrefix: 'VITE_',
      parseFrom: { server: validServerSource, client: validClientSource },
      runtimeCheckServerAccess: false,
    })

    // Guard disabled — no throw (value will be undefined since server wasn't parsed)
    expect(() => (e as unknown as Record<string, unknown>).DB_HOST).not.toThrow()
  })
})
