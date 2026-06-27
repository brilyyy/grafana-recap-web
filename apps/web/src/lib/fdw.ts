import { createHash } from 'node:crypto'

/**
 * Build the local PostgreSQL identifier for a prefixed foreign table: `{sourceDb}_{tableName}`.
 * When the raw concatenation would exceed PostgreSQL's 63-byte identifier limit the name is
 * truncated to 55 chars and a 7-hex-char deterministic suffix is appended.
 *
 * Must stay in sync with the same function in src/db/migrate.ts.
 */
export function fdwLocalRelationName(sourceDb: string, tableName: string): string {
  const raw = `${sourceDb}_${tableName}`
  if (raw.length <= 63) return raw
  const suffix = createHash('md5').update(`${sourceDb}:${tableName}`).digest('hex').slice(0, 7)
  return `${raw.slice(0, 55)}_${suffix}`
}

/**
 * Resolve the actual PostgreSQL relation that housekeeping DELETEs from.
 *
 * FDW setup imports each remote table as a prefixed foreign table
 * `{db_name}_{table_name}` (e.g. bale_db + raw_bale → bale_db_raw_bale) and
 * optionally creates a compatibility VIEW with the short name (raw_bale).
 * DELETEing through a view of a foreign table is unreliable; the prefixed
 * foreign table is the correct target.
 *
 * If `table_name` already starts with `{db_name}_` the seed has already been
 * corrected — return it as-is.
 */
export function resolvePgHousekeepingRelation(dbName: string, tableName: string): string {
  if (tableName.startsWith(`${dbName}_`)) return tableName
  return fdwLocalRelationName(dbName, tableName)
}
