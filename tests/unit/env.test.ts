import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Test the env validation schema directly without importing src/env.ts
 * (which runs parse at import time and would be affected by setup.ts).
 * We reconstruct the minimal server schema here to test the validation rules.
 */
const serverSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  SCHEDULER_TIMEZONE: z.string().default('Asia/Jakarta'),
  BALE_PROCESSING_SCHEDULE: z.string().default('1 0 * * *'),
  CMS_PROCESSING_SCHEDULE: z.string().default('1 0 * * *'),
  HOUSEKEEPING_SCHEDULE: z.string().default('0 2 * * *'),
})

const validBase = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'user',
  DB_PASSWORD: 'pass',
  DB_NAME: 'mydb',
  BETTER_AUTH_SECRET: 'secret',
  BETTER_AUTH_URL: 'http://localhost:3000',
}

describe('server env schema', () => {
  it('parses a fully valid env object', () => {
    expect(() => serverSchema.parse(validBase)).not.toThrow()
  })

  it('coerces DB_PORT string to number', () => {
    const result = serverSchema.parse({ ...validBase, DB_PORT: '5433' })
    expect(result.DB_PORT).toBe(5433)
  })

  it('defaults DB_PORT to 5432 when absent', () => {
    const { DB_PORT: _, ...noPort } = validBase as any
    const result = serverSchema.parse(noPort)
    expect(result.DB_PORT).toBe(5432)
  })

  it('defaults SCHEDULER_TIMEZONE to Asia/Jakarta', () => {
    const result = serverSchema.parse(validBase)
    expect(result.SCHEDULER_TIMEZONE).toBe('Asia/Jakarta')
  })

  it('defaults BALE_PROCESSING_SCHEDULE to "1 0 * * *"', () => {
    const result = serverSchema.parse(validBase)
    expect(result.BALE_PROCESSING_SCHEDULE).toBe('1 0 * * *')
  })

  it('defaults HOUSEKEEPING_SCHEDULE to "0 2 * * *"', () => {
    const result = serverSchema.parse(validBase)
    expect(result.HOUSEKEEPING_SCHEDULE).toBe('0 2 * * *')
  })

  it('throws when DB_HOST is missing', () => {
    const { DB_HOST: _, ...noHost } = validBase as any
    expect(() => serverSchema.parse(noHost)).toThrow()
  })

  it('throws when DB_PASSWORD is missing', () => {
    const { DB_PASSWORD: _, ...noPass } = validBase as any
    expect(() => serverSchema.parse(noPass)).toThrow()
  })

  it('throws when BETTER_AUTH_SECRET is missing', () => {
    const { BETTER_AUTH_SECRET: _, ...noSecret } = validBase as any
    expect(() => serverSchema.parse(noSecret)).toThrow()
  })

  it('throws when BETTER_AUTH_URL is not a valid URL', () => {
    expect(() => serverSchema.parse({ ...validBase, BETTER_AUTH_URL: 'not-a-url' })).toThrow()
  })

  it('throws when DB_PORT is non-numeric', () => {
    expect(() => serverSchema.parse({ ...validBase, DB_PORT: 'abc' })).toThrow()
  })

  it('throws when DB_PORT is zero', () => {
    expect(() => serverSchema.parse({ ...validBase, DB_PORT: '0' })).toThrow()
  })
})
