import { relations } from 'drizzle-orm'
import { date, decimal, index, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core'
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
  (t) => [
    index('idx_tanggal_transaksi').on(t.tanggalTransaksi),
    index('idx_id_app_identifier').on(t.idAppIdentifier),
  ],
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const appIdentifierRelations = relations(appIdentifier, ({ many }) => ({
  successRates: many(appSuccessRate),
  dictionary: many(responseCodeDictionary),
  unmappedRcs: many(unmappedRc),
  processingLogs: many(appProcessingLog),
}))

export const appSuccessRateRelations = relations(appSuccessRate, ({ one }) => ({
  app: one(appIdentifier, {
    fields: [appSuccessRate.idAppIdentifier],
    references: [appIdentifier.id],
  }),
}))

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppIdentifier = typeof appIdentifier.$inferSelect
export type AppSuccessRate = typeof appSuccessRate.$inferSelect
export type NewAppSuccessRate = typeof appSuccessRate.$inferInsert
