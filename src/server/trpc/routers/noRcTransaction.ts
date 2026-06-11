import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../init'
import { pool } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

const unmappedRcUpsertSql = `INSERT INTO "unmapped_rc" ("id_app_identifier","jenis_transaksi","rc","rc_description","status_transaksi","error_type") VALUES (?,?,?,?,?,?) ON CONFLICT ("id_app_identifier","jenis_transaksi","rc") DO UPDATE SET "rc_description"=EXCLUDED."rc_description","status_transaksi"=EXCLUDED."status_transaksi"`

/**
 * Assign an RC to an app_success_rate row that has none.
 * If the RC exists in the dictionary the error_type is auto-assigned,
 * otherwise the RC is queued in unmapped_rc for manual mapping.
 */
async function assignRc(connection: any, id: number, rcRaw: string, rcDescriptionRaw?: string | null) {
  const rc = rcRaw.trim()
  const rc_description = rcDescriptionRaw?.trim() || null

  // 1. Update app_success_rate.rc and rc_description
  await connection.execute(
    'UPDATE app_success_rate SET rc = ?, rc_description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [rc, rc_description, id]
  )

  // 2. Get id_app_identifier, jenis_transaksi and status_transaksi from the record
  const [recordResult]: any = await connection.execute(
    'SELECT id_app_identifier, jenis_transaksi, status_transaksi FROM app_success_rate WHERE id = ?',
    [id]
  )
  if (recordResult.length === 0) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Record with id ${id} not found` })
  }
  const { id_app_identifier, jenis_transaksi, status_transaksi } = recordResult[0]

  // 3. Check whether the RC exists in the dictionary
  const [dictionaryResult]: any = await connection.execute(
    'SELECT error_type FROM response_code_dictionary WHERE id_app_identifier = ? AND jenis_transaksi = ? AND rc = ?',
    [id_app_identifier, jenis_transaksi || '', rc]
  )

  if (dictionaryResult.length > 0) {
    // RC in dictionary -> auto-assign error_type
    await connection.execute(
      'UPDATE app_success_rate SET error_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [dictionaryResult[0].error_type, id]
    )
  } else {
    // RC not in dictionary -> queue in unmapped_rc (error_type stays NULL)
    await connection.execute(unmappedRcUpsertSql, [
      id_app_identifier,
      jenis_transaksi || '',
      rc,
      rc_description,
      status_transaksi ?? null,
      null,
    ])
  }
}

export const noRcTransactionRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(500).default(50), app_id: z.number().int().optional() }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit
      const params: any[] = []
      let where = 'WHERE a.rc IS NULL AND a.error_type IS NULL'
      if (input?.app_id) { where += ' AND a.id_app_identifier = ?'; params.push(input.app_id) }

      const [rows]: any = await pool.execute(
        `SELECT a.*, app.app_name FROM app_success_rate a
         LEFT JOIN app_identifier app ON a.id_app_identifier = app.id
         ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )
      const [countResult]: any = await pool.execute(
        `SELECT COUNT(*) as total FROM app_success_rate a ${where}`,
        params
      )
      return { success: true, data: { entries: rows, total: Number(countResult[0].total), page, limit } }
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.number().int(), rc: z.string().min(1), rc_description: z.string().nullable().optional() }))
    .mutation(async ({ input, ctx }) => {
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        await assignRc(connection, input.id, input.rc, input.rc_description)
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'NO_RC_TRANSACTION_SUBMITTED', 'app_success_rate', input.id.toString(), `Submitted RC ${input.rc.trim()} for no RC transaction`)
      return { success: true, message: `RC ${input.rc.trim()} has been assigned successfully` }
    }),

  submitBatch: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number().int(), rc: z.string().min(1), rc_description: z.string().nullable().optional() })).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        for (const item of input.items) {
          await assignRc(connection, item.id, item.rc, item.rc_description)
        }
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'NO_RC_BATCH_SUBMITTED', 'app_success_rate', null, `Assigned RC to ${input.items.length} transactions`)
      return { success: true, message: `${input.items.length} RC(s) have been assigned successfully` }
    }),
})
