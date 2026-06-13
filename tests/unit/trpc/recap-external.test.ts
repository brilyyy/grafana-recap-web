import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  RECAP_TRIGGER_API_KEY: 'test-api-key',
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USER: 'test_user',
  DB_PASSWORD: 'test_password',
  DB_NAME: 'test_db',
  BETTER_AUTH_SECRET: 'secret',
  BETTER_AUTH_URL: 'http://localhost:3000',
}))

const mockDb = vi.hoisted(() => ({
  execute: vi.fn().mockResolvedValue({ rows: [] }),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
}))

const mockTriggerRecap = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    success: true,
    message: 'ok',
    processingDateLabel: 'H-1',
    targetDate: '2025-01-01',
    logEntry: {
      id: 1,
      status: 'success',
      recordsProcessed: 100,
      recordsInserted: 100,
      startTime: null,
      endTime: null,
      errorMessage: null,
      recapKind: 'success_rate_daily',
    },
  }),
)

vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('@/env', () => ({ env: mockEnv }))
vi.mock('@/lib/better-auth', () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue(null) } } }))
vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/application/recap/trigger-recap', () => ({
  triggerRecap: mockTriggerRecap,
  RecapValidationError: class RecapValidationError extends Error {
    code: string
    constructor(msg: string, code: string) {
      super(msg)
      this.code = code
    }
  },
}))

const { recapRouter } = await import('@/server/trpc/routers/recap')

const VALID_KEY = 'test-api-key' // matches setup.ts RECAP_TRIGGER_API_KEY

function makeExternalCaller(apiKey?: string) {
  const headers = new Headers()
  if (apiKey !== undefined) headers.set('x-recap-api-key', apiKey)
  headers.set('x-forwarded-for', '1.2.3.4')
  return recapRouter.createCaller({ session: null, db: mockDb, headers })
}

describe('recap.triggerExternal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTriggerRecap.mockResolvedValue({
      success: true,
      message: 'ok',
      processingDateLabel: 'H-1',
      targetDate: '2025-01-01',
      logEntry: null,
    })
  })

  // ── API key checks ────────────────────────────────────────────────────────
  it('returns UNAUTHORIZED when x-recap-api-key header is missing', async () => {
    const caller = makeExternalCaller(undefined)
    await expect(caller.triggerExternal({ catalogEntryId: 'sr:bale' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('returns UNAUTHORIZED when x-recap-api-key is wrong', async () => {
    const caller = makeExternalCaller('wrong-key')
    await expect(caller.triggerExternal({ catalogEntryId: 'sr:bale' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('returns UNAUTHORIZED when RECAP_TRIGGER_API_KEY env is empty (fail-closed)', async () => {
    const saved = mockEnv.RECAP_TRIGGER_API_KEY
    mockEnv.RECAP_TRIGGER_API_KEY = ''
    const caller = makeExternalCaller(VALID_KEY)
    await expect(caller.triggerExternal({ catalogEntryId: 'sr:bale' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    mockEnv.RECAP_TRIGGER_API_KEY = saved
  })

  // ── Valid key ──────────────────────────────────────────────────────────────
  it('calls triggerRecap and returns success with a valid key + catalogEntryId', async () => {
    const caller = makeExternalCaller(VALID_KEY)
    const result = await caller.triggerExternal({ catalogEntryId: 'sr:bale' })
    expect(mockTriggerRecap).toHaveBeenCalledWith({ catalogEntryId: 'sr:bale', date: null })
    expect(result.success).toBe(true)
  })

  // ── app_name normalization ────────────────────────────────────────────────
  it('normalizes app_name → sr:<key> when catalogEntryId absent', async () => {
    const caller = makeExternalCaller(VALID_KEY)
    await caller.triggerExternal({ app_name: 'Bale Bisnis' })
    expect(mockTriggerRecap).toHaveBeenCalledWith(
      expect.objectContaining({ catalogEntryId: 'sr:bale_bisnis' }),
    )
  })

  it('returns BAD_REQUEST when neither app_name nor catalogEntryId provided', async () => {
    const caller = makeExternalCaller(VALID_KEY)
    await expect(caller.triggerExternal({})).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  // ── Date format validation (Zod) ─────────────────────────────────────────
  it('rejects date not matching YYYY-MM-DD via Zod', async () => {
    const caller = makeExternalCaller(VALID_KEY)
    await expect(
      caller.triggerExternal({ catalogEntryId: 'sr:bale', date: '15/06/2025' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('accepts a valid YYYY-MM-DD date and passes it to triggerRecap', async () => {
    const caller = makeExternalCaller(VALID_KEY)
    await caller.triggerExternal({ catalogEntryId: 'sr:bale', date: '2025-01-01' })
    expect(mockTriggerRecap).toHaveBeenCalledWith({ catalogEntryId: 'sr:bale', date: '2025-01-01' })
  })

  it('passes date: null when no date provided (H-1 behavior)', async () => {
    const caller = makeExternalCaller(VALID_KEY)
    await caller.triggerExternal({ catalogEntryId: 'sr:bale' })
    expect(mockTriggerRecap).toHaveBeenCalledWith({ catalogEntryId: 'sr:bale', date: null })
  })
})
