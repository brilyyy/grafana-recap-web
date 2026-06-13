import { beforeEach, describe, expect, it, vi } from 'vitest'

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
vi.mock('@/lib/better-auth', () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue(null) } } }))
vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }))

;(globalThis as any).__restartScheduler = vi.fn()
;(globalThis as any).__getSchedulerWorker = vi.fn().mockReturnValue({ pid: 123, connected: true })

const { schedulerRouter } = await import('@/server/trpc/routers/scheduler')

function makeSuperadminCaller() {
  return schedulerRouter.createCaller({
    session: { userId: 1, username: 'admin', role: 'superadmin' },
    db: mockDb,
    headers: new Headers(),
  })
}

const sampleJob = {
  id: 1,
  name: 'Test',
  procedure: 'sp_test',
  schedule: '1 0 * * *',
  timezone: 'Asia/Jakarta',
  enabled: true,
  lastRunAt: null,
  lastStatus: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('scheduler.createJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).__restartScheduler.mockClear()
  })

  it('J2 — throws CONFLICT when procedure already exists (pg error code 23505)', async () => {
    const pgError = Object.assign(new Error('unique violation'), { code: '23505' })
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.returning.mockRejectedValueOnce(pgError)

    await expect(
      makeSuperadminCaller().createJob({
        name: 'BALE processing',
        procedure: 'sp_process_bale_daily',
        schedule: '1 0 * * *',
        timezone: 'Asia/Jakarta',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('J2 — CONFLICT message mentions "already exists"', async () => {
    const pgError = Object.assign(new Error('unique violation'), { code: '23505' })
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.returning.mockRejectedValueOnce(pgError)

    await expect(
      makeSuperadminCaller().createJob({ name: 'X', procedure: 'sp_process_bale_daily', schedule: '1 0 * * *', timezone: 'Asia/Jakarta' }),
    ).rejects.toMatchObject({ message: expect.stringContaining('already exists') })
  })

  it('triggers worker restart after successful job creation', async () => {
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.returning.mockResolvedValueOnce([sampleJob])

    await makeSuperadminCaller().createJob({ name: 'Test', procedure: 'sp_test', schedule: '1 0 * * *', timezone: 'Asia/Jakarta' })
    expect((globalThis as any).__restartScheduler).toHaveBeenCalledOnce()
  })
})

describe('scheduler.updateJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).__restartScheduler.mockClear()
  })

  it('J10 — throws BAD_REQUEST when only id is provided (no fields to update)', async () => {
    await expect(
      makeSuperadminCaller().updateJob({ id: 1 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringContaining('No fields') })
  })

  it('throws NOT_FOUND when job does not exist', async () => {
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.returning.mockResolvedValueOnce([])

    await expect(
      makeSuperadminCaller().updateJob({ id: 9999, enabled: false }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('triggers worker restart after successful update', async () => {
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.returning.mockResolvedValueOnce([{ ...sampleJob, enabled: false }])

    await makeSuperadminCaller().updateJob({ id: 1, enabled: false })
    expect((globalThis as any).__restartScheduler).toHaveBeenCalledOnce()
  })
})

describe('scheduler.deleteJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).__restartScheduler.mockClear()
  })

  it('J6 — throws NOT_FOUND when deleting a non-existent job', async () => {
    mockDb.delete.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.returning.mockResolvedValueOnce([])

    await expect(
      makeSuperadminCaller().deleteJob({ id: 9999 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('triggers worker restart after successful delete', async () => {
    mockDb.delete.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.returning.mockResolvedValueOnce([sampleJob])

    await makeSuperadminCaller().deleteJob({ id: 1 })
    expect((globalThis as any).__restartScheduler).toHaveBeenCalledOnce()
  })
})

describe('scheduler.workerStatus', () => {
  it('returns pid and connected from globalThis.__getSchedulerWorker', async () => {
    const result = await makeSuperadminCaller().workerStatus()
    expect(result.data.pid).toBe(123)
    expect(result.data.connected).toBe(true)
  })

  it('returns null pid and false connected when worker is null', async () => {
    ;(globalThis as any).__getSchedulerWorker.mockReturnValueOnce(null)
    const result = await makeSuperadminCaller().workerStatus()
    expect(result.data.pid).toBeNull()
    expect(result.data.connected).toBe(false)
  })
})
