import { z } from 'zod'
import { router, protectedProcedure } from '../init'
import { pool } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

export const noRcTransactionRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(500).default(50), app_id: z.number().int().optional() }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit
      const params: any[] = []
      let where = 'WHERE 1=1'
      if (input?.app_id) { where += ' AND ur.id_app_identifier = ?'; params.push(input.app_id) }

      const [rows]: any = await pool.execute(
        `SELECT ur.*, ai.app_name FROM unmapped_rc ur
         JOIN app_identifier ai ON ur.id_app_identifier = ai.id
         ${where} AND (ur.rc IS NULL OR ur.rc = '' OR ur.rc = '-')
         ORDER BY ur.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )
      const [countResult]: any = await pool.execute(
        `SELECT COUNT(*) as total FROM unmapped_rc ur ${where} AND (ur.rc IS NULL OR ur.rc = '' OR ur.rc = '-')`,
        params
      )
      return { success: true, data: { entries: rows, total: countResult[0].total, page, limit } }
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.number().int(), error_type: z.enum(['S', 'N', 'Sukses']) }))
    .mutation(async ({ input, ctx }) => {
      await pool.execute("UPDATE unmapped_rc SET error_type = ? WHERE id = ?", [input.error_type, input.id])
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'NO_RC_SUBMITTED', 'unmapped_rc', input.id.toString())
      return { success: true, message: 'No-RC transaction updated' }
    }),

  submitBatch: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number().int(), error_type: z.enum(['S', 'N', 'Sukses']) })) }))
    .mutation(async ({ input, ctx }) => {
      for (const { id, error_type } of input.items) {
        await pool.execute("UPDATE unmapped_rc SET error_type = ? WHERE id = ?", [error_type, id])
      }
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'NO_RC_BATCH_SUBMITTED', 'unmapped_rc', null, `Updated ${input.items.length} items`)
      return { success: true, message: `${input.items.length} updated` }
    }),
})
