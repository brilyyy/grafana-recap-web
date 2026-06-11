import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { RecapValidationError, triggerRecap } from '@/application/recap/trigger-recap'
import { db } from '@/db'
import { appIdentifier, appProcessingLog } from '@/db/schema'
import { catalogEntryToLogFilter, getCatalogEntryById } from '@/domain/recap/catalog'
import { normalizeAppNameToKey } from '@/domain/recap/resolve-app'
import { router, superAdminProcedure } from '../init'

export const processingLogsRouter = router({
  list: superAdminProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(200).default(50),
          app_id: z.number().int().optional(),
          status: z.string().optional(),
          recap_kind: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit

      const conditions = []
      if (input?.app_id) conditions.push(eq(appProcessingLog.idAppIdentifier, input.app_id))
      if (input?.status) conditions.push(eq(appProcessingLog.status, input.status as 'running' | 'success' | 'failed'))
      if (input?.recap_kind)
        conditions.push(sql`COALESCE(${appProcessingLog.recapKind}, 'success_rate_daily') = ${input.recap_kind}`)
      const where = conditions.length > 0 ? and(...conditions) : undefined

      const logs = await db
        .select({
          id: appProcessingLog.id,
          app_name: appProcessingLog.appName,
          id_app_identifier: appProcessingLog.idAppIdentifier,
          processing_date: appProcessingLog.processingDate,
          start_time: appProcessingLog.startTime,
          end_time: appProcessingLog.endTime,
          status: appProcessingLog.status,
          records_processed: appProcessingLog.recordsProcessed,
          records_inserted: appProcessingLog.recordsInserted,
          records_skipped: appProcessingLog.recordsSkipped,
          error_message: appProcessingLog.errorMessage,
          recap_kind: appProcessingLog.recapKind,
          catalog_entry_id: appProcessingLog.catalogEntryId,
          created_at: appProcessingLog.createdAt,
        })
        .from(appProcessingLog)
        .innerJoin(appIdentifier, eq(appProcessingLog.idAppIdentifier, appIdentifier.id))
        .where(where)
        .orderBy(desc(appProcessingLog.createdAt))
        .limit(limit)
        .offset(offset)

      const countResult = await db.select({ total: count() }).from(appProcessingLog).where(where)

      return { success: true, data: { logs, total: countResult[0].total, page, limit } }
    }),

  /** Latest log per processing date for one catalog job within a month */
  byMonth: superAdminProcedure
    .input(
      z.object({
        catalogEntryId: z.string().min(1),
        month: z.number().int().min(1).max(12),
        year: z.number().int().min(2000).max(2100),
      }),
    )
    .query(async ({ input }) => {
      const entry = getCatalogEntryById(input.catalogEntryId)
      if (!entry) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Unknown catalog_entry_id: ${input.catalogEntryId}` })
      }
      const logFilter = catalogEntryToLogFilter(entry)

      const startDate = `${input.year}-${String(input.month).padStart(2, '0')}-01`
      const lastDay = new Date(input.year, input.month, 0).getDate()
      const endDate = `${input.year}-${String(input.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const result = await db.execute(sql`
        SELECT DISTINCT ON (processing_date)
           id, app_name, catalog_entry_id,
           TO_CHAR(processing_date, 'YYYY-MM-DD') as processing_date,
           status, records_processed, records_inserted,
           start_time, end_time, error_message,
           COALESCE(recap_kind, 'success_rate_daily') as recap_kind
         FROM app_processing_log
         WHERE processing_date >= ${startDate}::date
           AND processing_date <= ${endDate}::date
           AND (
             catalog_entry_id = ${logFilter.catalogEntryId}
             OR (
               catalog_entry_id IS NULL
               AND app_name = ${logFilter.appName}
               AND COALESCE(recap_kind, 'success_rate_daily') = ${logFilter.recapKind}
             )
           )
         ORDER BY processing_date DESC, created_at DESC
      `)
      return { success: true, data: (result.rows ?? []) as any[] }
    }),

  processManual: superAdminProcedure
    .input(z.object({ app_id: z.number().int(), date: z.string().optional() }))
    .mutation(async ({ input }) => {
      const [app] = await db
        .select({ appName: appIdentifier.appName })
        .from(appIdentifier)
        .where(eq(appIdentifier.id, input.app_id))
      if (!app) return { success: false, message: 'Application not found' }

      const appKey = normalizeAppNameToKey(app.appName)
      try {
        const result = await triggerRecap({
          catalogEntryId: `sr:${appKey}`,
          date: input.date ?? null,
        })
        return {
          success: true,
          message: result.message,
          data: result,
        }
      } catch (e: unknown) {
        if (e instanceof RecapValidationError) {
          return { success: false, message: e.message }
        }
        throw e
      }
    }),
})
