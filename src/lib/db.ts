/**
 * Database access – Drizzle edition
 *
 * Exports the Drizzle `db` instance as default and as a named export.
 * The `pool` shim wraps Drizzle so all existing REST handlers continue to
 * work without changes while tRPC procedures use Drizzle directly.
 */

import { sql as drizzleSql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { env } from '@/env'

export { db as default, db }

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

/**
 * Convert a query string with `?` placeholders and a params array into a
 * Drizzle SQL template so the correct dialect placeholder is generated.
 */
function buildSql(query: string, params: any[] = []): SQL {
  const parts = query.split('?')
  const chunks: SQL[] = []
  for (let i = 0; i < parts.length; i++) {
    chunks.push(drizzleSql.raw(parts[i]))
    if (i < params.length) {
      chunks.push(drizzleSql`${params[i]}`)
    }
  }
  return drizzleSql.join(chunks, drizzleSql.raw(''))
}

/**
 * Normalize Drizzle execute result to [rows, result] format (same shape as old pool).
 */
function normalizeResult(result: any): [any[], any] {
  if (isPostgres) {
    // node-postgres via Drizzle: { rows: [...], rowCount, ... }
    return [result.rows ?? [], result]
  }
  // mysql2 via Drizzle: [rows, fields] native format
  if (Array.isArray(result)) {
    return [Array.isArray(result[0]) ? result[0] : result, result]
  }
  return [result?.rows ?? [], result]
}

/**
 * Convert `?` placeholders to PostgreSQL `$1, $2, ...` style.
 * Used inside raw-connection execute (outside of Drizzle's own template engine).
 */
function convertPgPlaceholders(query: string): string {
  let n = 1
  return query.replace(/\?/g, () => `$${n++}`)
}

// ─── Pool shim (Drizzle-backed) ───────────────────────────────────────────────

export const pool = {
  async execute(query: string, params?: any[]): Promise<[any[], any]> {
    const sqlQuery = buildSql(query, params)
    const result = await (db as any).execute(sqlQuery)
    return normalizeResult(result)
  },

  async query(query: string, params?: any[]): Promise<[any[], any]> {
    const sqlQuery = buildSql(query, params)
    const result = await (db as any).execute(sqlQuery)
    return normalizeResult(result)
  },

  /**
   * Get a raw connection from the underlying driver pool.
   * Supports beginTransaction / commit / rollback for transaction-based routes.
   */
  async getConnection() {
    const rawPool = (db as any).$client

    if (isPostgres) {
      const client = await rawPool.connect()
      return {
        release: () => client.release(),
        execute: async (q: string, p?: any[]): Promise<[any[], any]> => {
          const r = await client.query(convertPgPlaceholders(q), p)
          return [r.rows, r]
        },
        query: async (q: string, p?: any[]): Promise<[any[], any]> => {
          const r = await client.query(convertPgPlaceholders(q), p)
          return [r.rows, r]
        },
        beginTransaction: () => client.query('BEGIN'),
        commit: () => client.query('COMMIT'),
        rollback: () => client.query('ROLLBACK'),
      }
    }

    // MySQL
    const conn = await rawPool.getConnection()
    return {
      release: () => conn.release(),
      execute: async (q: string, p?: any[]): Promise<[any[], any]> => conn.execute(q, p),
      query: async (q: string, p?: any[]): Promise<[any[], any]> => conn.query(q, p),
      beginTransaction: () => conn.beginTransaction(),
      commit: () => conn.commit(),
      rollback: () => conn.rollback(),
    }
  },
}
