import { z } from 'zod'
import { router, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'

export const processingLogsRouter = router({
  list: superAdminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(200).default(50),
      app_id: z.number().int().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit
      const params: any[] = []
      let where = 'WHERE 1=1'
      if (input?.app_id) { where += ' AND apl.id_app_identifier = ?'; params.push(input.app_id) }
      if (input?.status) { where += ' AND apl.status = ?'; params.push(input.status) }

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
    .mutation(async ({ input, ctx }) => {
      const { app_id } = input
      const [apps]: any = await pool.execute('SELECT app_name FROM app_identifier WHERE id = ?', [app_id])
      if (apps.length === 0) return { success: false, message: 'Application not found' }

      const appName = apps[0].app_name.toLowerCase()
      const dateParam = input.date ?? null
      const connection = await pool.getConnection()
      try {
        const isPostgres = (connection as any).execute?.toString?.().includes('pg') ?? false
        if (isPostgres) {
          await connection.execute(`SELECT public.sp_process_${appName}_daily($1::date)`, [dateParam])
        } else {
          await connection.execute(`CALL sp_process_${appName}_daily(?)`, [dateParam])
        }
        return { success: true, message: `Manual processing for ${apps[0].app_name} completed` }
      } finally {
        connection.release()
      }
    }),
})
