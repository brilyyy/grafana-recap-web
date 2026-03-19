import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'
import { env } from '@/env'
import { logAuditEvent } from '@/lib/audit'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

export const housekeepingRouter = router({
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

      const n = row.retention_days
      let deletedCount = 0

      if (row.date_column_type === 'int_1yymmdd') {
        // TRXMDT integer format: 1YYMMDD (e.g. 1250311 = 2025-03-11)
        // Compute the integer value for the cutoff date
        if (isPostgres) {
          const result: any = await pool.execute(
            `DELETE FROM "${row.table_name}"
             WHERE "${row.date_column}" < (
               1000000
               + (EXTRACT(YEAR FROM (CURRENT_DATE - INTERVAL '${n} days'))::int % 100) * 10000
               + EXTRACT(MONTH FROM (CURRENT_DATE - INTERVAL '${n} days'))::int * 100
               + EXTRACT(DAY FROM (CURRENT_DATE - INTERVAL '${n} days'))::int
             )`
          )
          deletedCount = result?.rowCount ?? result?.[0]?.affectedRows ?? 0
        } else {
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
        }
      } else {
        // Standard timestamp/date column
        if (isPostgres) {
          const result: any = await pool.execute(
            `DELETE FROM "${row.table_name}"
             WHERE "${row.date_column}" < (CURRENT_DATE - INTERVAL '${n} days')`
          )
          deletedCount = result?.rowCount ?? result?.[0]?.affectedRows ?? 0
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
