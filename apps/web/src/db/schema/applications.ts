import { relations } from 'drizzle-orm'
import { date, decimal, index, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { responseCodeDictionary, unmappedRc } from './dictionary'
import { errorTypeEnum } from './enums'
import { appProcessingLog } from './logging'

// ─── Tables ───────────────────────────────────────────────────────────────────

export const appIdentifier = pgTable('app_identifier', {
  id: serial('id').primaryKey(),
  appName: varchar('app_name', { length: 255 }).notNull().unique(),
  dbName: varchar('db_name', { length: 255 }),
  rawTableName: varchar('raw_table_name', { length: 255 }),
  retentionDays: integer('retention_days'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const appSuccessRate = pgTable(
  'app_success_rate',
  {
    id: serial('id').primaryKey(),
    idAppIdentifier: integer('id_app_identifier')
      .notNull()
      .references(() => appIdentifier.id, { onDelete: 'cascade' }),
    tanggalTransaksi: date('tanggal_transaksi').notNull(),
    bulan: varchar('bulan', { length: 20 }).notNull(),
    tahun: integer('tahun').notNull(),
    jenisTransaksi: varchar('jenis_transaksi', { length: 255 }).notNull(),
    rc: varchar('rc', { length: 255 }),
    rcDescription: varchar('rc_description', { length: 500 }),
    totalTransaksi: integer('total_transaksi'),
    totalNominal: decimal('total_nominal', { precision: 20, scale: 2 }),
    totalBiayaAdmin: decimal('total_biaya_admin', { precision: 20, scale: 2 }),
    statusTransaksi: varchar('status_transaksi', { length: 255 }),
    errorType: errorTypeEnum('error_type'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_tanggal_transaksi').on(t.tanggalTransaksi), index('idx_id_app_identifier').on(t.idAppIdentifier)],
)

export const appCustomProcedure = pgTable('app_custom_procedure', {
  id: serial('id').primaryKey(),
  idAppIdentifier: integer('id_app_identifier')
    .notNull()
    .references(() => appIdentifier.id, { onDelete: 'cascade' }),
  functionName: varchar('function_name', { length: 63 }).notNull().unique(),
  recapKind: varchar('recap_kind', { length: 64 }).notNull().default('success_rate_daily'),
  outputTable: varchar('output_table', { length: 255 }).notNull().default('app_success_rate'),
  scheduleCron: varchar('schedule_cron', { length: 64 }),
  description: varchar('description', { length: 500 }),
  sqlText: text('sql_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const appIdentifierRelations = relations(appIdentifier, ({ many }) => ({
  successRates: many(appSuccessRate),
  dictionary: many(responseCodeDictionary),
  unmappedRcs: many(unmappedRc),
  processingLogs: many(appProcessingLog),
  customProcedures: many(appCustomProcedure),
}))

export const appSuccessRateRelations = relations(appSuccessRate, ({ one }) => ({
  app: one(appIdentifier, {
    fields: [appSuccessRate.idAppIdentifier],
    references: [appIdentifier.id],
  }),
}))

export const appCustomProcedureRelations = relations(appCustomProcedure, ({ one }) => ({
  app: one(appIdentifier, {
    fields: [appCustomProcedure.idAppIdentifier],
    references: [appIdentifier.id],
  }),
}))

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppIdentifier = typeof appIdentifier.$inferSelect
export type AppSuccessRate = typeof appSuccessRate.$inferSelect
export type NewAppSuccessRate = typeof appSuccessRate.$inferInsert
export type AppCustomProcedure = typeof appCustomProcedure.$inferSelect
