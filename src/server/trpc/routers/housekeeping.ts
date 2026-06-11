import { TRPCError } from '@trpc/server'
import { type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { logAuditEvent } from '@/lib/audit'
import { router, superAdminProcedure } from '../init'

/** Safe PostgreSQL identifier for column names */
const sqlIdentifierSchema = z
  .string()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid column name')
  .max(255)

const dateColumnTypeSchema = z.enum(['timestamp', 'int_1yymmdd'])

const dbNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid database name')

const tableNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_]+$/, 'Invalid table name')

export const housekeepingRouter = router({
  getSchedule: superAdminProcedure.query(() => {
    const schedule = process.env.HOUSEKEEPING_SCHEDULE ?? '0 2 * * *'
    return { success: true, data: { schedule } }
  }),

  list: superAdminProcedure.query(async () => {
    const result = await db.execute(sql`
      SELECT id, db_name, table_name, date_column, date_column_type, retention_days, notes
      FROM raw_table_housekeeping
      ORDER BY db_name, table_name
    `)
    return {
      success: true,
      data: result.rows as {
        id: number
        db_name: string
        table_name: string
        date_column: string | null
        date_column_type: string | null
        retention_days: number | null
        notes: string | null
      }[],
    }
  }),

  updateConfig: superAdminProcedure
    .input(
      z
        .object({
          id: z.number().int(),
          retention_days: z.number().int().min(1).nullable().optional(),
          date_column: z
            .union([sqlIdentifierSchema, z.literal('')])
            .nullable()
            .optional(),
          date_column_type: dateColumnTypeSchema.nullable().optional(),
          notes: z.string().max(500).nullable().optional(),
        })
        .refine(
          (i) =>
            i.retention_days !== undefined ||
            i.date_column !== undefined ||
            i.date_column_type !== undefined ||
            i.notes !== undefined,
          { message: 'At least one field to update is required' },
        ),
    )
    .mutation(async ({ input, ctx }) => {
      const checkResult = await db.execute(sql`
        SELECT db_name, table_name FROM raw_table_housekeeping WHERE id = ${input.id}
      `)
      if (checkResult.rows.length === 0)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Raw table config not found' })

      const setClauses: SQL[] = []
      if (input.retention_days !== undefined) {
        setClauses.push(sql`retention_days = ${input.retention_days}`)
      }
      if (input.date_column !== undefined) {
        const col = input.date_column === '' ? null : input.date_column
        setClauses.push(sql`date_column = ${col}`)
      }
      if (input.date_column_type !== undefined) {
        setClauses.push(sql`date_column_type = ${input.date_column_type}`)
      }
      if (input.notes !== undefined) {
        setClauses.push(sql`notes = ${input.notes}`)
      }

      const setSql = sql.join(setClauses, sql.raw(', '))
      await db.execute(sql`UPDATE raw_table_housekeeping SET ${setSql} WHERE id = ${input.id}`)

      const row = checkResult.rows[0] as any
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'HOUSEKEEPING_CONFIG_UPDATED',
        'raw_table_housekeeping',
        input.id.toString(),
        `db=${row.db_name}, table=${row.table_name}, updates=${JSON.stringify({
          retention_days: input.retention_days,
          date_column: input.date_column,
          date_column_type: input.date_column_type,
          notes: input.notes,
        })}`,
      )
      return { success: true, message: 'Housekeeping config updated' }
    }),

  /** @deprecated Prefer updateConfig — kept for backward compatibility */
  updateRetention: superAdminProcedure
    .input(
      z.object({
        id: z.number().int(),
        retention_days: z.number().int().min(1).nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const checkResult = await db.execute(sql`
        SELECT db_name, table_name FROM raw_table_housekeeping WHERE id = ${input.id}
      `)
      if (checkResult.rows.length === 0)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Raw table config not found' })

      await db.execute(sql`
        UPDATE raw_table_housekeeping SET retention_days = ${input.retention_days} WHERE id = ${input.id}
      `)
      const row = checkResult.rows[0] as any
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'HOUSEKEEPING_RETENTION_UPDATED',
        'raw_table_housekeeping',
        input.id.toString(),
        `db=${row.db_name}, table=${row.table_name}, retention_days=${input.retention_days ?? 'NULL'}`,
      )
      return { success: true, message: 'Retention updated' }
    }),

  upsertRow: superAdminProcedure
    .input(
      z.object({
        db_name: dbNameSchema,
        table_name: tableNameSchema,
        date_column: z
          .union([sqlIdentifierSchema, z.literal('')])
          .nullable()
          .optional(),
        date_column_type: dateColumnTypeSchema.optional(),
        retention_days: z.number().int().min(1).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const dateCol = input.date_column === undefined ? null : input.date_column === '' ? null : input.date_column
      const dateColType = input.date_column_type ?? 'timestamp'
      const notes = input.notes ?? null
      const retention = input.retention_days ?? null

      await db.execute(sql`
        INSERT INTO raw_table_housekeeping ("db_name","table_name","date_column","date_column_type","retention_days","notes")
        VALUES (${input.db_name}, ${input.table_name}, ${dateCol}, ${dateColType}, ${retention}, ${notes})
        ON CONFLICT ("db_name","table_name") DO UPDATE SET
          "date_column" = EXCLUDED."date_column",
          "date_column_type" = EXCLUDED."date_column_type",
          "retention_days" = EXCLUDED."retention_days",
          "notes" = EXCLUDED."notes"
      `)

      const inserted = await db.execute(sql`
        SELECT id FROM raw_table_housekeeping WHERE db_name = ${input.db_name} AND table_name = ${input.table_name}
      `)
      const id = (inserted.rows[0] as any)?.id

      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'HOUSEKEEPING_ROW_UPSERTED',
        'raw_table_housekeeping',
        id?.toString() ?? `${input.db_name}.${input.table_name}`,
        `db=${input.db_name}, table=${input.table_name}`,
      )
      return { success: true, message: 'Housekeeping row saved', id }
    }),

  deleteRow: superAdminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input, ctx }) => {
    const checkResult = await db.execute(sql`
        SELECT db_name, table_name FROM raw_table_housekeeping WHERE id = ${input.id}
      `)
    if (checkResult.rows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Raw table config not found' })

    await db.execute(sql`DELETE FROM raw_table_housekeeping WHERE id = ${input.id}`)
    const row = checkResult.rows[0] as any
    await logAuditEvent(
      ctx.session.userId,
      ctx.session.username,
      'HOUSEKEEPING_ROW_DELETED',
      'raw_table_housekeeping',
      input.id.toString(),
      `db=${row.db_name}, table=${row.table_name}`,
    )
    return { success: true, message: 'Housekeeping row removed' }
  }),

  run: superAdminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input, ctx }) => {
    const checkResult = await db.execute(sql`
        SELECT db_name, table_name, date_column, date_column_type, retention_days
        FROM raw_table_housekeeping WHERE id = ${input.id}
      `)
    if (checkResult.rows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Raw table config not found' })

    const row = checkResult.rows[0] as {
      db_name: string
      table_name: string
      date_column: string | null
      date_column_type: string | null
      retention_days: number | null
    }

    if (!row.retention_days) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Retention days not configured for this table' })
    }
    if (!row.date_column) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot run housekeeping on "${row.table_name}" — no date column (reference table, manual management only).`,
      })
    }

    const out = await db.execute(sql`SELECT public.sp_run_raw_housekeeping(${input.id}) AS deleted`)
    const first = out.rows[0] as { deleted?: number } | undefined
    const deletedCount = Number(first?.deleted ?? 0)

    await logAuditEvent(
      ctx.session.userId,
      ctx.session.username,
      'HOUSEKEEPING_RUN',
      'raw_table_housekeeping',
      input.id.toString(),
      `db=${row.db_name}, table=${row.table_name}, retention_days=${row.retention_days}, deleted=${deletedCount}`,
    )

    return {
      success: true,
      message: `Housekeeping completed for ${row.db_name}.${row.table_name}: ${deletedCount} row(s) deleted (retention: ${row.retention_days} days)`,
    }
  }),
})
