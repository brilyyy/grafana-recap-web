import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

export const applicationsRouter = router({
  list: publicProcedure.query(async () => {
    const [apps]: any = await pool.execute(
      'SELECT id, app_name, db_name, raw_table_name, created_at, updated_at FROM app_identifier ORDER BY app_name ASC'
    )
    return { success: true, data: { applications: apps } }
  }),

  create: superAdminProcedure
    .input(z.object({ app_name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const [existing]: any = await pool.execute('SELECT id FROM app_identifier WHERE app_name = ?', [input.app_name])
      if (existing.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Application already exists' })
      const base = input.app_name.toLowerCase().trim().replace(/[\s\-\.]+/g, '_').replace(/[^a-z0-9_]/g, '') || 'unknown'
      const dbName = `db_${base}`
      const rawTableName = `raw_${base}`
      await pool.execute(
        'INSERT INTO app_identifier (app_name, db_name, raw_table_name) VALUES (?, ?, ?)',
        [input.app_name, dbName, rawTableName]
      )
      const [rows]: any = await pool.execute('SELECT id FROM app_identifier WHERE app_name = ?', [input.app_name])
      const id = rows[0]?.id ?? 0
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'APP_CREATED', 'application', id.toString(), `Created: ${input.app_name}`)
      return { success: true, message: `Application "${input.app_name}" created`, data: { id, app_name: input.app_name } }
    }),

  updateConfig: superAdminProcedure
    .input(z.object({
      id: z.number().int(),
      db_name: z.string().min(1),
      raw_table_name: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      await pool.execute(
        'UPDATE app_identifier SET db_name = ?, raw_table_name = ? WHERE id = ?',
        [input.db_name, input.raw_table_name, input.id]
      )
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'APP_CONFIG_UPDATED', 'app_identifier', input.id.toString(), `db_name=${input.db_name}, raw_table_name=${input.raw_table_name}`)
      return { success: true, message: 'Application config updated' }
    }),
})
