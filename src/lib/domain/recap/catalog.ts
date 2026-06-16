import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { loadProcedureMetas, type ProcedureMeta } from '@/db/sql-loader'
import { normalizeAppNameToKey } from './resolve-app'
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
 * Static catalog entries, parsed from the @meta frontmatter of each procedure .sql under
 * src/db/sql/03_procedures/. The .sql file is the single source of truth — no separate registry.
 * Synchronous, no DB access.
 */
export function buildRecapCatalog(): RecapCatalogEntry[] {
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
 * Full catalog: static file-based entries + DB-registered custom procedures.
 * Use this in server-side tRPC procedures and trigger-recap.
 */
export async function getAllCatalogEntries(): Promise<RecapCatalogEntry[]> {
  const [staticEntries, dbEntries] = await Promise.all([Promise.resolve(buildRecapCatalog()), getDbProcedureEntries()])
  return [...staticEntries, ...dbEntries]
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
