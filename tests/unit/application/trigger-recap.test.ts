import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted runs before vi.mock factories — creates mock db instance first
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

vi.mock('@/db', () => ({ db: mockDb }))

const { triggerRecap, RecapValidationError } = await import('@/application/recap/trigger-recap')

describe('triggerRecap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.execute.mockResolvedValue({ rows: [] })
  })

  // ── Unknown catalog ID ──────────────────────────────────────────────────
  it('throws RecapValidationError NOT_FOUND for unknown catalogEntryId', async () => {
    await expect(triggerRecap({ catalogEntryId: 'sr:does_not_exist', date: null })).rejects.toMatchObject({
      name: 'RecapValidationError',
      code: 'NOT_FOUND',
    })
  })

  // ── Date format validation ──────────────────────────────────────────────
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
    mockDb.execute.mockResolvedValueOnce({ rows: [{ today }] })
    await expect(triggerRecap({ catalogEntryId: 'sr:bale', date: today })).rejects.toMatchObject({
      code: 'BAD_DATE',
    })
  })

  it('throws BAD_DATE for a future date', async () => {
    const future = '2099-12-31'
    const today = new Date().toISOString().split('T')[0]
    mockDb.execute.mockResolvedValueOnce({ rows: [{ today }] })
    await expect(triggerRecap({ catalogEntryId: 'sr:bale', date: future })).rejects.toMatchObject({
      code: 'BAD_DATE',
    })
  })

  // ── App not found in app_identifier ────────────────────────────────────
  it('throws NOT_FOUND when app key not in app_identifier', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    mockDb.execute
      .mockResolvedValueOnce({ rows: [{ today }] })  // validatePastDate
      .mockResolvedValueOnce({ rows: [] })            // app_identifier empty
    await expect(triggerRecap({ catalogEntryId: 'sr:bale', date: yesterday })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  // ── Happy path ──────────────────────────────────────────────────────────
  it('returns logEntry on success (happy path)', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    mockDb.execute
      .mockResolvedValueOnce({ rows: [{ today }] })                               // validatePastDate
      .mockResolvedValueOnce({ rows: [{ id: 1, app_name: 'Bale' }] })            // resolveAppForEntry
      .mockResolvedValueOnce({ rows: [] })                                        // stored proc call
      .mockResolvedValueOnce({                                                    // app_processing_log
        rows: [{
          id: 42,
          status: 'success',
          records_processed: 1000,
          records_inserted: 1000,
          start_time: yesterday,
          end_time: yesterday,
          error_message: null,
          recap_kind: 'success_rate_daily',
        }],
      })
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
      .mockResolvedValueOnce({ rows: [{ id: 1, app_name: 'Bale' }] })  // resolveAppForEntry
      .mockResolvedValueOnce({ rows: [{ d: yesterday }] })              // resolveTargetDate (H-1)
      .mockResolvedValueOnce({ rows: [] })                              // stored proc
      .mockResolvedValueOnce({ rows: [] })                              // app_processing_log
    const result = await triggerRecap({ catalogEntryId: 'sr:bale', date: null })
    expect(result.processingDateLabel).toBe('H-1 (yesterday in DB)')
  })
})
