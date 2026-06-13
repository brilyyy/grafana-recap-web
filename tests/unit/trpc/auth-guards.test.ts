import { TRPCError } from '@trpc/server'
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
;(globalThis as any).__getSchedulerWorker = vi.fn().mockReturnValue(null)

const { schedulerRouter } = await import('@/server/trpc/routers/scheduler')
const { fdwRouter } = await import('@/server/trpc/routers/fdw')
const { recapRouter } = await import('@/server/trpc/routers/recap')

type SessionRole = 'superadmin' | 'admin' | 'user' | null

function makeCaller(role: SessionRole) {
  const session = role ? { userId: 1, username: 'tester', role } : null
  const ctx = { session, db: mockDb as any, headers: new Headers() }
  return {
    scheduler: schedulerRouter.createCaller(ctx),
    fdw: fdwRouter.createCaller(ctx),
    recap: recapRouter.createCaller(ctx),
  }
}

describe('superAdminProcedure auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.execute.mockResolvedValue({ rows: [] })
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.orderBy.mockResolvedValue([])
  })

  // ── No session ──────────────────────────────────────────────────────────
  it('scheduler.listJobs → UNAUTHORIZED when no session', async () => {
    const { scheduler } = makeCaller(null)
    await expect(scheduler.listJobs()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('fdw.list → UNAUTHORIZED when no session', async () => {
    const { fdw } = makeCaller(null)
    await expect(fdw.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('recap.listCatalog → UNAUTHORIZED when no session', async () => {
    const { recap } = makeCaller(null)
    await expect(recap.listCatalog()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  // ── Role = user ─────────────────────────────────────────────────────────
  it('scheduler.listJobs → FORBIDDEN for role=user', async () => {
    const { scheduler } = makeCaller('user')
    await expect(scheduler.listJobs()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('fdw.list → FORBIDDEN for role=user', async () => {
    const { fdw } = makeCaller('user')
    await expect(fdw.list()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('recap.listCatalog → FORBIDDEN for role=user', async () => {
    const { recap } = makeCaller('user')
    await expect(recap.listCatalog()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  // ── Role = superadmin ───────────────────────────────────────────────────
  it('scheduler.listJobs → passes for role=superadmin', async () => {
    const { scheduler } = makeCaller('superadmin')
    await expect(scheduler.listJobs()).resolves.toBeDefined()
  })

  it('recap.listCatalog → passes for role=superadmin', async () => {
    const { recap } = makeCaller('superadmin')
    await expect(recap.listCatalog()).resolves.toBeDefined()
  })

  it('fdw.list → passes for role=superadmin', async () => {
    const { fdw } = makeCaller('superadmin')
    await expect(fdw.list()).resolves.toBeDefined()
  })
})
