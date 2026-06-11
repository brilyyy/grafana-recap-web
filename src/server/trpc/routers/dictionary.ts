import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { eq, and, or, ilike, sql, inArray, asc, count } from 'drizzle-orm'
import { router, publicProcedure, protectedProcedure } from '../init'
import { db } from '@/db'
import { responseCodeDictionary, appIdentifier, appSuccessRate } from '@/db/schema'
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

      const appIds = input?.app_ids?.length ? input.app_ids : (input?.app_id ? [input.app_id] : [])

      const conditions = []
      if (appIds.length > 0) {
        conditions.push(inArray(responseCodeDictionary.idAppIdentifier, appIds))
      }
      if (input?.error_types?.length) {
        conditions.push(inArray(responseCodeDictionary.errorType, input.error_types as ('S' | 'N' | 'Sukses')[]))
      }
      if (input?.jenis_transaksi?.length) {
        conditions.push(inArray(responseCodeDictionary.jenisTransaksi, input.jenis_transaksi))
      }
      if (input?.search) {
        const s = `%${input.search}%`
        conditions.push(
          or(
            ilike(responseCodeDictionary.rc, s),
            ilike(responseCodeDictionary.jenisTransaksi, s),
            ilike(responseCodeDictionary.rcDescription, s),
            ilike(appIdentifier.appName, s),
          )
        )
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined

      const query = db
        .select({
          id: responseCodeDictionary.id,
          id_app_identifier: responseCodeDictionary.idAppIdentifier,
          app_name: appIdentifier.appName,
          jenis_transaksi: responseCodeDictionary.jenisTransaksi,
          rc: responseCodeDictionary.rc,
          rc_description: responseCodeDictionary.rcDescription,
          error_type: responseCodeDictionary.errorType,
        })
        .from(responseCodeDictionary)
        .innerJoin(appIdentifier, eq(responseCodeDictionary.idAppIdentifier, appIdentifier.id))
        .where(where)
        .orderBy(asc(appIdentifier.appName), asc(responseCodeDictionary.jenisTransaksi), asc(responseCodeDictionary.rc))

      const entries = fetchAll ? await query : await query.limit(limit).offset(offset)

      const countResult = await db
        .select({ total: count() })
        .from(responseCodeDictionary)
        .innerJoin(appIdentifier, eq(responseCodeDictionary.idAppIdentifier, appIdentifier.id))
        .where(where)

      return { success: true, data: { entries, total: countResult[0].total, page, limit } }
    }),

  updateErrorType: protectedProcedure
    .input(z.object({ id: z.number().int(), error_type: errorTypeEnum }))
    .mutation(async ({ input, ctx }) => {
      const [existing] = await db
        .select({ idAppIdentifier: responseCodeDictionary.idAppIdentifier, jenisTransaksi: responseCodeDictionary.jenisTransaksi, rc: responseCodeDictionary.rc })
        .from(responseCodeDictionary)
        .where(eq(responseCodeDictionary.id, input.id))
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entry not found' })

      await db
        .update(responseCodeDictionary)
        .set({ errorType: input.error_type })
        .where(eq(responseCodeDictionary.id, input.id))

      // Propagate to app_success_rate rows with the same composite key
      if (existing.jenisTransaksi != null && String(existing.jenisTransaksi).trim() !== '') {
        await db
          .update(appSuccessRate)
          .set({ errorType: input.error_type })
          .where(and(
            eq(appSuccessRate.idAppIdentifier, existing.idAppIdentifier),
            eq(appSuccessRate.jenisTransaksi, existing.jenisTransaksi!),
            eq(appSuccessRate.rc, existing.rc!),
          ))
      } else {
        await db.execute(sql`
          UPDATE app_success_rate SET error_type = ${input.error_type}
          WHERE id_app_identifier = ${existing.idAppIdentifier}
            AND rc = ${existing.rc}
            AND (jenis_transaksi IS NULL OR jenis_transaksi = '')
        `)
      }

      await logAuditEvent(ctx.session.userId, ctx.session.username, 'DICTIONARY_UPDATED', 'response_code_dictionary', input.id.toString(), `Updated error_type to ${input.error_type}`)
      return { success: true, message: 'Entry updated' }
    }),

  updateDescription: protectedProcedure
    .input(z.object({ id: z.number().int(), rc_description: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [existing] = await db
        .select({ id: responseCodeDictionary.id })
        .from(responseCodeDictionary)
        .where(eq(responseCodeDictionary.id, input.id))
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entry not found' })

      await db
        .update(responseCodeDictionary)
        .set({ rcDescription: input.rc_description })
        .where(eq(responseCodeDictionary.id, input.id))

      await logAuditEvent(ctx.session.userId, ctx.session.username, 'DICTIONARY_DESCRIPTION_UPDATED', 'response_code_dictionary', input.id.toString())
      return { success: true, message: 'Description updated' }
    }),

  updateDescriptionBatch: protectedProcedure
    .input(z.object({ updates: z.array(z.object({ id: z.number().int(), rc_description: z.string() })) }))
    .mutation(async ({ input, ctx }) => {
      await db.transaction(async (tx) => {
        for (const { id, rc_description } of input.updates) {
          await tx
            .update(responseCodeDictionary)
            .set({ rcDescription: rc_description })
            .where(eq(responseCodeDictionary.id, id))
        }
      })
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'DICTIONARY_BATCH_DESCRIPTION_UPDATED', 'response_code_dictionary', null, `Updated ${input.updates.length} entries`)
      return { success: true, message: `${input.updates.length} descriptions updated` }
    }),
})
