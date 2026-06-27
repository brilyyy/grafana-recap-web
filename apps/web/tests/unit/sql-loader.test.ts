import { describe, expect, it } from 'vitest'
import { loadProcedureMetas, parseSqlMeta, scanSqlObjects, splitSqlStatements } from '@/db/sql-loader'

describe('splitSqlStatements', () => {
  it('splits on top-level semicolons', () => {
    expect(splitSqlStatements('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('keeps a $$-quoted function body as a single statement', () => {
    const fn = `CREATE FUNCTION f() RETURNS void AS $$
BEGIN
  PERFORM 1; PERFORM 2;
END;
$$ LANGUAGE plpgsql;`
    const out = splitSqlStatements(fn)
    expect(out).toHaveLength(1)
    expect(out[0]).toContain('PERFORM 1; PERFORM 2;')
  })

  it('keeps a DO $$ block intact', () => {
    const sql = `DO $$ BEGIN CREATE TYPE x AS ENUM ('a;b'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE t (id int);`
    const out = splitSqlStatements(sql)
    expect(out).toHaveLength(2)
    expect(out[0]).toContain('DO $$')
    expect(out[1]).toContain('CREATE TABLE t')
  })

  it('ignores semicolons inside strings and line comments', () => {
    const out = splitSqlStatements("SELECT ';'; -- a; b\nSELECT 2;")
    expect(out).toHaveLength(2)
  })
})

describe('parseSqlMeta', () => {
  it('parses a @meta block including multi-line values', () => {
    const text = `/* @meta
id: sr:bale
title: Bale — success rate (daily)
brief_query: line one
line two
@endmeta */
CREATE FUNCTION x() RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;`
    const m = parseSqlMeta(text)
    expect(m.id).toBe('sr:bale')
    expect(m.title).toBe('Bale — success rate (daily)')
    expect(m.brief_query).toBe('line one\nline two')
  })

  it('returns empty when no meta block', () => {
    expect(parseSqlMeta('CREATE TABLE t (id int);')).toEqual({})
  })
})

describe('scanSqlObjects (real src/db/sql tree)', () => {
  const objects = scanSqlObjects()

  it('finds the core tables and no comment-derived phantoms', () => {
    expect(objects.tables).toContain('app_identifier')
    expect(objects.tables).toContain('scheduler_jobs')
    expect(objects.tables).not.toContain('if')
    expect(objects.tables).not.toContain('IF')
  })

  it('finds all five enums', () => {
    expect(objects.enums).toEqual(
      expect.arrayContaining(['user_role', 'requested_role', 'request_status', 'error_type_enum', 'proc_status_enum']),
    )
  })

  it('finds the success-rate + recap + housekeeping functions', () => {
    expect(objects.functions).toContain('sp_process_bale_daily')
    expect(objects.functions).toContain('sp_recap_cms_corp_daily')
    expect(objects.functions).toContain('update_updated_at_column')
  })

  it('finds indexes with their host tables', () => {
    expect(objects.indexes.some((i) => i.name === 'idx_app_name' && i.table === 'app_identifier')).toBe(true)
  })
})

describe('loadProcedureMetas (real frontmatter)', () => {
  it('builds catalog metadata for every success-rate + recap procedure', () => {
    const sr = loadProcedureMetas('success_rate')
    const rm = loadProcedureMetas('recap_models')
    expect(sr).toHaveLength(10)
    expect(rm).toHaveLength(2)
    const bale = sr.find((m) => m.functionName === 'sp_process_bale_daily')
    expect(bale?.meta.id).toBe('sr:bale')
    expect(bale?.meta.scope_type).toBe('per_app')
    expect(bale?.meta.app_key).toBe('bale')
  })
})
