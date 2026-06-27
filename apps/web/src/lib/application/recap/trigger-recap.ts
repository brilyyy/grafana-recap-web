import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { catalogEntryToLogFilter, getCatalogEntryByIdAsync } from '@/lib/domain/recap/catalog'
import { normalizeAppNameToKey } from '@/lib/domain/recap/resolve-app'
import type { TriggerRecapParams, TriggerRecapResult } from '@/lib/domain/recap/types'
import { getLogger } from '@/lib/logger'

const log = getLogger('recap')

export class RecapValidationError extends Error {
  constructor(
    message: string,
    readonly code: 'BAD_DATE' | 'NOT_FOUND' | 'CONFLICT',
  ) {
    super(message)
    this.name = 'RecapValidationError'
  }
}

async function resolveTargetDate(dateParam: string | null): Promise<string> {
  if (dateParam) return dateParam
  const result = await db.execute(sql`SELECT (CURRENT_DATE - INTERVAL '1 day')::date::text AS d`)
  const row = result[0] as Record<string, unknown> | undefined
  const d = row?.d ?? row?.D
  return String(d ?? '').slice(0, 10)
}

async function validatePastDate(dateStr: string): Promise<void> {
  const todayResult = await db.execute(sql`SELECT CURRENT_DATE::text AS today`)
  const todayStr = String((todayResult[0] as any)?.today ?? '')
    .split('T')[0]
    .slice(0, 10)
  if (dateStr >= todayStr) {
    throw new RecapValidationError(
      'Cannot process future or today dates. Use a date before CURRENT_DATE in the database.',
      'BAD_DATE',
    )
  }
}

async function resolveAppForEntry(
  entry: Awaited<ReturnType<typeof getCatalogEntryByIdAsync>>,
): Promise<{ id: number; app_name: string }> {
  if (!entry) throw new RecapValidationError('Invalid catalog entry', 'NOT_FOUND')
  const appKey = entry.scope.type === 'per_app' || entry.scope.type === 'fixed_app' ? entry.scope.appKey : null
  if (!appKey) throw new RecapValidationError('Invalid catalog entry scope', 'NOT_FOUND')

  const result = await db.execute(sql`SELECT id, app_name FROM app_identifier`)
  const list = result as unknown as { id: number; app_name: string }[]
  const row = list.find((r) => normalizeAppNameToKey(r.app_name) === appKey)
  if (!row) {
    throw new RecapValidationError(`Application for key "${appKey}" not found in app_identifier`, 'NOT_FOUND')
  }
  return row
}

export async function triggerRecap(params: TriggerRecapParams): Promise<TriggerRecapResult> {
  const start = performance.now()
  log.debug({ catalogEntryId: params.catalogEntryId }, 'triggerRecap start')

  const entry = await getCatalogEntryByIdAsync(params.catalogEntryId)
  if (!entry) {
    throw new RecapValidationError(`Unknown recap catalog id: ${params.catalogEntryId}`, 'NOT_FOUND')
  }

  const dateParam = params.date
  if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      throw new RecapValidationError('Invalid date format. Use YYYY-MM-DD', 'BAD_DATE')
    }
    await validatePastDate(dateParam)
  }

  const appRow = await resolveAppForEntry(entry)
  const lf = catalogEntryToLogFilter(entry)

  const targetDate = await resolveTargetDate(dateParam)
  const dateParamForDb = dateParam || null

  if (entry.existsInDb === false) {
    throw new RecapValidationError(
      `Stored procedure public.${entry.functionName} is not deployed to this database`,
      'NOT_FOUND',
    )
  }

  await db.execute(sql`SELECT ${sql.raw(`public.${entry.functionName}`)}(${dateParamForDb}::date)`)

  const logResult = await db.execute(sql`
    SELECT * FROM app_processing_log
    WHERE processing_date = ${targetDate}
      AND (
        catalog_entry_id = ${lf.catalogEntryId}
        OR (
          catalog_entry_id IS NULL
          AND app_name = ${appRow.app_name}
          AND recap_kind = ${entry.recapKind}
        )
      )
    ORDER BY created_at DESC
    LIMIT 1
  `)
  const row = logResult[0] as Record<string, unknown> | undefined

  const logEntry = row
    ? {
        id: Number(row.id),
        status: String(row.status ?? ''),
        recordsProcessed: row.records_processed != null ? Number(row.records_processed) : null,
        recordsInserted: row.records_inserted != null ? Number(row.records_inserted) : null,
        startTime: row.start_time != null ? String(row.start_time) : null,
        endTime: row.end_time != null ? String(row.end_time) : null,
        errorMessage: row.error_message != null ? String(row.error_message) : null,
        recapKind: row.recap_kind != null ? String(row.recap_kind) : entry.recapKind,
      }
    : null

  log.info({ durationMs: Math.round((performance.now() - start) * 100) / 100, status: 'success' }, 'triggerRecap ok')

  return {
    success: true,
    message: `Recap ${entry.id} completed`,
    processingDateLabel: dateParam ?? 'H-1 (yesterday in DB)',
    targetDate,
    logEntry,
  }
}
