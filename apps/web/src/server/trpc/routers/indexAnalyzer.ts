import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { scanSqlObjects } from '@/db/sql-loader'
import { router, superAdminProcedure } from '../init'

/**
 * Read-only index analyzer. Surfaces unused indexes, tables that scan sequentially,
 * size/bloat, redundant (prefix-covered) indexes, and drift vs the src/db/sql/ source.
 * Executes no DDL — recommendations are copyable SQL only.
 */

export interface UnusedIndex {
  table: string
  index: string
  size: string
  sizeBytes: number
  recommendation: string
}
export interface MissingIndex {
  table: string
  seqScan: number
  idxScan: number
  liveTuples: number
  size: string
  recommendation: string
}
export interface TableSize {
  table: string
  totalSize: string
  totalBytes: number
  tableSize: string
  indexesSize: string
  liveTuples: number
  deadTuples: number
  deadPct: number
  recommendation?: string
}
export interface RedundantIndex {
  table: string
  index: string
  coveredBy: string
  columns: string
  recommendation: string
}
export interface IndexDrift {
  table: string
  index: string
  status: 'missing' | 'extra'
  recommendation: string
}

export interface IndexAnalyzerReport {
  unused: UnusedIndex[]
  missing: MissingIndex[]
  sizes: TableSize[]
  redundant: RedundantIndex[]
  drift: IndexDrift[]
  summary: { unused: number; missing: number; redundant: number; driftMissing: number; driftExtra: number }
  dbName: string
}

const num = (v: unknown): number => (v == null ? 0 : Number(v))
const str = (v: unknown): string => (v == null ? '' : String(v))

async function unusedIndexes(): Promise<UnusedIndex[]> {
  const rows = (await db.execute(sql`
    SELECT s.relname AS table, s.indexrelname AS index, s.idx_scan AS scans,
           pg_relation_size(s.indexrelid) AS size_bytes,
           pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON i.indexrelid = s.indexrelid
    WHERE s.schemaname = 'public'
      AND s.idx_scan = 0
      AND NOT i.indisunique
      AND NOT i.indisprimary
    ORDER BY pg_relation_size(s.indexrelid) DESC
  `)) as unknown as Record<string, unknown>[]
  return rows.map((r) => ({
    table: str(r.table),
    index: str(r.index),
    size: str(r.size),
    sizeBytes: num(r.size_bytes),
    recommendation: `DROP INDEX IF EXISTS "${str(r.index)}"; -- 0 scans, reclaims ${str(r.size)}`,
  }))
}

async function missingIndexes(): Promise<MissingIndex[]> {
  const rows = (await db.execute(sql`
    SELECT relname AS table, seq_scan, idx_scan, n_live_tup,
           pg_size_pretty(pg_relation_size(relid)) AS size
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
      AND seq_scan > 0
      AND COALESCE(idx_scan, 0) <= seq_scan
      AND n_live_tup > 1000
    ORDER BY seq_scan DESC
    LIMIT 50
  `)) as unknown as Record<string, unknown>[]
  return rows.map((r) => ({
    table: str(r.table),
    seqScan: num(r.seq_scan),
    idxScan: num(r.idx_scan),
    liveTuples: num(r.n_live_tup),
    size: str(r.size),
    recommendation: `Review "${str(r.table)}": ${num(r.seq_scan)} seq scans vs ${num(r.idx_scan)} index scans on ${num(r.n_live_tup)} rows — consider an index on a frequent WHERE/JOIN column.`,
  }))
}

async function tableSizes(): Promise<TableSize[]> {
  const rows = (await db.execute(sql`
    SELECT relname AS table,
           pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
           pg_total_relation_size(relid) AS total_bytes,
           pg_size_pretty(pg_relation_size(relid)) AS table_size,
           pg_size_pretty(pg_indexes_size(relid)) AS indexes_size,
           n_live_tup, n_dead_tup
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 50
  `)) as unknown as Record<string, unknown>[]
  return rows.map((r) => {
    const live = num(r.n_live_tup)
    const dead = num(r.n_dead_tup)
    const deadPct = live > 0 ? Math.round((dead / live) * 1000) / 10 : 0
    return {
      table: str(r.table),
      totalSize: str(r.total_size),
      totalBytes: num(r.total_bytes),
      tableSize: str(r.table_size),
      indexesSize: str(r.indexes_size),
      liveTuples: live,
      deadTuples: dead,
      deadPct,
      recommendation: deadPct >= 20 ? `VACUUM (ANALYZE) "${str(r.table)}"; -- ${deadPct}% dead tuples` : undefined,
    }
  })
}

