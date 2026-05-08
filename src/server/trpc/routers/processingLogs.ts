import { z } from 'zod'
import { router, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'
import { normalizeAppNameToKey } from '@/domain/recap/resolve-app'
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
