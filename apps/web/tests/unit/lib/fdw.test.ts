import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { fdwLocalRelationName, resolvePgHousekeepingRelation } from '@/lib/fdw'

describe('fdwLocalRelationName', () => {
  it('returns "{db}_{table}" for short names', () => {
    expect(fdwLocalRelationName('bale_db', 'raw_bale')).toBe('bale_db_raw_bale')
  })

  it('passes through names ≤63 bytes unchanged', () => {
    const db = 'a'.repeat(30)
    const table = 'b'.repeat(32)
    const raw = `${db}_${table}` // 63 chars
    expect(fdwLocalRelationName(db, table)).toBe(raw)
  })

  it('truncates names >63 bytes to 55 chars + "_" + 7-hex suffix', () => {
    const db = 'very_long_database_name_here'
    const table = 'also_a_very_long_table_name_exceeding_postgres_limit'
    const raw = `${db}_${table}`
    expect(raw.length).toBeGreaterThan(63)

    const result = fdwLocalRelationName(db, table)
    expect(result.length).toBeLessThanOrEqual(63)
    expect(result).toMatch(/^.{55}_[0-9a-f]{7}$/)
  })

  it('truncation is deterministic (same input → same output)', () => {
    const db = 'very_long_database_name_here'
    const table = 'also_a_very_long_table_name_exceeding_postgres_limit'
    expect(fdwLocalRelationName(db, table)).toBe(fdwLocalRelationName(db, table))
  })

  it('truncated suffix matches md5 of "{db}:{table}"', () => {
    const db = 'very_long_database_name_here'
    const table = 'also_a_very_long_table_name_exceeding_postgres_limit'
    const expectedSuffix = createHash('md5').update(`${db}:${table}`).digest('hex').slice(0, 7)
    const result = fdwLocalRelationName(db, table)
    expect(result.endsWith(`_${expectedSuffix}`)).toBe(true)
  })

  it('two different long-name pairs produce different suffixes', () => {
    const db = 'very_long_database_name_here'
    const t1 = 'also_a_very_long_table_name_exceeding_postgres_limit'
    const t2 = 'also_a_very_long_table_name_exceeding_postgres_limit_v2'
    expect(fdwLocalRelationName(db, t1)).not.toBe(fdwLocalRelationName(db, t2))
  })
})

describe('resolvePgHousekeepingRelation', () => {
  it('returns the prefixed name for a short table', () => {
    expect(resolvePgHousekeepingRelation('bale_db', 'raw_bale')).toBe('bale_db_raw_bale')
  })

  it('passes through a table already prefixed with the db name', () => {
    // Simulates a seed row that was already corrected
    expect(resolvePgHousekeepingRelation('bale_db', 'bale_db_raw_bale')).toBe('bale_db_raw_bale')
  })

  it('never returns the short view name for a standard table', () => {
    const result = resolvePgHousekeepingRelation('bale_db', 'raw_bale')
    expect(result).not.toBe('raw_bale')
  })
})
