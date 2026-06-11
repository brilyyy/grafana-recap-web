import { z } from 'zod'
import { eq, and, sql, asc, count } from 'drizzle-orm'
import { router, protectedProcedure } from '../init'
import { db } from '@/db'
import { unmappedRc, appIdentifier, responseCodeDictionary, appSuccessRate } from '@/db/schema'
import { logAuditEvent } from '@/lib/audit'

const errorTypeEnum = z.enum(['S', 'N', 'Sukses'])

interface MappingItem {
  id: number
  id_app_identifier: number
  jenis_transaksi: string | null
  rc: string
  error_type: 'S' | 'N' | 'Sukses'
}

/** Upsert dictionary entry, propagate error_type to app_success_rate, remove from unmapped_rc. */
async function applyMapping(tx: any, item: MappingItem) {
  const { id, id_app_identifier, jenis_transaksi, rc, error_type } = item
  const jt = jenis_transaksi || ''

  // 1. Upsert into response_code_dictionary
  await tx
    .insert(responseCodeDictionary)
    .values({ idAppIdentifier: id_app_identifier, jenisTransaksi: jt, rc, errorType: error_type })
    .onConflictDoUpdate({
      target: [responseCodeDictionary.idAppIdentifier, responseCodeDictionary.jenisTransaksi, responseCodeDictionary.rc],
      set: { errorType: error_type },
    })

  // 2. Propagate error_type to app_success_rate
  if (jenis_transaksi != null && String(jenis_transaksi).trim() !== '') {
    await tx
      .update(appSuccessRate)
      .set({ errorType: error_type })
      .where(and(
        eq(appSuccessRate.idAppIdentifier, id_app_identifier),
        eq(appSuccessRate.jenisTransaksi, jenis_transaksi),
        eq(appSuccessRate.rc, rc),
      ))
  } else {
    await tx.execute(sql`
      UPDATE app_success_rate SET error_type = ${error_type}
      WHERE id_app_identifier = ${id_app_identifier}
        AND rc = ${rc}
        AND (jenis_transaksi IS NULL OR jenis_transaksi = '')
    `)
  }

  // 3. Delete from unmapped_rc
  await tx.delete(unmappedRc).where(eq(unmappedRc.id, id))
}

export const unmappedRcRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(500).default(50), app_id: z.number().int().optional(), fetch_all: z.boolean().default(false) }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit
      const fetchAll = input?.fetch_all ?? false

      const conditions = []
      if (input?.app_id) {
        conditions.push(eq(unmappedRc.idAppIdentifier, input.app_id))
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined

      const baseQuery = db
        .select({
          id: unmappedRc.id,
          id_app_identifier: unmappedRc.idAppIdentifier,
          app_name: appIdentifier.appName,
          jenis_transaksi: unmappedRc.jenisTransaksi,
          rc: unmappedRc.rc,
          rc_description: unmappedRc.rcDescription,
          status_transaksi: unmappedRc.statusTransaksi,
          error_type: unmappedRc.errorType,
          created_at: unmappedRc.createdAt,
        })
        .from(unmappedRc)
        .innerJoin(appIdentifier, eq(unmappedRc.idAppIdentifier, appIdentifier.id))
        .where(where)
        .orderBy(sql`${unmappedRc.createdAt} DESC`)

      const entries = fetchAll ? await baseQuery : await baseQuery.limit(limit).offset(offset)

      const countResult = await db
        .select({ total: count() })
        .from(unmappedRc)
        .where(where)

      return { success: true, data: { entries, total: countResult[0].total, page, limit } }
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.number().int(), id_app_identifier: z.number().int(), jenis_transaksi: z.string().nullable(), rc: z.string().min(1), error_type: errorTypeEnum }))
    .mutation(async ({ input, ctx }) => {
      await db.transaction(async (tx) => {
        await applyMapping(tx, input)
      })
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'UNMAPPED_RC_SUBMITTED', 'unmapped_rc', input.id.toString())
      return { success: true, message: `RC mapping added successfully. RC ${input.rc} mapped to ${input.error_type}` }
    }),

  submitBatch: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number().int(), id_app_identifier: z.number().int(), jenis_transaksi: z.string().nullable(), rc: z.string().min(1), error_type: errorTypeEnum })) }))
    .mutation(async ({ input, ctx }) => {
      await db.transaction(async (tx) => {
        for (const item of input.items) {
          await applyMapping(tx, item)
        }
      })
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'UNMAPPED_RC_BATCH_SUBMITTED', 'unmapped_rc', null, `Submitted ${input.items.length} items`)
      return { success: true, message: `Successfully mapped ${input.items.length} RC(s)` }
    }),
})
