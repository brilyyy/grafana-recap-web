import { vi } from 'vitest'

/**
 * Creates a minimal Drizzle-shaped mock `db` object.
 * Usage inside a test file:
 *
 *   vi.mock('@/db', () => ({ db: createMockDb() }))
 *
 * Override individual calls per-test:
 *
 *   mockDb.execute.mockResolvedValueOnce({ rows: [...] })
 */
export function createMockDb() {
  const chainable = {
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
  }

  // make chained calls return the same object so any chaining order works
  for (const key of Object.keys(chainable) as (keyof typeof chainable)[]) {
    const fn = chainable[key] as ReturnType<typeof vi.fn>
    if (!['execute', 'orderBy', 'returning'].includes(key)) {
      fn.mockReturnThis()
    }
  }

  return chainable
}

export type MockDb = ReturnType<typeof createMockDb>
