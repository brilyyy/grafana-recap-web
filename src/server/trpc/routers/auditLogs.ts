import { z } from 'zod'
import { router, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'

export const auditLogsRouter = router({
  list: superAdminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(200).default(50),
      action: z.string().optional(),
      userId: z.number().int().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit
      const params: any[] = []
      let where = 'WHERE 1=1'
      if (input?.action) { where += ' AND action = ?'; params.push(input.action) }
      if (input?.userId) { where += ' AND user_id = ?'; params.push(input.userId) }
      if (input?.startDate) { where += ' AND created_at >= ?'; params.push(input.startDate) }
      if (input?.endDate) { where += ' AND created_at <= ?'; params.push(input.endDate) }

      const [logs]: any = await pool.execute(
        `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )
      const [countResult]: any = await pool.execute(`SELECT COUNT(*) as total FROM audit_logs ${where}`, params)
      return { success: true, data: { logs, total: countResult[0].total, page, limit } }
    }),

  stats: superAdminProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 30
      const [stats]: any = await pool.execute(
        `SELECT action, COUNT(*) as count FROM audit_logs WHERE created_at >= NOW() - INTERVAL ? DAY GROUP BY action ORDER BY count DESC`,
        [days]
      )
      const [total]: any = await pool.execute(
        `SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= NOW() - INTERVAL ? DAY`,
        [days]
      )
      return { success: true, data: { stats, totalEvents: total[0].count, days } }
    }),
})
