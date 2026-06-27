#!/usr/bin/env node

/**
 * Dump all sp_* stored procedures from the DB as catalog entries.
 * Output: JSON array to stdout. Pipe to a file as needed.
 *
 * Usage:
 *   pnpm db:dump-sp-catalog
 *   pnpm db:dump-sp-catalog > catalog-from-db.json
 */

import * as dotenv from 'dotenv'

dotenv.config()

import postgres from 'postgres'

const DB_HOST = process.env.DB_HOST ?? 'localhost'
const DB_PORT = parseInt(process.env.DB_PORT ?? '5432', 10)
const DB_USER = process.env.DB_USER ?? 'root'
const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
const DB_NAME = process.env.DB_NAME ?? 'platform_db'

const client = postgres({
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
})

async function main() {
  const rows = await client.unsafe(`
    SELECT
      p.proname AS function_name,
      pg_get_function_arguments(p.oid) AS args,
      pg_get_function_result(p.oid) AS return_type,
      d.description,
      CASE
        WHEN p.proname LIKE 'sp_process_%' THEN 'success_rate_daily'
        WHEN p.proname LIKE 'sp_recap_%' THEN 'recap_daily'
        ELSE 'unknown'
      END AS recap_kind,
      CASE
        WHEN p.proname LIKE 'sp_process_%_daily' THEN
          REPLACE(REPLACE(p.proname, 'sp_process_', ''), '_daily', '')
        WHEN p.proname LIKE 'sp_recap_%_daily' THEN
          REPLACE(REPLACE(p.proname, 'sp_recap_', ''), '_daily', '')
        ELSE NULL
      END AS inferred_app_key,
      CASE
        WHEN p.proname LIKE 'sp_process_%' THEN 'app_success_rate'
        WHEN p.proname LIKE 'sp_recap_%' THEN 'app_recap_output'
        ELSE 'unknown'
      END AS inferred_output_table
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_description d ON d.objoid = p.oid
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'sp_%'
    ORDER BY p.proname
  `)

  const entries = rows.map((row: any) => {
    const fn = row.function_name as string
    const appKey = (row.inferred_app_key as string) ?? fn.replace(/^sp_/, '').replace(/_daily$/, '')
    const isRecap = fn.startsWith('sp_recap_')
    const id = isRecap ? `rc:${appKey}` : `sr:${appKey}`
    const title =
      appKey
        .split('_')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') + (isRecap ? ' — recap (daily)' : ' — success rate (daily)')

    return {
      id,
      recapKind: row.recap_kind,
      title,
      description: (row.description as string) ?? `Stored procedure: public.${fn}`,
      briefProcessSummary: (row.description as string) ?? '',
      briefQuery: `SELECT public.${fn}(p_processing_date::date)`,
      outputTable: row.inferred_output_table,
      functionName: fn,
      rawSqlRepoPath: '',
      scope: { type: 'per_app', appKey },
    }
  })

  process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`)
  await client.end()
}

main().catch((e: Error) => {
  console.error(e.message)
  process.exit(1)
})
