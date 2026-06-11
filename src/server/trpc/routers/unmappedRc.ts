import { z } from 'zod'
import { router, protectedProcedure } from '../init'
import { pool } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

const errorTypeEnum = z.enum(['S', 'N', 'Sukses'])

const rcDictUpsertSql = `INSERT INTO "response_code_dictionary" ("id_app_identifier","jenis_transaksi","rc","error_type") VALUES (?,?,?,?) ON CONFLICT ("id_app_identifier","jenis_transaksi","rc") DO UPDATE SET "error_type"=EXCLUDED."error_type"`

interface MappingItem {
  id: number
  id_app_identifier: number
  jenis_transaksi: string | null
  rc: string
  error_type: 'S' | 'N' | 'Sukses'
}

/** Upsert dictionary entry, propagate error_type to app_success_rate, remove from unmapped_rc. */
async function applyMapping(connection: any, item: MappingItem) {
  const { id, id_app_identifier, jenis_transaksi, rc, error_type } = item

  // 1. Insert into response_code_dictionary with upsert
  await connection.execute(rcDictUpsertSql, [id_app_identifier, jenis_transaksi || '', rc, error_type])

  // 2. Update every app_success_rate row for the same composite key
  if (jenis_transaksi != null && String(jenis_transaksi).trim() !== '') {
    await connection.execute(
      'UPDATE app_success_rate SET error_type = ? WHERE id_app_identifier = ? AND jenis_transaksi = ? AND rc = ?',
      [error_type, id_app_identifier, jenis_transaksi, rc]
    )
  } else {
    await connection.execute(
      "UPDATE app_success_rate SET error_type = ? WHERE id_app_identifier = ? AND rc = ? AND (jenis_transaksi IS NULL OR jenis_transaksi = '')",
      [error_type, id_app_identifier, rc]
    )
  }

  // 3. Delete from unmapped_rc
  await connection.execute('DELETE FROM unmapped_rc WHERE id = ?', [id])
}

export const unmappedRcRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(500).default(50), app_id: z.number().int().optional(), fetch_all: z.boolean().default(false) }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit
      const fetchAll = input?.fetch_all ?? false
      const params: any[] = []
      let where = 'WHERE 1=1'
      if (input?.app_id) { where += ' AND ur.id_app_identifier = ?'; params.push(input.app_id) }

      const [rows]: any = await pool.execute(
        `SELECT ur.*, ai.app_name FROM unmapped_rc ur
         JOIN app_identifier ai ON ur.id_app_identifier = ai.id
         ${where} ORDER BY ur.created_at DESC ${fetchAll ? '' : 'LIMIT ? OFFSET ?'}`,
        fetchAll ? params : [...params, limit, offset]
      )
      const [countResult]: any = await pool.execute(
        `SELECT COUNT(*) as total FROM unmapped_rc ur ${where}`, params
      )
      return { success: true, data: { entries: rows, total: Number(countResult[0].total), page, limit } }
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.number().int(), id_app_identifier: z.number().int(), jenis_transaksi: z.string().nullable(), rc: z.string().min(1), error_type: errorTypeEnum }))
    .mutation(async ({ input, ctx }) => {
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        await applyMapping(connection, input)
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'UNMAPPED_RC_SUBMITTED', 'unmapped_rc', input.id.toString())
      return { success: true, message: `RC mapping added successfully. RC ${input.rc} mapped to ${input.error_type}` }
    }),

  submitBatch: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number().int(), id_app_identifier: z.number().int(), jenis_transaksi: z.string().nullable(), rc: z.string().min(1), error_type: errorTypeEnum })) }))
    .mutation(async ({ input, ctx }) => {
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        for (const item of input.items) {
          await applyMapping(connection, item)
        }
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'UNMAPPED_RC_BATCH_SUBMITTED', 'unmapped_rc', null, `Submitted ${input.items.length} items`)
      return { success: true, message: `Successfully mapped ${input.items.length} RC(s)` }
    }),
})
