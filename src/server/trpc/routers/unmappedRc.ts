import { z } from 'zod'
import { router, protectedProcedure } from '../init'
import { pool } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

const errorTypeEnum = z.enum(['S', 'N', 'Sukses'])

export const unmappedRcRouter = router({
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
         ${where} ORDER BY ur.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )
      const [countResult]: any = await pool.execute(
        `SELECT COUNT(*) as total FROM unmapped_rc ur ${where}`, params
      )
      return { success: true, data: { entries: rows, total: countResult[0].total, page, limit } }
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.number().int(), id_app_identifier: z.number().int(), jenis_transaksi: z.string().nullable(), rc: z.string(), error_type: errorTypeEnum }))
    .mutation(async ({ input, ctx }) => {
      const { id, id_app_identifier, jenis_transaksi, rc, error_type } = input
      await pool.execute(
        `INSERT INTO response_code_dictionary (id_app_identifier, jenis_transaksi, rc, error_type)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE error_type = VALUES(error_type)`,
        [id_app_identifier, jenis_transaksi, rc, error_type]
      )
      await pool.execute('DELETE FROM unmapped_rc WHERE id = ?', [id])
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'UNMAPPED_RC_SUBMITTED', 'unmapped_rc', id.toString())
      return { success: true, message: 'RC mapping submitted' }
    }),

  submitBatch: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number().int(), id_app_identifier: z.number().int(), jenis_transaksi: z.string().nullable(), rc: z.string(), error_type: errorTypeEnum })) }))
    .mutation(async ({ input, ctx }) => {
      for (const item of input.items) {
        const { id, id_app_identifier, jenis_transaksi, rc, error_type } = item
        await pool.execute(
          `INSERT INTO response_code_dictionary (id_app_identifier, jenis_transaksi, rc, error_type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE error_type = VALUES(error_type)`,
          [id_app_identifier, jenis_transaksi, rc, error_type]
        )
        await pool.execute('DELETE FROM unmapped_rc WHERE id = ?', [id])
      }
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'UNMAPPED_RC_BATCH_SUBMITTED', 'unmapped_rc', null, `Submitted ${input.items.length} items`)
      return { success: true, message: `${input.items.length} RC mappings submitted` }
    }),
})
