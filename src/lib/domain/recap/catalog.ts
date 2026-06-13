import { sql } from 'drizzle-orm'
import { RECAP_MODEL_REGISTRY } from '@scripts/recap_models/registry'
import { PROCEDURE_APPS } from '@scripts/success_rate/registry'
import { db } from '@/db'
import type { RecapCatalogEntry } from './types'
import { normalizeAppNameToKey } from './resolve-app'

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

const SCHEDULE_ENV: Record<string, string> = {
  bale: 'BALE_PROCESSING_SCHEDULE',
  bale_bisnis: 'BALE_BISNIS_PROCESSING_SCHEDULE',
  olob: 'OLOB_PROCESSING_SCHEDULE',
  edc_agen: 'EDC_AGEN_PROCESSING_SCHEDULE',
  edc_merchant: 'EDC_MERCHANT_PROCESSING_SCHEDULE',
  edc_merchant_ancol: 'EDC_MERCHANT_ANCOL_PROCESSING_SCHEDULE',
  cms: 'CMS_PROCESSING_SCHEDULE',
  bale_korpora: 'BALE_KORPORA_PROCESSING_SCHEDULE',
  debit_online: 'DEBIT_ONLINE_PROCESSING_SCHEDULE',
}

const BRIEF_SUCCESS_RATE: Record<string, string> = {
  bale: 'FROM raw_bale: aggregate by day, jenis, RC, status; map dictionary error_type; INSERT app_success_rate.',
  bale_bisnis: 'FROM raw_bale_bisnis: matrix-style aggregate; INSERT app_success_rate (see raw.postgres.sql).',
  olob: 'FROM raw_olob: aggregate by day, jenis, RC; INSERT app_success_rate.',
  edc_agen: 'FROM ZTRANS0P (ITM/FDW): aggregate by TRXMDT / service; INSERT app_success_rate.',
  edc_merchant: 'FROM ZTRANS0P (ITM/FDW): aggregate; INSERT app_success_rate.',
  edc_merchant_ancol: 'FROM ZTRANS0P (ITM/FDW): aggregate; INSERT app_success_rate.',
  cms: 'FROM cms_db_GCM_AGCM_LOG_ACTV: GROUP BY day, service, ERR_MAP, IS_ERR; INSERT app_success_rate.',
  bale_korpora: 'FROM raw_bale_korpora: aggregate; INSERT app_success_rate.',
  debit_online: 'FROM ASID160448_ZTRANS0P + ZRSPCD0P (FDW): TRTRTY=21, TRPCCD=59; INSERT app_success_rate.',
}

function successRateEntries(): RecapCatalogEntry[] {
  return PROCEDURE_APPS.map(({ appKey, procedureName }) => ({
    id: `sr:${appKey}`,
    recapKind: 'success_rate_daily',
    title: `${DISPLAY_APP[appKey] ?? appKey} — success rate (daily)`,
    description: `H-1 recap of transaction success metrics into app_success_rate for ${DISPLAY_APP[appKey] ?? appKey}.`,
    briefProcessSummary: `Reads the app raw / FDW source for the processing day, normalizes RCs, joins response_code_dictionary, and replaces rows in app_success_rate for that app and date.`,
    briefQuery: BRIEF_SUCCESS_RATE[appKey] ?? 'See scripts/success_rate/{app}/raw.postgres.sql in the repository.',
    outputTable: 'app_success_rate',
    functionName: procedureName,
    scheduleEnvVar: SCHEDULE_ENV[appKey] ?? null,
    rawSqlRepoPath: `scripts/success_rate/${appKey}/raw.postgres.sql`,
    scope: { type: 'per_app', appKey },
  }))
}

const CMS_CORP_BRIEF_QUERY = `FROM "cms_db_GCM_AGCM_LOG_ACTV" a
WHERE a."ACTN_DT" >= v_start_timestamp AND a."ACTN_DT" <= v_end_timestamp
GROUP BY date(a."ACTN_DT"), ACTN_BY_CUST_ID (as corp_id), jenis_transaksi, ERR_MAP_CD, ERR_MAP_NM, IS_ERR (same split as CMS success rate, plus per-corp)
→ COUNT(DISTINCT ID), SUM(AMT). Full SQL: scripts/recap_models/cms_corp_daily/raw.postgres.sql.`

