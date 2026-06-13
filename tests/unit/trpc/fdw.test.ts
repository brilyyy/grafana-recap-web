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

const mockApplyFdwConfig = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ serversProcessed: 1, tablesProcessed: 1, errors: [] }),
)

vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('@/lib/better-auth', () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue(null) } } }))
vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/fdw-setup', () => ({ applyFdwConfig: mockApplyFdwConfig }))

const { fdwRouter } = await import('@/server/trpc/routers/fdw')

function makeSuperadminCaller() {
  return fdwRouter.createCaller({
    session: { userId: 1, username: 'admin', role: 'superadmin' },
    db: mockDb as any,
    headers: new Headers(),
  })
}

describe('fdw.add', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyFdwConfig.mockResolvedValue({ serversProcessed: 1, tablesProcessed: 1, errors: [] })
    mockDb.execute.mockResolvedValue({ rows: [] })
  })

  it('F10 — throws CONFLICT when FDW source already exists (pg 23505)', async () => {
    const pgError = Object.assign(new Error('duplicate key'), { code: '23505' })
    mockDb.execute.mockRejectedValueOnce(pgError)

    await expect(
      makeSuperadminCaller().add({ source_db_name: 'bale_db', table_name: 'raw_bale' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('already exists') })
  })

  it('F10 — "duplicate" in error message also triggers CONFLICT', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'))
    await expect(
      makeSuperadminCaller().add({ source_db_name: 'bale_db', table_name: 'raw_bale' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('calls applyFdwConfig after inserting new source', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] })
    await makeSuperadminCaller().add({ source_db_name: 'new_db', table_name: 'new_table' })
    expect(mockApplyFdwConfig).toHaveBeenCalledOnce()
  })

  it('reports partial errors from applyFdwConfig in the response', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] })
    mockApplyFdwConfig.mockResolvedValueOnce({
      serversProcessed: 1,
      tablesProcessed: 0,
      errors: ['FDW for new_db.new_table: permission denied'],
    })

    const result = await makeSuperadminCaller().add({ source_db_name: 'new_db', table_name: 'new_table' })
    expect(result.message).toMatch(/error/i)
    expect(result.fdwResult.errors.length).toBeGreaterThan(0)
  })
})

describe('fdw.applyFdw', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyFdwConfig.mockResolvedValue({ serversProcessed: 1, tablesProcessed: 1, errors: [] })
  })

  it('calls applyFdwConfig and returns success message', async () => {
    const result = await makeSuperadminCaller().applyFdw()
    expect(mockApplyFdwConfig).toHaveBeenCalledOnce()
    expect(result.success).toBe(true)
    expect(result.message).toMatch(/re-applied/i)
  })

  it('reports server/table counts in the message', async () => {
    mockApplyFdwConfig.mockResolvedValueOnce({ serversProcessed: 3, tablesProcessed: 7, errors: [] })
    const result = await makeSuperadminCaller().applyFdw()
    expect(result.message).toContain('3 server')
    expect(result.message).toContain('7 table')
  })
})
