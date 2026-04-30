import type { RecapCatalogEntry } from './types'
import { PROCEDURE_APPS } from '@scripts/success_rate/registry'
import { RECAP_MODEL_REGISTRY } from '@scripts/recap_models/registry'

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
  bale:
    'FROM raw_bale: aggregate by day, jenis, RC, status; map dictionary error_type; INSERT app_success_rate.',
  bale_bisnis:
    'FROM raw_bale_bisnis: matrix-style aggregate; INSERT app_success_rate (see raw.postgres.sql).',
  olob: 'FROM raw_olob: aggregate by day, jenis, RC; INSERT app_success_rate.',
  edc_agen: 'FROM ZTRANS0P (ITM/FDW): aggregate by TRXMDT / service; INSERT app_success_rate.',
  edc_merchant: 'FROM ZTRANS0P (ITM/FDW): aggregate; INSERT app_success_rate.',
  edc_merchant_ancol: 'FROM ZTRANS0P (ITM/FDW): aggregate; INSERT app_success_rate.',
  cms:
    'FROM cms_db_GCM_AGCM_LOG_ACTV: GROUP BY day, service, ERR_MAP, IS_ERR; INSERT app_success_rate.',
  bale_korpora: 'FROM raw_bale_korpora: aggregate; INSERT app_success_rate.',
  debit_online:
    'FROM ASID160448_ZTRANS0P + ZRSPCD0P (FDW): TRTRTY=21, TRPCCD=59; INSERT app_success_rate.',
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
GROUP BY date(a."ACTN_DT"), corp_id (normalized), jenis_transaksi, RC, RC description, status_transaksi
→ COUNT(DISTINCT ID), SUM(AMT). Full SQL: scripts/recap_models/cms_corp_daily/raw.postgres.sql.`

function customRecapEntries(): RecapCatalogEntry[] {
  const out: RecapCatalogEntry[] = []
  for (const m of RECAP_MODEL_REGISTRY) {
    if (m.modelKey === 'cms_corp_daily') {
      out.push({
        id: 'cms_corp_daily',
        recapKind: 'cms_corp_daily',
        title: 'CMS — daily recap by CORP_ID (dimensional)',
        description:
          'Aggregates CMS activity log by corporation, jenis transaksi, RC, and status per day into recap_cms_corp_daily.',
        briefProcessSummary:
          'For the processing date, deletes prior CMS rows for that day in recap_cms_corp_daily, rolls up cms_db_GCM_AGCM_LOG_ACTV with the same grain as the representative raw query, and inserts one row per (CORP, jenis, RC, deskripsi RC, status).',
        briefQuery: CMS_CORP_BRIEF_QUERY,
        outputTable: 'recap_cms_corp_daily',
        functionName: m.functionName,
        scheduleEnvVar: m.scheduleEnvVar,
        rawSqlRepoPath: 'scripts/recap_models/cms_corp_daily/raw.postgres.sql',
        scope: { type: 'fixed_app', appKey: 'cms' },
      })
    }
  }
  return out
}

export function buildRecapCatalog(): RecapCatalogEntry[] {
  return [...successRateEntries(), ...customRecapEntries()]
}

export function getCatalogEntryById(id: string): RecapCatalogEntry | undefined {
  return buildRecapCatalog().find((e) => e.id === id)
}
