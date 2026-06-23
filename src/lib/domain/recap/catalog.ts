import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { loadProcedureMetas, type ProcedureMeta } from '@/db/sql-loader'
import { normalizeAppNameToKey } from './resolve-app'
import staticCatalog from './catalog-data.json'
import type { RecapCatalogEntry, RecapScope } from './types'

const DISPLAY_APP: Record<string, string> = {
  bale: 'Bale',
  bale_bisnis: 'Bale Bisnis',
  olob: 'OLOB',
  edc_agen: 'EDC Agen',
  edc_merchant: 'EDC Merchant',
  edc_merchant_ancol: 'EDC Merchant Ancol',
  cms: 'CMS',
  bale_korpora: 'Bale Korpora',
  debit_online: 'Debit Online',
}

/** Map a procedure file's @meta frontmatter to a catalog entry (the .sql file is the source of truth). */
function metaToEntry(m: ProcedureMeta): RecapCatalogEntry {
  const meta = m.meta
  const scope: RecapScope =
    meta.scope_type === 'fixed_app'
      ? { type: 'fixed_app', appKey: meta.app_key }
      : { type: 'per_app', appKey: meta.app_key }
  return {
    id: meta.id,
    recapKind: meta.recap_kind,
    title: meta.title,
    description: meta.description,
    briefProcessSummary: meta.brief_process_summary,
    briefQuery: meta.brief_query,
    outputTable: meta.output_table,
    functionName: meta.function_name || m.functionName,
    rawSqlRepoPath: meta.raw_sql_repo_path ?? '',
    scope,
  }
}

/**
 * Static catalog entries. In production, pre-generated from catalog-data.json
 * (built by `scripts/generate-catalog.mjs`). In dev, falls back to reading
 * .sql files from disk so new procedures appear without rebuilding.
 */
export function buildRecapCatalog(): RecapCatalogEntry[] {
  if (staticCatalog.length > 0) return staticCatalog as RecapCatalogEntry[]
  // ponytail: dev fallback, remove if catalog-data.json is always generated
  return [...loadProcedureMetas('success_rate'), ...loadProcedureMetas('recap_models')].map(metaToEntry)
}

/**
 * Fetch DB-registered procedure entries from `app_custom_procedure`.
 * Returns [] if the table doesn't exist yet (pre-migration).
 */
async function getDbProcedureEntries(): Promise<RecapCatalogEntry[]> {
  try {
    const result = await db.execute(sql`
      SELECT
        acp.function_name,
        acp.recap_kind,
        acp.output_table,
        acp.description,
        ai.app_name
      FROM app_custom_procedure acp
      JOIN app_identifier ai ON ai.id = acp.id_app_identifier
      ORDER BY acp.created_at
    `)
    return (result as any[]).map((row) => ({
      id: `cp:${row.function_name}` as string,
      recapKind: String(row.recap_kind ?? 'success_rate_daily'),
      title: row.description ? String(row.description) : `${row.app_name} — ${row.function_name} (custom)`,
      description: `Custom stored procedure for ${row.app_name}: ${row.function_name}. Output → ${row.output_table}.`,
      briefProcessSummary: `Custom stored procedure registered via UI. See sql_text in app_custom_procedure.`,
      briefQuery: `SELECT public.${row.function_name}(p_processing_date::date)`,
      outputTable: String(row.output_table ?? 'app_success_rate'),
      functionName: String(row.function_name),
      rawSqlRepoPath: '',
      scope: {
        type: 'per_app' as const,
        appKey: normalizeAppNameToKey(String(row.app_name)),
      },
    }))
  } catch {
    // Table not yet created (pre-migration) or query error — degrade gracefully
    return []
  }
}

/**
 * sp_* functions currently deployed in the public schema. Single source of
 * truth for both "is this catalog entry live" and "what's undocumented".
 */
async function getLiveSpFunctions(): Promise<{ function_name: string; description: string | null }[]> {
  try {
    const rows = await db.execute(sql`
      SELECT
        p.proname AS function_name,
        d.description
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      LEFT JOIN pg_description d ON d.objoid = p.oid
      WHERE n.nspname = 'public'
        AND p.proname LIKE 'sp_%'
        AND p.proname NOT LIKE 'sp_run_%'
      ORDER BY p.proname
    `)
    return (rows as any[]).map((r) => ({ function_name: String(r.function_name), description: r.description ?? null }))
  } catch {
    return []
  }
}

/**
 * Discover sp_* functions from pg_proc that aren't already covered by
 * the static catalog or app_custom_procedure. Catches SPs deployed
 * directly to the DB without a matching @meta .sql file.
 */
function getUndocumentedProcedures(
  liveRows: { function_name: string; description: string | null }[],
  knownFunctions: Set<string>,
): RecapCatalogEntry[] {
  return liveRows
    .filter((row) => !knownFunctions.has(row.function_name))
    .map((row) => {
      const fn = String(row.function_name)
      const appKey = fn.replace(/^sp_(?:process|recap)_/, '').replace(/_daily$/, '')
      const isRecap = fn.startsWith('sp_recap_')
      const id = isRecap ? `rc:${appKey}` : `sr:${appKey}`
      const title =
        appKey
          .split('_')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ') + (isRecap ? ' — recap (daily)' : ' — success rate (daily)')
      return {
        id,
        recapKind: isRecap ? 'recap_daily' : 'success_rate_daily',
        title,
        description: row.description ? String(row.description) : `Stored procedure: public.${fn}`,
        briefProcessSummary: row.description ? String(row.description) : '',
        briefQuery: `SELECT public.${fn}(p_processing_date::date)`,
        outputTable: isRecap ? 'app_recap_output' : 'app_success_rate',
        functionName: fn,
        rawSqlRepoPath: '',
        scope: { type: 'per_app' as const, appKey },
        existsInDb: true,
      }
    })
}

/**
 * Full catalog: static file-based entries + DB-registered custom procedures
 * + auto-discovered sp_* functions not yet in the catalog.
 * Use this in server-side tRPC procedures and trigger-recap.
 */
export async function getAllCatalogEntries(): Promise<RecapCatalogEntry[]> {
  const [staticEntries, dbEntries, liveRows] = await Promise.all([
    Promise.resolve(buildRecapCatalog()),
    getDbProcedureEntries(),
    getLiveSpFunctions(),
  ])
  const knownFunctions = new Set([...staticEntries, ...dbEntries].map((e) => e.functionName))
  const liveSet = new Set(liveRows.map((r) => r.function_name))
  const annotated = [...staticEntries, ...dbEntries].map((e) => ({ ...e, existsInDb: liveSet.has(e.functionName) }))
  const undocumented = getUndocumentedProcedures(liveRows, knownFunctions)
  return [...annotated, ...undocumented]
}

export function getCatalogEntryById(id: string): RecapCatalogEntry | undefined {
  return buildRecapCatalog().find((e) => e.id === id)
}

/** Async version — searches both static and DB-registered entries. */
export async function getCatalogEntryByIdAsync(id: string): Promise<RecapCatalogEntry | undefined> {
  const all = await getAllCatalogEntries()
  return all.find((e) => e.id === id)
}

export function catalogEntryToLogFilter(entry: RecapCatalogEntry): {
  catalogEntryId: string
  appName: string
  recapKind: string
} {
  return {
    catalogEntryId: entry.id,
    appName: DISPLAY_APP[entry.scope.appKey] ?? entry.scope.appKey,
    recapKind: entry.recapKind,
  }
}
