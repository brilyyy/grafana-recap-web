import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted runs before vi.mock factories — creates mock db instance first
const mockDb = vi.hoisted(() => ({
  execute: vi.fn().mockResolvedValue([]),
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

vi.mock('@/db', () => ({ db: mockDb }))

const { triggerRecap, RecapValidationError } = await import('@/lib/application/recap/trigger-recap')

describe('triggerRecap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.execute.mockResolvedValue([])
  })

  // ── Unknown catalog ID ──────────────────────────────────────────────────
  it('throws RecapValidationError NOT_FOUND for unknown catalogEntryId', async () => {
    // getDbProcedureEntries call goes to default []
    await expect(triggerRecap({ catalogEntryId: 'sr:does_not_exist', date: null })).rejects.toMatchObject({
      name: 'RecapValidationError',
      code: 'NOT_FOUND',
    })
  })

  // ── Date format validation ──────────────────────────────────────────────
  // (regex check happens before any db.execute calls; getDbProcedureEntries still runs first)
  it('throws BAD_DATE for a date not matching YYYY-MM-DD', async () => {
    await expect(triggerRecap({ catalogEntryId: 'sr:bale', date: '15/06/2025' })).rejects.toMatchObject({
      code: 'BAD_DATE',
    })
  })

  it('throws BAD_DATE for an invalid date string', async () => {
    await expect(triggerRecap({ catalogEntryId: 'sr:bale', date: 'not-a-date' })).rejects.toMatchObject({
      code: 'BAD_DATE',
    })
  })

  // ── Future / today date rejected (validatePastDate) ─────────────────────
  it('throws BAD_DATE when date equals today (per DB CURRENT_DATE)', async () => {
    const today = new Date().toISOString().split('T')[0]
    mockDb.execute
      .mockResolvedValueOnce([]) // getDbProcedureEntries (app_custom_procedure join)
      .mockResolvedValueOnce([]) // getLiveSpFunctions (pg_proc)
      .mockResolvedValueOnce([{ today }]) // validatePastDate → SELECT CURRENT_DATE
    await expect(triggerRecap({ catalogEntryId: 'sr:bale', date: today })).rejects.toMatchObject({
      code: 'BAD_DATE',
    })
  })

  it('throws BAD_DATE for a future date', async () => {
    const future = '2099-12-31'
    const today = new Date().toISOString().split('T')[0]
    mockDb.execute
      .mockResolvedValueOnce([]) // getDbProcedureEntries
      .mockResolvedValueOnce([]) // getLiveSpFunctions
      .mockResolvedValueOnce([{ today }]) // validatePastDate
    await expect(triggerRecap({ catalogEntryId: 'sr:bale', date: future })).rejects.toMatchObject({
      code: 'BAD_DATE',
    })
  })

  // ── App not found in app_identifier ────────────────────────────────────
  it('throws NOT_FOUND when app key not in app_identifier', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    mockDb.execute
      .mockResolvedValueOnce([]) // getDbProcedureEntries
      .mockResolvedValueOnce([]) // getLiveSpFunctions
      .mockResolvedValueOnce([{ today }]) // validatePastDate
      .mockResolvedValueOnce([]) // app_identifier: empty → NOT_FOUND
    await expect(triggerRecap({ catalogEntryId: 'sr:bale', date: yesterday })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  // ── Stored procedure not deployed ───────────────────────────────────────
  it('throws NOT_FOUND when the catalog entry function is not in pg_proc', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    mockDb.execute
      .mockResolvedValueOnce([]) // getDbProcedureEntries
      .mockResolvedValueOnce([]) // getLiveSpFunctions — sp_process_bale_daily missing
      .mockResolvedValueOnce([{ today }]) // validatePastDate
      .mockResolvedValueOnce([{ id: 1, app_name: 'Bale' }]) // resolveAppForEntry
    await expect(triggerRecap({ catalogEntryId: 'sr:bale', date: yesterday })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: expect.stringContaining('not deployed'),
    })
  })

  // ── Happy path ──────────────────────────────────────────────────────────
  it('returns logEntry on success (happy path)', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    mockDb.execute
      .mockResolvedValueOnce([]) // getDbProcedureEntries
      .mockResolvedValueOnce([{ function_name: 'sp_process_bale_daily', description: null }]) // getLiveSpFunctions
      .mockResolvedValueOnce([{ today }]) // validatePastDate
      .mockResolvedValueOnce([{ id: 1, app_name: 'Bale' }]) // resolveAppForEntry
      .mockResolvedValueOnce([]) // stored proc call (SELECT public.sp_process_bale_daily)
      .mockResolvedValueOnce([
        {
          id: 42,
          status: 'success',
          records_processed: 1000,
          records_inserted: 1000,
          start_time: yesterday,
          end_time: yesterday,
          error_message: null,
          recap_kind: 'success_rate_daily',
        },
      ]) // app_processing_log
    const result = await triggerRecap({ catalogEntryId: 'sr:bale', date: yesterday })
    expect(result.success).toBe(true)
    expect(result.logEntry?.status).toBe('success')
    expect(result.logEntry?.recordsProcessed).toBe(1000)
    expect(result.processingDateLabel).toBe(yesterday)
  })

  // ── Null date → H-1 label ───────────────────────────────────────────────
  it('uses "H-1 (yesterday in DB)" label when no date passed', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    mockDb.execute
      .mockResolvedValueOnce([]) // getDbProcedureEntries
      .mockResolvedValueOnce([{ function_name: 'sp_process_bale_daily', description: null }]) // getLiveSpFunctions
      .mockResolvedValueOnce([{ id: 1, app_name: 'Bale' }]) // resolveAppForEntry
      .mockResolvedValueOnce([{ d: yesterday }]) // resolveTargetDate (H-1 from DB)
      .mockResolvedValueOnce([]) // stored proc
      .mockResolvedValueOnce([]) // app_processing_log
    const result = await triggerRecap({ catalogEntryId: 'sr:bale', date: null })
    expect(result.processingDateLabel).toBe('H-1 (yesterday in DB)')
  })
})
