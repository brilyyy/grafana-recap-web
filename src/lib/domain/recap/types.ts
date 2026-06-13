/**
 * Recap domain — daily jobs (H-1 or explicit backfill date) via PostgreSQL functions.
 */

export type RecapScope = { type: 'per_app'; appKey: string } | { type: 'fixed_app'; appKey: string }

export type RecapCatalogEntry = {
  id: string
  recapKind: string
  title: string
  description: string
  briefProcessSummary: string
  /** Short representative SQL (not the full CREATE FUNCTION) */
  briefQuery: string
  outputTable: string
  functionName: string
  scheduleEnvVar: string | null
  /** Repo-relative path to raw SQL documentation */
  rawSqlRepoPath: string
  scope: RecapScope
}

export type TriggerRecapParams = {
  catalogEntryId: string
  /** YYYY-MM-DD or null = H-1 in DB */
  date: string | null
}

export type TriggerRecapResult = {
  success: boolean
  message: string
  processingDateLabel: string
  targetDate: string
  logEntry: {
    id: number
    status: string
    recordsProcessed: number | null
    recordsInserted: number | null
    startTime: string | null
    endTime: string | null
    errorMessage: string | null
    recapKind: string | null
  } | null
}
