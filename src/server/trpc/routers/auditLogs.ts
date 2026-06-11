import { z } from 'zod'
import { eq, and, gte, lte, ilike, sql, count, desc } from 'drizzle-orm'
import { router, superAdminProcedure } from '../init'
import { db } from '@/db'
import { auditLogs } from '@/db/schema'

export const auditLogsRouter = router({
  list: superAdminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(200).default(50),
      action: z.string().optional(),
      userId: z.number().int().optional(),
      resourceType: z.string().optional(),
      username: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit

      const conditions = []
      if (input?.action) conditions.push(eq(auditLogs.action, input.action))
      if (input?.userId) conditions.push(eq(auditLogs.userId, input.userId))
      if (input?.resourceType) conditions.push(eq(auditLogs.resourceType, input.resourceType))
      if (input?.username) conditions.push(ilike(auditLogs.username, `%${input.username}%`))
      if (input?.startDate) conditions.push(gte(auditLogs.createdAt, sql`${input.startDate}::timestamp`))
      if (input?.endDate) conditions.push(lte(auditLogs.createdAt, sql`${input.endDate}::timestamp`))
      const where = conditions.length > 0 ? and(...conditions) : undefined

      const logs = await db
        .select({
          id: auditLogs.id,
          user_id: auditLogs.userId,
          username: auditLogs.username,
          action: auditLogs.action,
          resource_type: auditLogs.resourceType,
          resource_id: auditLogs.resourceId,
          details: auditLogs.details,
          ip_address: auditLogs.ipAddress,
          user_agent: auditLogs.userAgent,
          created_at: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset)

      const countResult = await db.select({ total: count() }).from(auditLogs).where(where)
      const total = countResult[0].total

      return { success: true, data: { logs, total, page, limit, totalPages: Math.ceil(total / limit) } }
    }),

  stats: superAdminProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 30

      const actionCounts = await db.execute(sql`
        SELECT action, COUNT(*)::int as count FROM audit_logs
        WHERE created_at >= NOW() - (${days} || ' days')::interval
        GROUP BY action ORDER BY count DESC LIMIT 10
      `)

      const resourceTypeCounts = await db.execute(sql`
        SELECT resource_type, COUNT(*)::int as count FROM audit_logs
        WHERE created_at >= NOW() - (${days} || ' days')::interval
        GROUP BY resource_type ORDER BY count DESC
      `)

      const dailyActivity = await db.execute(sql`
        SELECT DATE(created_at)::text as date, COUNT(*)::int as count FROM audit_logs
        WHERE created_at >= NOW() - (${days} || ' days')::interval
        GROUP BY DATE(created_at) ORDER BY date DESC
      `)

      const topUsers = await db.execute(sql`
        SELECT username, COUNT(*)::int as count FROM audit_logs
        WHERE created_at >= NOW() - (${days} || ' days')::interval AND username IS NOT NULL
        GROUP BY username ORDER BY count DESC LIMIT 10
      `)

      const totalResult = await db.execute(sql`
        SELECT COUNT(*)::int as total FROM audit_logs
        WHERE created_at >= NOW() - (${days} || ' days')::interval
      `)

      return {
        success: true,
        data: {
          total: Number(totalResult.rows[0]?.total ?? 0),
          actionCounts: actionCounts.rows || [],
          resourceTypeCounts: resourceTypeCounts.rows || [],
          dailyActivity: dailyActivity.rows || [],
          topUsers: topUsers.rows || [],
        },
      }
    }),
})
