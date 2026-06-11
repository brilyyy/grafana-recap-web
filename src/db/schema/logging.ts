import {
  pgTable,
  varchar,
  integer,
  text,
  timestamp,
  date,
  index,
  serial,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './auth'
import { appIdentifier } from './applications'

// ─── Tables ───────────────────────────────────────────────────────────────────

export const appProcessingLog = pgTable(
  'app_processing_log',
  {
    id: serial('id').primaryKey(),
    appName: varchar('app_name', { length: 255 }).notNull(),
    idAppIdentifier: integer('id_app_identifier')
      .notNull()
      .references(() => appIdentifier.id, { onDelete: 'cascade' }),
    processingDate: date('processing_date').notNull(),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time'),
    status: varchar('status', { length: 20 }).notNull().$type<'running' | 'success' | 'failed'>(),
    recordsProcessed: integer('records_processed').default(0),
    recordsInserted: integer('records_inserted').default(0),
    recordsSkipped: integer('records_skipped').default(0),
    errorMessage: text('error_message'),
    recapKind: varchar('recap_kind', { length: 64 }).notNull().default('success_rate_daily'),
    catalogEntryId: varchar('catalog_entry_id', { length: 128 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    appDateIdx: index('idx_app_processing_date').on(t.appName, t.processingDate),
    statusIdx: index('idx_apl_status').on(t.status, t.createdAt),
    processingDateIdx: index('idx_app_processing_log_processing_date').on(t.processingDate),
    catalogEntryDateIdx: index('idx_apl_catalog_entry_date').on(t.catalogEntryId, t.processingDate),
  })
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    username: varchar('username', { length: 255 }),
    action: varchar('action', { length: 255 }).notNull(),
    resourceType: varchar('resource_type', { length: 255 }).notNull(),
    resourceId: varchar('resource_id', { length: 255 }),
    details: text('details'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('idx_audit_user_id').on(t.userId),
    actionIdx: index('idx_audit_action').on(t.action),
    resourceTypeIdx: index('idx_audit_resource_type').on(t.resourceType),
    createdAtIdx: index('idx_audit_created_at').on(t.createdAt),
  })
)

export const rateLimitLogs = pgTable(
  'rate_limit_logs',
  {
    id: serial('id').primaryKey(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    endpoint: varchar('endpoint', { length: 255 }).notNull(),
    blockedAt: timestamp('blocked_at').defaultNow().notNull(),
  },
  (t) => ({
    ipEndpointIdx: index('idx_ip_endpoint').on(t.ipAddress, t.endpoint),
    blockedAtIdx: index('idx_blocked_at').on(t.blockedAt),
  })
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}))

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppProcessingLog = typeof appProcessingLog.$inferSelect
export type NewAppProcessingLog = typeof appProcessingLog.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
