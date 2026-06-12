import { TRPCError } from '@trpc/server'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { appIdentifier } from '@/db/schema'
import { logAuditEvent } from '@/lib/audit'
import { publicProcedure, router, superAdminProcedure } from '../init'

export const applicationsRouter = router({
  list: publicProcedure.query(async () => {
    const apps = await db
      .select({
        id: appIdentifier.id,
        app_name: appIdentifier.appName,
        db_name: appIdentifier.dbName,
        raw_table_name: appIdentifier.rawTableName,
        created_at: appIdentifier.createdAt,
        updated_at: appIdentifier.updatedAt,
      })
      .from(appIdentifier)
      .orderBy(asc(appIdentifier.appName))
    return { success: true, data: { applications: apps } }
  }),

  create: superAdminProcedure.input(z.object({ app_name: z.string().min(1) })).mutation(async ({ input, ctx }) => {
    const existing = await db
      .select({ id: appIdentifier.id })
      .from(appIdentifier)
      .where(eq(appIdentifier.appName, input.app_name))
    if (existing.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Application already exists' })
    const base =
      input.app_name
        .toLowerCase()
        .trim()
        .replace(/[\s\-.]+/g, '_')
        .replace(/[^a-z0-9_]/g, '') || 'unknown'
    const dbName = `${base}_db`
    const rawTableName = `raw_${base}`
    const inserted = await db
      .insert(appIdentifier)
      .values({ appName: input.app_name, dbName, rawTableName })
      .returning({ id: appIdentifier.id })
    const id = inserted[0]?.id ?? ''
    await logAuditEvent(
      ctx.session.userId,
      ctx.session.username,
      'APP_CREATED',
      'application',
      id.toString(),
      `Created: ${input.app_name}`,
    )
    return { success: true, message: `Application "${input.app_name}" created`, data: { id, app_name: input.app_name } }
  }),

  updateConfig: superAdminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        db_name: z.string().min(1),
        raw_table_name: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db
        .update(appIdentifier)
        .set({ dbName: input.db_name, rawTableName: input.raw_table_name })
        .where(eq(appIdentifier.id, input.id))
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'APP_CONFIG_UPDATED',
        'app_identifier',
        input.id.toString(),
        `db_name=${input.db_name}, raw_table_name=${input.raw_table_name}`,
      )
      return { success: true, message: 'Application config updated' }
    }),
})
