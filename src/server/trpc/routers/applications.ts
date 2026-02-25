import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

export const applicationsRouter = router({
  list: publicProcedure.query(async () => {
    const [apps]: any = await pool.execute('SELECT id, app_name, created_at, updated_at FROM app_identifier ORDER BY app_name ASC')
    return { success: true, data: { applications: apps } }
  }),

  create: superAdminProcedure
    .input(z.object({ app_name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const [existing]: any = await pool.execute('SELECT id FROM app_identifier WHERE app_name = ?', [input.app_name])
      if (existing.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Application already exists' })
      const [, result]: any = await pool.execute('INSERT INTO app_identifier (app_name) VALUES (?)', [input.app_name])
      const id = result?.insertId ?? 0
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'APP_CREATED', 'application', id.toString(), `Created: ${input.app_name}`)
      return { success: true, message: `Application "${input.app_name}" created`, data: { id, app_name: input.app_name } }
    }),
})
