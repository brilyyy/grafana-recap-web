import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'
import { env } from '@/env'
import { logAuditEvent } from '@/lib/audit'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

/** Safe PostgreSQL/MySQL identifier for column names (matches format %I usage in DB functions). */
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
    const [rows]: any = await pool.execute(
      `SELECT id, db_name, table_name, date_column, date_column_type, retention_days, notes
       FROM raw_table_housekeeping
       ORDER BY db_name, table_name`
    )
    return { success: true, data: rows as {
      id: number
      db_name: string
      table_name: string
      date_column: string | null
      date_column_type: string | null
      retention_days: number | null
      notes: string | null
    }[] }
  }),

  updateConfig: superAdminProcedure
    .input(z.object({
      id: z.number().int(),
      retention_days: z.number().int().min(1).nullable().optional(),
      date_column: z.union([sqlIdentifierSchema, z.literal('')]).nullable().optional(),
      date_column_type: dateColumnTypeSchema.nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    }).refine(
      (i) =>
        i.retention_days !== undefined
        || i.date_column !== undefined
        || i.date_column_type !== undefined
        || i.notes !== undefined,
      { message: 'At least one field to update is required' },
    ))
    .mutation(async ({ input, ctx }) => {
      const [rows]: any = await pool.execute(
        'SELECT db_name, table_name FROM raw_table_housekeeping WHERE id = ?',
        [input.id]
      )
      if (!rows.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Raw table config not found' })

      const sets: string[] = []
      const vals: unknown[] = []

      if (input.retention_days !== undefined) {
        sets.push('retention_days = ?')
        vals.push(input.retention_days)
      }
      if (input.date_column !== undefined) {
        const col = input.date_column === '' ? null : input.date_column
        sets.push('date_column = ?')
        vals.push(col)
      }
      if (input.date_column_type !== undefined) {
        sets.push('date_column_type = ?')
        vals.push(input.date_column_type)
      }
      if (input.notes !== undefined) {
        sets.push('notes = ?')
        vals.push(input.notes)
      }

      vals.push(input.id)
      await pool.execute(
        `UPDATE raw_table_housekeeping SET ${sets.join(', ')} WHERE id = ?`,
        vals
      )

      const row = rows[0]
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
        })}`
      )
      return { success: true, message: 'Housekeeping config updated' }
    }),

  /** @deprecated Prefer updateConfig — kept for backward compatibility */
  updateRetention: superAdminProcedure
    .input(z.object({
      id: z.number().int(),
      retention_days: z.number().int().min(1).nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [rows]: any = await pool.execute(
        'SELECT db_name, table_name FROM raw_table_housekeeping WHERE id = ?',
        [input.id]
      )
      if (!rows.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Raw table config not found' })
      await pool.execute(
        'UPDATE raw_table_housekeeping SET retention_days = ? WHERE id = ?',
        [input.retention_days, input.id]
      )
      const row = rows[0]
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'HOUSEKEEPING_RETENTION_UPDATED',
        'raw_table_housekeeping',
        input.id.toString(),
        `db=${row.db_name}, table=${row.table_name}, retention_days=${input.retention_days ?? 'NULL'}`
      )
      return { success: true, message: 'Retention updated' }
    }),

  upsertRow: superAdminProcedure
    .input(z.object({
      db_name: dbNameSchema,
      table_name: tableNameSchema,
      date_column: z.union([sqlIdentifierSchema, z.literal('')]).nullable().optional(),
      date_column_type: dateColumnTypeSchema.optional(),
      retention_days: z.number().int().min(1).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const dateCol = input.date_column === undefined ? null : (input.date_column === '' ? null : input.date_column)
      const dateColType = input.date_column_type ?? 'timestamp'
      const notes = input.notes ?? null
      const retention = input.retention_days ?? null

      if (isPostgres) {
        await pool.execute(
          `INSERT INTO raw_table_housekeeping ("db_name","table_name","date_column","date_column_type","retention_days","notes")
           VALUES (?,?,?,?,?,?)
           ON CONFLICT ("db_name","table_name") DO UPDATE SET
             "date_column" = EXCLUDED."date_column",
             "date_column_type" = EXCLUDED."date_column_type",
             "retention_days" = EXCLUDED."retention_days",
             "notes" = EXCLUDED."notes"`,
          [input.db_name, input.table_name, dateCol, dateColType, retention, notes]
        )
      } else {
        await pool.execute(
          `INSERT INTO raw_table_housekeeping (\`db_name\`,\`table_name\`,\`date_column\`,\`date_column_type\`,\`retention_days\`,\`notes\`)
           VALUES (?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             \`date_column\` = VALUES(\`date_column\`),
             \`date_column_type\` = VALUES(\`date_column_type\`),
             \`retention_days\` = VALUES(\`retention_days\`),
             \`notes\` = VALUES(\`notes\`)`,
          [input.db_name, input.table_name, dateCol, dateColType, retention, notes]
        )
      }

      const [inserted]: any = await pool.execute(
        'SELECT id FROM raw_table_housekeeping WHERE db_name = ? AND table_name = ?',
        [input.db_name, input.table_name]
      )
      const id = inserted[0]?.id

      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'HOUSEKEEPING_ROW_UPSERTED',
        'raw_table_housekeeping',
        id?.toString() ?? `${input.db_name}.${input.table_name}`,
        `db=${input.db_name}, table=${input.table_name}`
      )
      return { success: true, message: 'Housekeeping row saved', id }
    }),

  deleteRow: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const [rows]: any = await pool.execute(
        'SELECT db_name, table_name FROM raw_table_housekeeping WHERE id = ?',
        [input.id]
      )
      if (!rows.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Raw table config not found' })
      await pool.execute('DELETE FROM raw_table_housekeeping WHERE id = ?', [input.id])
      const row = rows[0]
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'HOUSEKEEPING_ROW_DELETED',
        'raw_table_housekeeping',
        input.id.toString(),
        `db=${row.db_name}, table=${row.table_name}`
      )
      return { success: true, message: 'Housekeeping row removed' }
    }),

  run: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const [rows]: any = await pool.execute(
        'SELECT db_name, table_name, date_column, date_column_type, retention_days FROM raw_table_housekeeping WHERE id = ?',
        [input.id]
      )
      if (!rows.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Raw table config not found' })

      const row = rows[0] as {
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

      let deletedCount = 0

      if (isPostgres) {
        const [out]: any = await pool.execute(
          'SELECT public.sp_run_raw_housekeeping(?) AS deleted',
          [input.id]
        )
        const first = out[0] as { deleted?: number } | undefined
        deletedCount = Number(first?.deleted ?? 0)
      } else {
        const n = row.retention_days
        if (row.date_column_type === 'int_1yymmdd') {
          const [result]: any = await pool.execute(
            `DELETE FROM \`${row.db_name}\`.\`${row.table_name}\`
             WHERE \`${row.date_column}\` < (
               1000000
               + (YEAR(DATE_SUB(CURDATE(), INTERVAL ${n} DAY)) % 100) * 10000
               + MONTH(DATE_SUB(CURDATE(), INTERVAL ${n} DAY)) * 100
               + DAY(DATE_SUB(CURDATE(), INTERVAL ${n} DAY))
             )`
          )
          deletedCount = result?.affectedRows ?? 0
        } else {
          const [result]: any = await pool.execute(
            `DELETE FROM \`${row.db_name}\`.\`${row.table_name}\`
             WHERE \`${row.date_column}\` < DATE_SUB(CURDATE(), INTERVAL ${n} DAY)`
          )
          deletedCount = result?.affectedRows ?? 0
        }
      }

      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'HOUSEKEEPING_RUN',
        'raw_table_housekeeping',
        input.id.toString(),
        `db=${row.db_name}, table=${row.table_name}, retention_days=${row.retention_days}, deleted=${deletedCount}`
      )

      return {
        success: true,
        message: `Housekeeping completed for ${row.db_name}.${row.table_name}: ${deletedCount} row(s) deleted (retention: ${row.retention_days} days)`,
      }
    }),
})
