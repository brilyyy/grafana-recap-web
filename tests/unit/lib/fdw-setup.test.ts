import { beforeEach, describe, expect, it } from 'vitest'
import { applyFdwConfig } from '@/lib/fdw-setup'
import { MockSql } from '../../helpers/mock-sql'

/**
 * applyFdwConfig call-order for a single source row:
 *  [0] CREATE EXTENSION IF NOT EXISTS postgres_fdw
 *  [1] SELECT EXISTS … (tableExists 'fdw_source_table')
 *  [2] SELECT source_db_name, table_name FROM fdw_source_table
 *  [3] DROP SERVER … CASCADE
 *  [4] CREATE SERVER …
 *  [5] CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER
 *  [6] DROP SCHEMA IF EXISTS _fdw_import_tmp CASCADE
 *  [7] CREATE SCHEMA _fdw_import_tmp
 *  [8] IMPORT FOREIGN SCHEMA …
 *  [9] ALTER FOREIGN TABLE … RENAME TO …
 * [10] ALTER FOREIGN TABLE … SET SCHEMA public
 * [11] DROP SCHEMA _fdw_import_tmp
 * [12] CREATE OR REPLACE VIEW …
 */

const singleRow = [{ source_db_name: 'bale_db', table_name: 'raw_bale' }]

/** Enqueue responses for the standard happy-path scenario (1 source, 1 table). */
function enqueueHappyPath(sql: MockSql, rows = singleRow) {
  sql.enqueue([]) // [0] CREATE EXTENSION → no result used
  sql.enqueue([{ exists: true }]) // [1] tableExists → true
  sql.enqueue(rows) // [2] SELECT rows
  // All subsequent DDL calls return [] (sql falls back to default)
}

describe('applyFdwConfig', () => {
  let sqlMock: MockSql

  beforeEach(() => {
    sqlMock = new MockSql()
    process.env.DB_HOST = 'localhost'
    process.env.DB_PORT = '5432'
    process.env.DB_USER = 'test_user'
    process.env.DB_PASSWORD = 'test_password'
    delete process.env.DB_USER_TARGET
  })

  it('emits CREATE EXTENSION IF NOT EXISTS postgres_fdw first', async () => {
    sqlMock.enqueue([{ exists: false }]) // for tableExists check (extension call before it)
    await applyFdwConfig(sqlMock as any)
    expect(sqlMock.getQueries()[0]).toContain('CREATE EXTENSION IF NOT EXISTS postgres_fdw')
  })

  it('returns empty results when fdw_source_table does not exist', async () => {
    sqlMock.enqueue([]) // CREATE EXTENSION
    sqlMock.enqueue([{ exists: false }]) // tableExists → false
    const result = await applyFdwConfig(sqlMock as any)
    expect(result.serversProcessed).toBe(0)
    expect(result.tablesProcessed).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('processes one server + table when fdw_source_table has rows', async () => {
    enqueueHappyPath(sqlMock)
    const result = await applyFdwConfig(sqlMock as any)
    expect(result.serversProcessed).toBe(1)
    expect(result.tablesProcessed).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('emits DROP SERVER … CASCADE before CREATE SERVER', async () => {
    enqueueHappyPath(sqlMock)
    await applyFdwConfig(sqlMock as any)
    const queries = sqlMock.getQueries()
    const dropIdx = queries.findIndex((q) => q.includes('DROP SERVER') && q.includes('CASCADE'))
    const createIdx = queries.findIndex((q) => q.includes('CREATE SERVER'))
    expect(dropIdx).toBeGreaterThan(-1)
    expect(createIdx).toBeGreaterThan(dropIdx)
  })

  it('emits CREATE USER MAPPING for CURRENT_USER after server creation', async () => {
    enqueueHappyPath(sqlMock)
    await applyFdwConfig(sqlMock as any)
    expect(sqlMock.getQueries().some((q) => q.includes('CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER'))).toBe(
      true,
    )
  })

  it('emits IMPORT FOREIGN SCHEMA for the table', async () => {
    enqueueHappyPath(sqlMock)
    await applyFdwConfig(sqlMock as any)
    expect(sqlMock.getQueries().some((q) => q.includes('IMPORT FOREIGN SCHEMA'))).toBe(true)
  })

  it('creates a compat view with CREATE OR REPLACE VIEW', async () => {
    enqueueHappyPath(sqlMock)
    await applyFdwConfig(sqlMock as any)
    expect(sqlMock.getQueries().some((q) => q.includes('CREATE OR REPLACE VIEW'))).toBe(true)
  })

  it('escapes single quotes in DB credentials (F11 — SQL injection safety)', async () => {
    process.env.DB_PASSWORD = "it's a trap"
    enqueueHappyPath(sqlMock)
    await applyFdwConfig(sqlMock as any)
    const queries = sqlMock.getQueries()
    const userMappingQuery = queries.find((q) => q.includes('OPTIONS') && q.includes('password'))
    expect(userMappingQuery).toBeTruthy()
    expect(userMappingQuery).toContain("it''s a trap")
  })

  it('collects errors without throwing when a table import fails (F7)', async () => {
    // Custom sql that fails on the IMPORT FOREIGN SCHEMA call (index 8 in the sequence)
    let callCount = 0
    const failSql = {
      calls: [] as string[],
      getQueries() {
        return [...this.calls]
      },
      async end() {},
      async unsafe(sql: string) {
        callCount++
        this.calls.push(sql.trim())
        if (callCount === 1) return [] // CREATE EXTENSION
        if (callCount === 2) return [{ exists: true }] // tableExists
        if (callCount === 3) return singleRow // SELECT rows
        if (callCount === 9) throw new Error('permission denied') // IMPORT FOREIGN SCHEMA
        return []
      },
    }
    const result = await applyFdwConfig(failSql as any)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toMatch(/permission denied/)
  })

  it('skips compat view for duplicate table names (F6 — claimed view collision)', async () => {
    const twoRows = [
      { source_db_name: 'db_a', table_name: 'transactions' },
      { source_db_name: 'db_b', table_name: 'transactions' },
    ]
    sqlMock.enqueue([]) // CREATE EXTENSION
    sqlMock.enqueue([{ exists: true }]) // tableExists
    sqlMock.enqueue(twoRows) // SELECT rows
    // All DDL fall through to default []
    await applyFdwConfig(sqlMock as any)
    const queries = sqlMock.getQueries()
    const viewCreates = queries.filter((q) => q.includes('CREATE OR REPLACE VIEW') && q.includes('"transactions"'))
    expect(viewCreates).toHaveLength(1)
  })

  it('emits DB_USER_TARGET GRANT USAGE when env var is set (F8)', async () => {
    process.env.DB_USER_TARGET = 'app_reader'
    enqueueHappyPath(sqlMock)
    await applyFdwConfig(sqlMock as any)
    expect(sqlMock.getQueries().some((q) => q.includes('GRANT USAGE ON FOREIGN SERVER'))).toBe(true)
  })
})
