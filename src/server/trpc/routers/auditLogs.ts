import { z } from 'zod'
import { router, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'
import { env } from '@/env'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

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

      let dateFilter: string
      let dateParams: any[]
      if (isPostgres) {
        dateFilter = `created_at >= NOW() - INTERVAL '${days} days'`
        dateParams = []
      } else {
        dateFilter = `created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`
        dateParams = [days]
      }

      const connection = await pool.getConnection()
      try {
        const [actionCounts]: any = await connection.execute(
          `SELECT action, COUNT(*) as count FROM audit_logs WHERE ${dateFilter} GROUP BY action ORDER BY count DESC LIMIT 10`,
          dateParams
        )
        const [resourceTypeCounts]: any = await connection.execute(
          `SELECT resource_type, COUNT(*) as count FROM audit_logs WHERE ${dateFilter} GROUP BY resource_type ORDER BY count DESC`,
          dateParams
        )
        const dateFunc = isPostgres ? 'DATE(created_at)' : 'DATE(created_at)'
        const [dailyActivity]: any = await connection.execute(
          `SELECT ${dateFunc} as date, COUNT(*) as count FROM audit_logs WHERE ${dateFilter} GROUP BY ${dateFunc} ORDER BY date DESC`,
          dateParams
        )
        const [topUsers]: any = await connection.execute(
          `SELECT username, COUNT(*) as count FROM audit_logs WHERE ${dateFilter} AND username IS NOT NULL GROUP BY username ORDER BY count DESC LIMIT 10`,
          dateParams
        )
        const [totalResult]: any = await connection.execute(
          `SELECT COUNT(*) as total FROM audit_logs WHERE ${dateFilter}`,
          dateParams
        )

        return {
          success: true,
          data: {
            total: totalResult[0]?.total || 0,
            actionCounts: actionCounts || [],
            resourceTypeCounts: resourceTypeCounts || [],
            dailyActivity: dailyActivity || [],
            topUsers: topUsers || [],
          },
        }
      } finally {
        connection.release()
      }
    }),
})
