import { TRPCError } from '@trpc/server'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { logAuditEvent } from '@/lib/audit'
import { router, superAdminProcedure } from '../init'

const FUNCTION_NAME_RE = /^sp_[a-z0-9_]{2,55}$/

export const appProceduresRouter = router({
  listForApp: superAdminProcedure.input(z.object({ appId: z.number().int().positive() })).query(async ({ input }) => {
    const result = await db.execute(sql`
        SELECT
          id, function_name, recap_kind, output_table, schedule_cron, description, created_at, updated_at
        FROM app_custom_procedure
        WHERE id_app_identifier = ${input.appId}
        ORDER BY created_at
      `)
    return { success: true, data: { procedures: result as any[] } }
  }),

  listAll: superAdminProcedure.query(async () => {
    const result = await db.execute(sql`
        SELECT
          acp.id, acp.function_name, acp.recap_kind, acp.output_table,
          acp.schedule_cron, acp.description, acp.id_app_identifier,
          ai.app_name,
          acp.created_at, acp.updated_at
        FROM app_custom_procedure acp
        JOIN app_identifier ai ON ai.id = acp.id_app_identifier
        ORDER BY acp.function_name
      `)
    return { success: true, data: { procedures: result as any[] } }
  }),

  reassign: superAdminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        appId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const row = (
        await db.execute(sql`SELECT function_name FROM app_custom_procedure WHERE id = ${input.id}`)
      )[0] as { function_name: string } | undefined

      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Procedure not found' })

      const app = (await db.execute(sql`SELECT app_name FROM app_identifier WHERE id = ${input.appId}`))[0] as
        | { app_name: string }
        | undefined

      if (!app) throw new TRPCError({ code: 'NOT_FOUND', message: 'Target application not found' })

      await db.execute(sql`
        UPDATE app_custom_procedure SET id_app_identifier = ${input.appId}, updated_at = NOW()
        WHERE id = ${input.id}
      `)

      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'APP_PROCEDURE_REASSIGNED',
        'app_custom_procedure',
        String(input.id),
        `function=${row.function_name}, new_app=${app.app_name} (id=${input.appId})`,
      )

      return { success: true, message: `${row.function_name} reassigned to ${app.app_name}` }
    }),

  duplicates: superAdminProcedure.query(async () => {
    const dbRows = (await db.execute(sql`
        SELECT function_name FROM app_custom_procedure
      `)) as { function_name: string }[]
    const dbFns = new Set(dbRows.map((r) => r.function_name))

    const staticEntries = (await import('@/lib/domain/recap/catalog')).buildRecapCatalog()
    const staticFns = staticEntries.map((e) => e.functionName).filter(Boolean)

    const duplicates = staticFns.filter((fn) => dbFns.has(fn))
    return {
      success: true,
      data: {
        duplicates,
        totalStatic: staticFns.length,
        totalDb: dbFns.size,
      },
    }
  }),

  register: superAdminProcedure
    .input(
      z.object({
        appId: z.number().int().positive(),
        function_name: z.string().min(1).max(63),
        recap_kind: z.string().min(1).max(64).optional().default('success_rate_daily'),
        output_table: z.string().min(1).max(255).optional().default('app_success_rate'),
        schedule_cron: z.string().max(64).optional(),
        description: z.string().max(500).optional(),
        sql_text: z.string().min(50),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Validate function name format
      if (!FUNCTION_NAME_RE.test(input.function_name)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `function_name must match /^sp_[a-z0-9_]{2,55}$/ — got: ${input.function_name}`,
        })
      }

      // Validate SQL defines exactly the declared function under public schema
      const fnHeaderRe = new RegExp(
        `^\\s*CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${input.function_name}\\s*\\(`,
        'i',
      )
      if (!fnHeaderRe.test(input.sql_text)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `SQL must begin with CREATE OR REPLACE FUNCTION public.${input.function_name}(…)`,
        })
      }

      // Execute DDL first — if it throws, we don't store bad SQL
      try {
        await db.execute(sql.raw(input.sql_text))
      } catch (e: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `PostgreSQL error installing function: ${e?.message ?? String(e)}`,
        })
      }

      // Upsert the registry row
      const upsertResult = await db.execute(sql`
        INSERT INTO app_custom_procedure
          (id_app_identifier, function_name, recap_kind, output_table, schedule_cron, description, sql_text, updated_at)
        VALUES
          (${input.appId}, ${input.function_name}, ${input.recap_kind}, ${input.output_table},
           ${input.schedule_cron ?? null}, ${input.description ?? null}, ${input.sql_text}, NOW())
        ON CONFLICT (function_name) DO UPDATE SET
          id_app_identifier = EXCLUDED.id_app_identifier,
          recap_kind        = EXCLUDED.recap_kind,
          output_table      = EXCLUDED.output_table,
          schedule_cron     = EXCLUDED.schedule_cron,
          description       = EXCLUDED.description,
          sql_text          = EXCLUDED.sql_text,
          updated_at        = NOW()
        RETURNING id
      `)
      const id = (upsertResult[0] as any)?.id

      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'APP_PROCEDURE_REGISTERED',
        'app_custom_procedure',
        String(id ?? ''),
        `function=${input.function_name}, app_id=${input.appId}`,
      )

      return { success: true, message: `Function public.${input.function_name} installed and registered.` }
    }),

  remove: superAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const row = (
      await db.execute(sql`
          SELECT function_name FROM app_custom_procedure WHERE id = ${input.id}
        `)
    )[0] as { function_name: string } | undefined

    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Procedure not found' })
    }

    const { function_name } = row

    // Drop the Postgres function (DATE param assumed by convention)
    try {
      await db.execute(sql.raw(`DROP FUNCTION IF EXISTS public.${function_name}(date)`))
    } catch (e: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to drop function: ${e?.message ?? String(e)}`,
      })
    }

    await db.execute(sql`DELETE FROM app_custom_procedure WHERE id = ${input.id}`)

    await logAuditEvent(
      ctx.session.userId,
      ctx.session.username,
      'APP_PROCEDURE_REMOVED',
      'app_custom_procedure',
      String(input.id),
      `function=${function_name}`,
    )

    return { success: true, message: `Function public.${function_name} dropped and removed.` }
  }),
})
