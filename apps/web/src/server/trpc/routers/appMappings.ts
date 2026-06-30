import { TRPCError } from '@trpc/server'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { appIdentifier, appMappings } from '@/db/schema'
import { logAuditEvent } from '@/lib/audit'
import { protectedProcedure, router, superAdminProcedure } from '../init'

export const appMappingsRouter = router({
  list: protectedProcedure.query(async () => {
    const rows = await db
      .select({
        id: appMappings.id,
        id_app_identifier: appMappings.idAppIdentifier,
        generate_from: appMappings.generateFrom,
        fields: appMappings.fields,
        success_type_format: appMappings.successTypeFormat,
        error_type_format: appMappings.errorTypeFormat,
        ignore_errors: appMappings.ignoreErrors,
        ignore_features: appMappings.ignoreFeatures,
        date_range: appMappings.dateRange,
        app_name: appIdentifier.appName,
        created_at: appMappings.createdAt,
        updated_at: appMappings.updatedAt,
      })
      .from(appMappings)
      .innerJoin(appIdentifier, eq(appMappings.idAppIdentifier, appIdentifier.id))
      .orderBy(asc(appIdentifier.appName))
    return { success: true, data: { mappings: rows } }
  }),

  getByAppId: protectedProcedure
    .input(z.object({ appId: z.number().int().positive(), generate_from: z.enum(['db', 'excel']).optional() }))
    .query(async ({ input }) => {
      const conditions = [eq(appMappings.idAppIdentifier, input.appId)]
      if (input.generate_from) {
        conditions.push(eq(appMappings.generateFrom, input.generate_from))
      }
      const rows = await db
        .select({
          id: appMappings.id,
          id_app_identifier: appMappings.idAppIdentifier,
          generate_from: appMappings.generateFrom,
          fields: appMappings.fields,
          success_type_format: appMappings.successTypeFormat,
          error_type_format: appMappings.errorTypeFormat,
        ignore_errors: appMappings.ignoreErrors,
        ignore_features: appMappings.ignoreFeatures,
        date_range: appMappings.dateRange,
        app_name: appIdentifier.appName,
        created_at: appMappings.createdAt,
        updated_at: appMappings.updatedAt,
      })
      .from(appMappings)
      .innerJoin(appIdentifier, eq(appMappings.idAppIdentifier, appIdentifier.id))
      .where(and(...conditions))
      .orderBy(asc(appMappings.generateFrom))
      return { success: true, data: { mappings: rows } }
    }),

  upsert: superAdminProcedure
    .input(
      z.object({
        id_app_identifier: z.number().int().positive(),
        generate_from: z.enum(['db', 'excel']),
        fields: z.record(z.string(), z.any()),
        success_type_format: z.array(z.any()),
        error_type_format: z.record(z.string(), z.array(z.string())),
        ignore_errors: z.array(z.string()).default([]),
        ignore_features: z.array(z.string()).default([]),
        date_range: z.object({ from: z.string(), to: z.string() }).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db
        .select({ id: appMappings.id })
        .from(appMappings)
        .where(
          and(
            eq(appMappings.idAppIdentifier, input.id_app_identifier),
            eq(appMappings.generateFrom, input.generate_from),
          ),
        )

      if (existing.length > 0) {
        await db
          .update(appMappings)
          .set({
            generateFrom: input.generate_from,
            fields: input.fields,
            successTypeFormat: input.success_type_format,
            errorTypeFormat: input.error_type_format,
            ignoreErrors: input.ignore_errors,
            ignoreFeatures: input.ignore_features,
            dateRange: input.date_range,
          })
          .where(
            and(
              eq(appMappings.idAppIdentifier, input.id_app_identifier),
              eq(appMappings.generateFrom, input.generate_from),
            ),
          )
        await logAuditEvent(
          ctx.session.userId,
          ctx.session.username,
          'APP_MAPPING_UPDATED',
          'app_mappings',
          input.id_app_identifier.toString(),
          `Updated mapping: generate_from=${input.generate_from}`,
        )
        return { success: true, message: 'Mapping updated' }
      }

      await db.insert(appMappings).values({
        idAppIdentifier: input.id_app_identifier,
        generateFrom: input.generate_from,
        fields: input.fields,
        successTypeFormat: input.success_type_format,
        errorTypeFormat: input.error_type_format,
        ignoreErrors: input.ignore_errors,
        ignoreFeatures: input.ignore_features,
        dateRange: input.date_range,
      })
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'APP_MAPPING_CREATED',
        'app_mappings',
        input.id_app_identifier.toString(),
        `Created mapping: generate_from=${input.generate_from}`,
      )
      return { success: true, message: 'Mapping created' }
    }),

  delete: superAdminProcedure
    .input(z.object({ appId: z.number().int().positive(), generate_from: z.enum(['db', 'excel']).optional() }))
    .mutation(async ({ input, ctx }) => {
      const conditions = [eq(appMappings.idAppIdentifier, input.appId)]
      if (input.generate_from) {
        conditions.push(eq(appMappings.generateFrom, input.generate_from))
      }
      const deleted = await db
        .delete(appMappings)
        .where(and(...conditions))
        .returning({ id: appMappings.id })
      if (deleted.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Mapping not found' })
      const detail = input.generate_from
        ? `Deleted mapping generate_from=${input.generate_from} for app_id=${input.appId}`
        : `Deleted all mappings for app_id=${input.appId}`
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'APP_MAPPING_DELETED',
        'app_mappings',
        input.appId.toString(),
        detail,
      )
      return { success: true, message: 'Mapping deleted' }
    }),
})
