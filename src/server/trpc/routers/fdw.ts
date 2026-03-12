import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

export const fdwRouter = router({
  list: publicProcedure.query(async () => {
    const [rows]: any = await pool.execute(
      'SELECT id, source_db_name, table_name, schema_name, created_at FROM fdw_source_table ORDER BY source_db_name, table_name'
    )
    return { success: true, data: { fdwSources: rows } }
  }),

  add: superAdminProcedure
    .input(z.object({
      source_db_name: z.string().min(1),
      table_name: z.string().min(1),
      schema_name: z.string().optional().default('public'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await pool.execute(
          'INSERT INTO fdw_source_table (source_db_name, table_name, schema_name) VALUES (?, ?, ?)',
          [input.source_db_name, input.table_name, input.schema_name ?? 'public']
        )
        await logAuditEvent(
          ctx.session.userId,
          ctx.session.username,
          'FDW_SOURCE_ADDED',
          'fdw_source_table',
          '',
          `source_db=${input.source_db_name}, table=${input.table_name}`
        )
        return { success: true, message: 'FDW source added. Run migration to apply FDW changes.' }
      } catch (e: any) {
        if (e?.code === '23505' || e?.message?.includes('unique') || e?.message?.includes('duplicate')) {
          throw new TRPCError({ code: 'CONFLICT', message: 'This FDW source already exists' })
        }
        throw e
      }
    }),

  remove: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const [rows]: any = await pool.execute('SELECT source_db_name, table_name FROM fdw_source_table WHERE id = ?', [input.id])
      if (rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'FDW source not found' })
      }
      await pool.execute('DELETE FROM fdw_source_table WHERE id = ?', [input.id])
      const row = rows[0]
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'FDW_SOURCE_REMOVED',
        'fdw_source_table',
        input.id.toString(),
        `source_db=${row.source_db_name}, table=${row.table_name}`
      )
      return { success: true, message: 'FDW source removed. Run migration to refresh FDW.' }
    }),
})