const BALE_KORP_CORP_BRIEF_QUERY = `FROM "bale_korpora_db_GCM_AGCM_LOG_ACTV" a
WHERE a."ACTN_DT" >= v_start_timestamp AND a."ACTN_DT" <= v_end_timestamp
GROUP BY date(a."ACTN_DT"), ACTN_BY_CUST_ID (as corp_id), jenis_transaksi, ERR_MAP_CD, ERR_MAP_NM, IS_ERR (same split as Bale Korpora success rate, plus per-corp)
→ COUNT(DISTINCT ID), SUM(AMT). Full SQL: scripts/recap_models/bale_korpora_corp_daily/raw.postgres.sql.`

function customRecapEntries(): RecapCatalogEntry[] {
  const out: RecapCatalogEntry[] = []
  for (const m of RECAP_MODEL_REGISTRY) {
    if (m.modelKey === 'cms_corp_daily') {
      out.push({
        id: 'cms_corp_daily',
        recapKind: 'cms_corp_daily',
        title: 'CMS — daily recap by ACTN_BY_CUST_ID (dimensional)',
        description:
          'Aggregates CMS activity log by corporation, jenis transaksi, RC, status, and error_type per day into recap_cms_corp_daily.',
        briefProcessSummary:
          'For the processing date, deletes prior CMS rows for that day in recap_cms_corp_daily, rolls up cms_db_GCM_AGCM_LOG_ACTV one row per corporation (ACTN_BY_CUST_ID), day, jenis, RC, RC description, and IS_ERR—aligned with CMS daily success rate plus corp_id. error_type matches sp_process_cms_daily (dictionary, unmapped_rc, normalized rc).',
        briefQuery: CMS_CORP_BRIEF_QUERY,
        outputTable: 'recap_cms_corp_daily',
        functionName: m.functionName,
        scheduleEnvVar: m.scheduleEnvVar,
        rawSqlRepoPath: 'scripts/recap_models/cms_corp_daily/raw.postgres.sql',
        scope: { type: 'fixed_app', appKey: 'cms' },
      })
    } else if (m.modelKey === 'bale_korpora_corp_daily') {
      out.push({
        id: 'bale_korpora_corp_daily',
        recapKind: 'bale_korpora_corp_daily',
        title: 'Bale Korpora — daily recap by ACTN_BY_CUST_ID (dimensional)',
        description:
          'Aggregates Bale Korpora activity log by corporation, jenis transaksi, RC, status, and error_type per day into recap_bale_korpora_corp_daily.',
        briefProcessSummary:
          'For the processing date, deletes prior Bale Korpora rows for that day in recap_bale_korpora_corp_daily, rolls up bale_korpora_db_GCM_AGCM_LOG_ACTV one row per corporation (ACTN_BY_CUST_ID), day, jenis, RC, RC description, and IS_ERR—aligned with Bale Korpora daily success rate plus corp_id. error_type matches sp_process_bale_korpora_daily (dictionary, unmapped_rc, normalized rc).',
        briefQuery: BALE_KORP_CORP_BRIEF_QUERY,
        outputTable: 'recap_bale_korpora_corp_daily',
        functionName: m.functionName,
        scheduleEnvVar: m.scheduleEnvVar,
        rawSqlRepoPath: 'scripts/recap_models/bale_korpora_corp_daily/raw.postgres.sql',
        scope: { type: 'fixed_app', appKey: 'bale_korpora' },
      })
    }
  }
  return out
}

/** Static (file-based) catalog entries — synchronous, no DB access. */
export function buildRecapCatalog(): RecapCatalogEntry[] {
  return [...successRateEntries(), ...customRecapEntries()]
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
    return (result.rows as any[]).map((row) => ({
      id: `cp:${row.function_name}` as string,
      recapKind: String(row.recap_kind ?? 'success_rate_daily'),
      title: row.description ? String(row.description) : `${row.app_name} — ${row.function_name} (custom)`,
      description: `Custom stored procedure for ${row.app_name}: ${row.function_name}. Output → ${row.output_table}.`,
      briefProcessSummary: `Custom stored procedure registered via UI. See sql_text in app_custom_procedure.`,
      briefQuery: `SELECT public.${row.function_name}(p_processing_date::date)`,
      outputTable: String(row.output_table ?? 'app_success_rate'),
      functionName: String(row.function_name),
      scheduleEnvVar: null,
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
