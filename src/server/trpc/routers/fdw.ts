import { TRPCError } from '@trpc/server'
import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import { z } from 'zod'
import { db } from '@/db'
import { env } from '@/env'
import { logAuditEvent } from '@/lib/audit'
import { applyFdwConfig } from '@/lib/fdw-setup'
import { router, superAdminProcedure } from '../init'

function createFdwPool(): Pool {
  return new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  })
}

async function runFdwApply() {
  const pool = createFdwPool()
  try {
    return await applyFdwConfig(pool)
  } finally {
    await pool.end()
  }
}

export const fdwRouter = router({
  list: superAdminProcedure.query(async () => {
    const result = await db.execute(
      sql`SELECT id, source_db_name, table_name, schema_name, created_at FROM fdw_source_table ORDER BY source_db_name, table_name`,
    )
    return { success: true, data: { fdwSources: result.rows as any[] } }
  }),

  add: superAdminProcedure
    .input(
      z.object({
        source_db_name: z.string().min(1),
        table_name: z.string().min(1),
        schema_name: z.string().optional().default('public'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await db.execute(sql`
          INSERT INTO fdw_source_table (source_db_name, table_name, schema_name)
          VALUES (${input.source_db_name}, ${input.table_name}, ${input.schema_name ?? 'public'})
        `)
        await logAuditEvent(
          ctx.session.userId,
          ctx.session.username,
          'FDW_SOURCE_ADDED',
          'fdw_source_table',
          '',
          `source_db=${input.source_db_name}, table=${input.table_name}`,
        )

        const fdwResult = await runFdwApply()
        const msg =
          fdwResult.errors.length > 0
            ? `FDW source added. ${fdwResult.tablesProcessed} table(s) applied, ${fdwResult.errors.length} error(s).`
            : `FDW source added. ${fdwResult.tablesProcessed} table(s) applied successfully.`
        return { success: true, message: msg, fdwResult }
      } catch (e: any) {
        if (e?.code === '23505' || e?.message?.includes('unique') || e?.message?.includes('duplicate')) {
          throw new TRPCError({ code: 'CONFLICT', message: 'This FDW source already exists' })
        }
        throw e
      }
    }),

  remove: superAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const result = await db.execute(sql`
        SELECT source_db_name, table_name FROM fdw_source_table WHERE id = ${input.id}
      `)
    const rows = result.rows as any[]
    if (rows.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'FDW source not found' })
    }
    await db.execute(sql`DELETE FROM fdw_source_table WHERE id = ${input.id}`)
    const row = rows[0]
    await logAuditEvent(
      ctx.session.userId,
      ctx.session.username,
      'FDW_SOURCE_REMOVED',
      'fdw_source_table',
      input.id.toString(),
      `source_db=${row.source_db_name}, table=${row.table_name}`,
    )

    const fdwResult = await runFdwApply()
    const msg =
      fdwResult.errors.length > 0
        ? `FDW source removed. ${fdwResult.tablesProcessed} table(s) re-applied, ${fdwResult.errors.length} error(s).`
        : `FDW source removed. ${fdwResult.tablesProcessed} table(s) re-applied successfully.`
    return { success: true, message: msg, fdwResult }
  }),

  applyFdw: superAdminProcedure.mutation(async ({ ctx }) => {
    await logAuditEvent(
      ctx.session.userId,
      ctx.session.username,
      'FDW_MANUAL_APPLY',
      'fdw_source_table',
      '',
      'Manual FDW re-apply triggered',
    )

    const fdwResult = await runFdwApply()
    const msg =
      fdwResult.errors.length > 0
        ? `FDW re-applied: ${fdwResult.serversProcessed} server(s), ${fdwResult.tablesProcessed} table(s), ${fdwResult.errors.length} error(s).`
        : `FDW re-applied: ${fdwResult.serversProcessed} server(s), ${fdwResult.tablesProcessed} table(s) successfully.`
    return { success: true, message: msg, fdwResult }
  }),
})