/** All public indexes with ordered column lists — used for redundancy detection. */
async function indexColumns(): Promise<{ table: string; index: string; unique: boolean; cols: string[] }[]> {
  const rows = (await db.execute(sql`
    SELECT t.relname AS table, ix.relname AS index, i.indisunique AS is_unique,
           array_agg(a.attname ORDER BY k.ord) AS cols
    FROM pg_index i
    JOIN pg_class ix ON ix.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    WHERE n.nspname = 'public' AND a.attnum > 0
    GROUP BY t.relname, ix.relname, i.indisunique
  `)) as unknown as Record<string, unknown>[]
  return rows.map((r) => ({
    table: str(r.table),
    index: str(r.index),
    unique: Boolean(r.is_unique),
    cols: (r.cols as string[] | null) ?? [],
  }))
}

/** A non-unique index is redundant if its column list is a leading prefix of another index on the same table. */
function findRedundant(all: { table: string; index: string; unique: boolean; cols: string[] }[]): RedundantIndex[] {
  const out: RedundantIndex[] = []
  const isPrefix = (a: string[], b: string[]) => a.length <= b.length && a.every((c, i) => c === b[i])
  for (const idx of all) {
    if (idx.unique || idx.cols.length === 0) continue
    const cover = all.find(
      (o) =>
        o.table === idx.table && o.index !== idx.index && o.cols.length > idx.cols.length && isPrefix(idx.cols, o.cols),
    )
    if (cover) {
      out.push({
        table: idx.table,
        index: idx.index,
        coveredBy: cover.index,
        columns: idx.cols.join(', '),
        recommendation: `DROP INDEX IF EXISTS "${idx.index}"; -- (${idx.cols.join(', ')}) is a prefix of "${cover.index}" (${cover.cols.join(', ')})`,
      })
    }
  }
  return out
}

async function indexDrift(): Promise<IndexDrift[]> {
  const rows = (await db.execute(sql`
    SELECT tablename AS table, indexname AS index FROM pg_indexes WHERE schemaname = 'public'
  `)) as unknown as Record<string, unknown>[]
  const present = new Set(rows.map((r) => `${str(r.table)}.${str(r.index)}`))
  const expected = scanSqlObjects().indexes
  const expectedKeys = new Set(expected.map((e) => `${e.table}.${e.name}`))
  const drift: IndexDrift[] = []

  // Expected by src/db/sql/ but absent in DB → missing (run the indexes migration).
  for (const e of expected) {
    if (!present.has(`${e.table}.${e.name}`)) {
      drift.push({
        table: e.table,
        index: e.name,
        status: 'missing',
        recommendation: `Run the App Setup "Schema" phase — "${e.name}" on "${e.table}" is defined in src/db/sql/02_indexes but missing.`,
      })
    }
  }
  // Present in DB but not in src/db/sql/ and not a constraint-backed index → extra (informational).
  for (const r of rows) {
    const key = `${str(r.table)}.${str(r.index)}`
    const name = str(r.index)
    if (expectedKeys.has(key)) continue
    if (
      name.endsWith('_pkey') ||
      name.endsWith('_key') ||
      name.endsWith('_grain_key') ||
      name === 'unique_dictionary_entry'
    )
      continue
    drift.push({
      table: str(r.table),
      index: name,
      status: 'extra',
      recommendation: `"${name}" exists in the DB but is not defined in src/db/sql/02_indexes — add it to source or drop it.`,
    })
  }
  return drift
}

export const indexAnalyzerRouter = router({
  /** Full read-only analyzer report. */
  analyze: superAdminProcedure.query(async (): Promise<{ success: true; data: IndexAnalyzerReport }> => {
    const [unused, missing, sizes, cols, drift] = await Promise.all([
      unusedIndexes(),
      missingIndexes(),
      tableSizes(),
      indexColumns(),
      indexDrift(),
    ])
    const redundant = findRedundant(cols)
    return {
      success: true,
      data: {
        unused,
        missing,
        sizes,
        redundant,
        drift,
        summary: {
          unused: unused.length,
          missing: missing.length,
          redundant: redundant.length,
          driftMissing: drift.filter((d) => d.status === 'missing').length,
          driftExtra: drift.filter((d) => d.status === 'extra').length,
        },
        dbName: process.env.DB_NAME ?? 'unknown',
      },
    }
  }),
})
