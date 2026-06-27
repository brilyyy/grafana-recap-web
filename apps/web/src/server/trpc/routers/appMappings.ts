import { TRPCError } from '@trpc/server'
import { asc, eq } from 'drizzle-orm'
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
        app_name: appIdentifier.appName,
        created_at: appMappings.createdAt,
        updated_at: appMappings.updatedAt,
      })
      .from(appMappings)
      .innerJoin(appIdentifier, eq(appMappings.idAppIdentifier, appIdentifier.id))
      .orderBy(asc(appIdentifier.appName))
    return { success: true, data: { mappings: rows } }
  }),

  getByAppId: protectedProcedure.input(z.object({ appId: z.number().int().positive() })).query(async ({ input }) => {
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
        app_name: appIdentifier.appName,
        created_at: appMappings.createdAt,
        updated_at: appMappings.updatedAt,
      })
      .from(appMappings)
      .innerJoin(appIdentifier, eq(appMappings.idAppIdentifier, appIdentifier.id))
      .where(eq(appMappings.idAppIdentifier, input.appId))
    if (rows.length === 0) return { success: true, data: { mapping: null } }
    return { success: true, data: { mapping: rows[0] } }
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
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db
        .select({ id: appMappings.id })
        .from(appMappings)
        .where(eq(appMappings.idAppIdentifier, input.id_app_identifier))

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
          })
          .where(eq(appMappings.idAppIdentifier, input.id_app_identifier))
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
    .input(z.object({ appId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const deleted = await db
        .delete(appMappings)
        .where(eq(appMappings.idAppIdentifier, input.appId))
        .returning({ id: appMappings.id })
      if (deleted.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Mapping not found' })
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'APP_MAPPING_DELETED',
        'app_mappings',
        input.appId.toString(),
        `Deleted mapping for app_id=${input.appId}`,
      )
      return { success: true, message: 'Mapping deleted' }
    }),
})
