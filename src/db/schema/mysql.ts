import {
  mysqlTable,
  varchar,
  int,
  text,
  timestamp,
  date,
  decimal,
  mysqlEnum,
  index,
  unique,
} from 'drizzle-orm/mysql-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = ['superadmin', 'admin', 'user'] as const
export const requestedRoleEnum = ['admin', 'user'] as const
export const requestStatusEnum = ['pending', 'approved', 'rejected'] as const
export const errorTypeEnum = ['S', 'N', 'Sukses'] as const

// ─── Tables ───────────────────────────────────────────────────────────────────

export const users = mysqlTable(
  'users',
  {
    id: int('id').primaryKey().autoincrement(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: mysqlEnum('role', userRoleEnum).notNull().default('user'),
    // BetterAuth extended fields (added for BetterAuth migration)
    name: varchar('name', { length: 255 }),
    emailVerified: int('email_verified').default(0),
    image: varchar('image', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    usernameIdx: index('idx_username').on(t.username),
    emailIdx: index('idx_email').on(t.email),
  })
)

export const sessions = mysqlTable('session', {
  id: varchar('id', { length: 255 }).primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  ipAddress: varchar('ip_address', { length: 255 }),
  userAgent: text('user_agent'),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export const accounts = mysqlTable('account', {
  id: varchar('id', { length: 255 }).primaryKey(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const verifications = mysqlTable('verification', {
  id: varchar('id', { length: 255 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
})

export const appIdentifier = mysqlTable('app_identifier', {
  id: int('id').primaryKey().autoincrement(),
  appName: varchar('app_name', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const appSuccessRate = mysqlTable(
  'app_success_rate',
  {
    id: int('id').primaryKey().autoincrement(),
    idAppIdentifier: int('id_app_identifier')
      .notNull()
      .references(() => appIdentifier.id, { onDelete: 'cascade' }),
    tanggalTransaksi: date('tanggal_transaksi').notNull(),
    bulan: varchar('bulan', { length: 20 }).notNull(),
    tahun: int('tahun').notNull(),
    jenisTransaksi: varchar('jenis_transaksi', { length: 255 }).notNull(),
    rc: varchar('rc', { length: 50 }),
    rcDescription: varchar('rc_description', { length: 500 }),
    totalTransaksi: int('total_transaksi'),
    totalNominal: decimal('total_nominal', { precision: 20, scale: 2 }),
    totalBiayaAdmin: decimal('total_biaya_admin', { precision: 20, scale: 2 }),
    statusTransaksi: varchar('status_transaksi', { length: 255 }),
    errorType: mysqlEnum('error_type', errorTypeEnum),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    tanggalIdx: index('idx_tanggal_transaksi').on(t.tanggalTransaksi),
    appIdIdx: index('idx_id_app_identifier').on(t.idAppIdentifier),
  })
)

export const responseCodeDictionary = mysqlTable(
  'response_code_dictionary',
  {
    id: int('id').primaryKey().autoincrement(),
    idAppIdentifier: int('id_app_identifier')
      .notNull()
      .references(() => appIdentifier.id, { onDelete: 'cascade' }),
    jenisTransaksi: varchar('jenis_transaksi', { length: 255 }),
    rc: varchar('rc', { length: 50 }),
    rcDescription: varchar('rc_description', { length: 500 }),
    errorType: mysqlEnum('error_type', errorTypeEnum).notNull(),
  },
  (t) => ({
    uniqueEntry: unique('unique_dictionary_entry').on(t.idAppIdentifier, t.jenisTransaksi, t.rc),
  })
)

export const unmappedRc = mysqlTable(
  'unmapped_rc',
  {
    id: int('id').primaryKey().autoincrement(),
    idAppIdentifier: int('id_app_identifier')
      .notNull()
      .references(() => appIdentifier.id, { onDelete: 'cascade' }),
    jenisTransaksi: varchar('jenis_transaksi', { length: 255 }),
    rc: varchar('rc', { length: 50 }),
    rcDescription: varchar('rc_description', { length: 500 }),
    statusTransaksi: varchar('status_transaksi', { length: 255 }),
    errorType: mysqlEnum('error_type', errorTypeEnum),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueEntry: unique('unique_unmapped_rc_entry').on(t.idAppIdentifier, t.jenisTransaksi, t.rc),
  })
)

export const appProcessingLog = mysqlTable(
  'app_processing_log',
  {
    id: int('id').primaryKey().autoincrement(),
    appName: varchar('app_name', { length: 255 }).notNull(),
    idAppIdentifier: int('id_app_identifier')
      .notNull()
      .references(() => appIdentifier.id, { onDelete: 'cascade' }),
    processingDate: date('processing_date').notNull(),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time'),
    status: mysqlEnum('status', ['running', 'success', 'failed']).notNull(),
    recordsProcessed: int('records_processed').default(0),
    recordsInserted: int('records_inserted').default(0),
    recordsSkipped: int('records_skipped').default(0),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    appDateIdx: index('idx_app_processing_date').on(t.appName, t.processingDate),
    statusIdx: index('idx_apl_status').on(t.status, t.createdAt),
    processingDateIdx: index('idx_app_processing_log_processing_date').on(t.processingDate),
  })
)

export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id').references(() => users.id, { onDelete: 'set null' }),
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

export const rateLimitLogs = mysqlTable(
  'rate_limit_logs',
  {
    id: int('id').primaryKey().autoincrement(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    endpoint: varchar('endpoint', { length: 255 }).notNull(),
    blockedAt: timestamp('blocked_at').defaultNow().notNull(),
  },
  (t) => ({
    ipEndpointIdx: index('idx_ip_endpoint').on(t.ipAddress, t.endpoint),
    blockedAtIdx: index('idx_blocked_at').on(t.blockedAt),
  })
)

export const pendingUserRequests = mysqlTable(
  'pending_user_requests',
  {
    id: int('id').primaryKey().autoincrement(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    requestedRole: mysqlEnum('requested_role', requestedRoleEnum).notNull(),
    requestedById: int('requested_by').references(() => users.id, { onDelete: 'set null' }),
    status: mysqlEnum('status', requestStatusEnum).notNull().default('pending'),
    approvedRole: mysqlEnum('approved_role', userRoleEnum),
    approvedById: int('approved_by').references(() => users.id, { onDelete: 'set null' }),
    rejectedById: int('rejected_by').references(() => users.id, { onDelete: 'set null' }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    statusIdx: index('idx_pur_status').on(t.status),
    requestedByIdx: index('idx_pur_requested_by').on(t.requestedById),
  })
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  auditLogs: many(auditLogs),
  sessions: many(sessions),
  accounts: many(accounts),
  sentRequests: many(pendingUserRequests, { relationName: 'requestedBy' }),
  approvedRequests: many(pendingUserRequests, { relationName: 'approvedBy' }),
  rejectedRequests: many(pendingUserRequests, { relationName: 'rejectedBy' }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const appIdentifierRelations = relations(appIdentifier, ({ many }) => ({
  successRates: many(appSuccessRate),
  dictionary: many(responseCodeDictionary),
  unmappedRcs: many(unmappedRc),
  processingLogs: many(appProcessingLog),
}))

export const appSuccessRateRelations = relations(appSuccessRate, ({ one }) => ({
  app: one(appIdentifier, { fields: [appSuccessRate.idAppIdentifier], references: [appIdentifier.id] }),
}))

export const responseCodeDictionaryRelations = relations(responseCodeDictionary, ({ one }) => ({
  app: one(appIdentifier, { fields: [responseCodeDictionary.idAppIdentifier], references: [appIdentifier.id] }),
}))

export const unmappedRcRelations = relations(unmappedRc, ({ one }) => ({
  app: one(appIdentifier, { fields: [unmappedRc.idAppIdentifier], references: [appIdentifier.id] }),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}))

export const pendingUserRequestsRelations = relations(pendingUserRequests, ({ one }) => ({
  requestedBy: one(users, {
    fields: [pendingUserRequests.requestedById],
    references: [users.id],
    relationName: 'requestedBy',
  }),
  approvedBy: one(users, {
    fields: [pendingUserRequests.approvedById],
    references: [users.id],
    relationName: 'approvedBy',
  }),
  rejectedBy: one(users, {
    fields: [pendingUserRequests.rejectedById],
    references: [users.id],
    relationName: 'rejectedBy',
  }),
}))

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type AppIdentifier = typeof appIdentifier.$inferSelect
export type AppSuccessRate = typeof appSuccessRate.$inferSelect
export type NewAppSuccessRate = typeof appSuccessRate.$inferInsert
export type ResponseCodeDictionary = typeof responseCodeDictionary.$inferSelect
export type NewResponseCodeDictionary = typeof responseCodeDictionary.$inferInsert
export type UnmappedRc = typeof unmappedRc.$inferSelect
export type NewUnmappedRc = typeof unmappedRc.$inferInsert
export type AppProcessingLog = typeof appProcessingLog.$inferSelect
export type NewAppProcessingLog = typeof appProcessingLog.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type PendingUserRequest = typeof pendingUserRequests.$inferSelect
export type NewPendingUserRequest = typeof pendingUserRequests.$inferInsert
