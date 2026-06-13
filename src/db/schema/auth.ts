import { relations } from 'drizzle-orm'
import { index, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { requestedRoleEnum, requestStatusEnum, userRoleEnum } from './enums'
import { auditLogs } from './logging'

// ─── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull().default('user'),
    name: varchar('name', { length: 255 }),
    emailVerified: integer('email_verified').default(0),
    image: varchar('image', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_username').on(t.username), index('idx_email').on(t.email)],
)

export const sessions = pgTable('session', {
  id: varchar('id', { length: 255 }).primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: varchar('ip_address', { length: 255 }),
  userAgent: text('user_agent'),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export const accounts = pgTable('account', {
  id: varchar('id', { length: 255 }).primaryKey(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  userId: integer('user_id')
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
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const verifications = pgTable('verification', {
  id: varchar('id', { length: 255 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const pendingUserRequests = pgTable(
  'pending_user_requests',
  {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    requestedRole: requestedRoleEnum('requested_role').notNull(),
    requestedById: integer('requested_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: requestStatusEnum('status').notNull().default('pending'),
    approvedRole: userRoleEnum('approved_role'),
    approvedById: integer('approved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    rejectedById: integer('rejected_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_pur_status').on(t.status), index('idx_pur_requested_by').on(t.requestedById)],
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
export type PendingUserRequest = typeof pendingUserRequests.$inferSelect
export type NewPendingUserRequest = typeof pendingUserRequests.$inferInsert
