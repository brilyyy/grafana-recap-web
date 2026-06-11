import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../init'
import { pool } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

const errorTypeEnum = z.enum(['S', 'N', 'Sukses'])

export const dictionaryRouter = router({
  list: publicProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(500).default(50),
      search: z.string().optional(),
      app_id: z.number().int().optional(),
      app_ids: z.array(z.number().int()).optional(),
      error_types: z.array(errorTypeEnum).optional(),
      jenis_transaksi: z.array(z.string()).optional(),
      fetch_all: z.boolean().default(false),
    }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit
      const fetchAll = input?.fetch_all ?? false
      const params: any[] = []
      let where = 'WHERE 1=1'
      const appIds = input?.app_ids?.length ? input.app_ids : (input?.app_id ? [input.app_id] : [])
      if (appIds.length > 0) { where += ` AND rcd.id_app_identifier IN (${appIds.map(() => '?').join(',')})`; params.push(...appIds) }
      if (input?.error_types?.length) { where += ` AND rcd.error_type IN (${input.error_types.map(() => '?').join(',')})`; params.push(...input.error_types) }
      if (input?.jenis_transaksi?.length) { where += ` AND rcd.jenis_transaksi IN (${input.jenis_transaksi.map(() => '?').join(',')})`; params.push(...input.jenis_transaksi) }
      if (input?.search) { where += ' AND (rcd.rc LIKE ? OR rcd.jenis_transaksi LIKE ? OR rcd.rc_description LIKE ? OR ai.app_name LIKE ?)'; params.push(`%${input.search}%`, `%${input.search}%`, `%${input.search}%`, `%${input.search}%`) }

      const [entries]: any = await pool.execute(
        `SELECT rcd.id, rcd.id_app_identifier, ai.app_name, rcd.jenis_transaksi, rcd.rc, rcd.rc_description, rcd.error_type
         FROM response_code_dictionary rcd
         JOIN app_identifier ai ON rcd.id_app_identifier = ai.id
         ${where}
         ORDER BY ai.app_name, rcd.jenis_transaksi, rcd.rc
         ${fetchAll ? '' : 'LIMIT ? OFFSET ?'}`,
        fetchAll ? params : [...params, limit, offset]
      )
      const [countResult]: any = await pool.execute(
        `SELECT COUNT(*) as total FROM response_code_dictionary rcd JOIN app_identifier ai ON rcd.id_app_identifier = ai.id ${where}`,
        params
      )
      return { success: true, data: { entries, total: Number(countResult[0].total), page, limit } }
    }),

  updateErrorType: protectedProcedure
    .input(z.object({ id: z.number().int(), error_type: errorTypeEnum }))
    .mutation(async ({ input, ctx }) => {
      const [existing]: any = await pool.execute('SELECT id_app_identifier, jenis_transaksi, rc FROM response_code_dictionary WHERE id = ?', [input.id])
      if (existing.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entry not found' })
      const entry = existing[0]
      await pool.execute('UPDATE response_code_dictionary SET error_type = ? WHERE id = ?', [input.error_type, input.id])
      // Propagate to app_success_rate rows with the same composite key (parity with PATCH /api/dictionary/update)
      if (entry.jenis_transaksi != null && String(entry.jenis_transaksi).trim() !== '') {
        await pool.execute(
          'UPDATE app_success_rate SET error_type = ? WHERE id_app_identifier = ? AND jenis_transaksi = ? AND rc = ?',
          [input.error_type, entry.id_app_identifier, entry.jenis_transaksi, entry.rc]
        )
      } else {
        await pool.execute(
          "UPDATE app_success_rate SET error_type = ? WHERE id_app_identifier = ? AND rc = ? AND (jenis_transaksi IS NULL OR jenis_transaksi = '')",
          [input.error_type, entry.id_app_identifier, entry.rc]
        )
      }
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'DICTIONARY_UPDATED', 'response_code_dictionary', input.id.toString(), `Updated error_type to ${input.error_type}`)
      return { success: true, message: 'Entry updated' }
    }),

  updateDescription: protectedProcedure
    .input(z.object({ id: z.number().int(), rc_description: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [existing]: any = await pool.execute('SELECT id FROM response_code_dictionary WHERE id = ?', [input.id])
      if (existing.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entry not found' })
      await pool.execute('UPDATE response_code_dictionary SET rc_description = ? WHERE id = ?', [input.rc_description, input.id])
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'DICTIONARY_DESCRIPTION_UPDATED', 'response_code_dictionary', input.id.toString())
      return { success: true, message: 'Description updated' }
    }),

  updateDescriptionBatch: protectedProcedure
    .input(z.object({ updates: z.array(z.object({ id: z.number().int(), rc_description: z.string() })) }))
    .mutation(async ({ input, ctx }) => {
      for (const { id, rc_description } of input.updates) {
        await pool.execute('UPDATE response_code_dictionary SET rc_description = ? WHERE id = ?', [rc_description, id])
      }
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'DICTIONARY_BATCH_DESCRIPTION_UPDATED', 'response_code_dictionary', null, `Updated ${input.updates.length} entries`)
      return { success: true, message: `${input.updates.length} descriptions updated` }
    }),
})
