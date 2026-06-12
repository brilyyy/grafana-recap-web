import { TRPCError } from '@trpc/server'
import { and, count, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { appIdentifier, appSuccessRate, responseCodeDictionary, unmappedRc } from '@/db/schema'
import { logAuditEvent } from '@/lib/audit'
import { protectedProcedure, router } from '../init'

/**
 * Assign an RC to an app_success_rate row that has none.
 * If the RC exists in the dictionary the error_type is auto-assigned,
 * otherwise the RC is queued in unmapped_rc for manual mapping.
 */
async function assignRc(tx: any, id: number, rcRaw: string, rcDescriptionRaw?: string | null) {
  const rc = rcRaw.trim()
  const rcDescription = rcDescriptionRaw?.trim() || null

  // 1. Update app_success_rate.rc and rc_description
  await tx.update(appSuccessRate).set({ rc, rcDescription, updatedAt: sql`NOW()` }).where(eq(appSuccessRate.id, id))

  // 2. Get id_app_identifier, jenis_transaksi and status_transaksi from the record
  const [record] = await tx
    .select({
      idAppIdentifier: appSuccessRate.idAppIdentifier,
      jenisTransaksi: appSuccessRate.jenisTransaksi,
      statusTransaksi: appSuccessRate.statusTransaksi,
    })
    .from(appSuccessRate)
    .where(eq(appSuccessRate.id, id))
  if (!record) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Record with id ${id} not found` })
  }

  // 3. Check whether the RC exists in the dictionary
  const [dictEntry] = await tx
    .select({ errorType: responseCodeDictionary.errorType })
    .from(responseCodeDictionary)
    .where(
      and(
        eq(responseCodeDictionary.idAppIdentifier, record.idAppIdentifier),
        eq(responseCodeDictionary.jenisTransaksi, record.jenisTransaksi || ''),
        eq(responseCodeDictionary.rc, rc),
      ),
    )

  if (dictEntry) {
    // RC in dictionary -> auto-assign error_type
    await tx
      .update(appSuccessRate)
      .set({ errorType: dictEntry.errorType, updatedAt: sql`NOW()` })
      .where(eq(appSuccessRate.id, id))
  } else {
    // RC not in dictionary -> queue in unmapped_rc (error_type stays NULL)
    await tx
      .insert(unmappedRc)
      .values({
        idAppIdentifier: record.idAppIdentifier,
        jenisTransaksi: record.jenisTransaksi || '',
        rc,
        rcDescription,
        statusTransaksi: record.statusTransaksi ?? null,
        errorType: null,
      })
      .onConflictDoUpdate({
        target: [unmappedRc.idAppIdentifier, unmappedRc.jenisTransaksi, unmappedRc.rc],
        set: { rcDescription, statusTransaksi: record.statusTransaksi ?? null },
      })
  }
}

export const noRcTransactionRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(500).default(50),
          app_id: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const offset = (page - 1) * limit

      const conditions = [isNull(appSuccessRate.rc), isNull(appSuccessRate.errorType)]
      if (input?.app_id) {
        conditions.push(eq(appSuccessRate.idAppIdentifier, input.app_id))
      }
      const where = and(...conditions)

      const baseQuery = db
        .select({
          id: appSuccessRate.id,
          id_app_identifier: appSuccessRate.idAppIdentifier,
          app_name: appIdentifier.appName,
          tanggal_transaksi: appSuccessRate.tanggalTransaksi,
          bulan: appSuccessRate.bulan,
          tahun: appSuccessRate.tahun,
          jenis_transaksi: appSuccessRate.jenisTransaksi,
          rc: appSuccessRate.rc,
          rc_description: appSuccessRate.rcDescription,
          total_transaksi: appSuccessRate.totalTransaksi,
          total_nominal: appSuccessRate.totalNominal,
          total_biaya_admin: appSuccessRate.totalBiayaAdmin,
          status_transaksi: appSuccessRate.statusTransaksi,
          error_type: appSuccessRate.errorType,
          created_at: appSuccessRate.createdAt,
          updated_at: appSuccessRate.updatedAt,
        })
        .from(appSuccessRate)
        .innerJoin(appIdentifier, eq(appSuccessRate.idAppIdentifier, appIdentifier.id))
        .where(where)
        .orderBy(sql`${appSuccessRate.createdAt} DESC`)

      const entries = await baseQuery.limit(limit).offset(offset)

      const countResult = await db.select({ total: count() }).from(appSuccessRate).where(where)

      return { success: true, data: { entries, total: countResult[0].total, page, limit } }
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), rc: z.string().min(1), rc_description: z.string().nullable().optional() }))
    .mutation(async ({ input, ctx }) => {
      await db.transaction(async (tx) => {
        await assignRc(tx, input.id, input.rc, input.rc_description)
      })
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'NO_RC_TRANSACTION_SUBMITTED',
        'app_success_rate',
        input.id.toString(),
        `Submitted RC ${input.rc.trim()} for no RC transaction`,
      )
      return { success: true, message: `RC ${input.rc.trim()} has been assigned successfully` }
    }),

  submitBatch: protectedProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({ id: z.number().int().positive(), rc: z.string().min(1), rc_description: z.string().nullable().optional() }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db.transaction(async (tx) => {
        for (const item of input.items) {
          await assignRc(tx, item.id, item.rc, item.rc_description)
        }
      })
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'NO_RC_BATCH_SUBMITTED',
        'app_success_rate',
        null,
        `Assigned RC to ${input.items.length} transactions`,
      )
      return { success: true, message: `${input.items.length} RC(s) have been assigned successfully` }
    }),
})
