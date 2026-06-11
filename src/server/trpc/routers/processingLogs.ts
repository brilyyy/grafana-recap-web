import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'
import { normalizeAppNameToKey } from '@/domain/recap/resolve-app'
import { catalogEntryToLogFilter, getCatalogEntryById } from '@/domain/recap/catalog'
import { triggerRecap, RecapValidationError } from '@/application/recap/trigger-recap'

export const processingLogsRouter = router({
  list: superAdminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(200).default(50),
      app_id: z.number().int().optional(),
      status: z.string().optional(),
      recap_kind: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit
      const params: unknown[] = []
      let where = 'WHERE 1=1'
      if (input?.app_id) {
        where += ' AND apl.id_app_identifier = ?'
        params.push(input.app_id)
      }
      if (input?.status) {
        where += ' AND apl.status = ?'
        params.push(input.status)
      }
      if (input?.recap_kind) {
        where += ' AND COALESCE(apl.recap_kind, \'success_rate_daily\') = ?'
        params.push(input.recap_kind)
      }

      const [logs]: any = await pool.execute(
        `SELECT apl.*, ai.app_name FROM app_processing_log apl
         JOIN app_identifier ai ON apl.id_app_identifier = ai.id
         ${where} ORDER BY apl.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )
      const [countResult]: any = await pool.execute(
        `SELECT COUNT(*) as total FROM app_processing_log apl ${where}`, params
      )
      return { success: true, data: { logs, total: countResult[0].total, page, limit } }
    }),

  /** Latest log per processing date for one catalog job within a month */
  byMonth: superAdminProcedure
    .input(z.object({
      catalogEntryId: z.string().min(1),
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2000).max(2100),
    }))
    .query(async ({ input }) => {
      const entry = getCatalogEntryById(input.catalogEntryId)
      if (!entry) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Unknown catalog_entry_id: ${input.catalogEntryId}` })
      }
      const logFilter = catalogEntryToLogFilter(entry)

      const startDate = `${input.year}-${String(input.month).padStart(2, '0')}-01`
      const lastDay = new Date(input.year, input.month, 0).getDate()
      const endDate = `${input.year}-${String(input.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const [logs]: any = await pool.execute(
        `SELECT DISTINCT ON (processing_date)
           id, app_name, catalog_entry_id,
           TO_CHAR(processing_date, 'YYYY-MM-DD') as processing_date,
           status, records_processed, records_inserted,
           start_time, end_time, error_message,
           COALESCE(recap_kind, 'success_rate_daily') as recap_kind
         FROM app_processing_log
         WHERE processing_date >= ?::date
           AND processing_date <= ?::date
           AND (
             catalog_entry_id = ?
             OR (
               catalog_entry_id IS NULL
               AND app_name = ?
               AND COALESCE(recap_kind, 'success_rate_daily') = ?
             )
           )
         ORDER BY processing_date DESC, created_at DESC`,
        [startDate, endDate, logFilter.catalogEntryId, logFilter.appName, logFilter.recapKind]
      )
      return { success: true, data: logs ?? [] }
    }),

  processManual: superAdminProcedure
    .input(z.object({ app_id: z.number().int(), date: z.string().optional() }))
    .mutation(async ({ input }) => {
      const [apps]: any = await pool.execute('SELECT app_name FROM app_identifier WHERE id = ?', [
        input.app_id,
      ])
      if (apps.length === 0) return { success: false, message: 'Application not found' }

      const appKey = normalizeAppNameToKey(apps[0].app_name as string)
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
