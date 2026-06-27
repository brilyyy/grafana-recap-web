import { boolean, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const schedulerJobs = pgTable('scheduler_jobs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  procedure: varchar('procedure', { length: 255 }).notNull().unique(),
  schedule: varchar('schedule', { length: 100 }).notNull().default('1 0 * * *'),
  timezone: varchar('timezone', { length: 100 }).default('Asia/Jakarta'),
  enabled: boolean('enabled').default(true).notNull(),
  lastRunAt: timestamp('last_run_at'),
  lastStatus: varchar('last_status', { length: 50 }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type SchedulerJob = typeof schedulerJobs.$inferSelect
export type NewSchedulerJob = typeof schedulerJobs.$inferInsert
