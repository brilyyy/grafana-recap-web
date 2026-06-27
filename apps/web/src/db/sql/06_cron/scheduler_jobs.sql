-- scheduler_jobs table. Job rows are seeded by the engine (SEED_JOBS in seed-schedules.ts),
-- not here, because they map procedure names to cron expressions in code.

CREATE TABLE IF NOT EXISTS "scheduler_jobs" (
  "id"            SERIAL PRIMARY KEY,
  "name"          VARCHAR(255) NOT NULL,
  "procedure"     VARCHAR(255) NOT NULL UNIQUE,
  "schedule"      VARCHAR(100) NOT NULL DEFAULT '1 0 * * *',
  "timezone"      VARCHAR(100) DEFAULT 'Asia/Jakarta',
  "enabled"       BOOLEAN DEFAULT true NOT NULL,
  "last_run_at"   TIMESTAMP,
  "last_status"   VARCHAR(50),
  "last_error"    TEXT,
  "created_at"    TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at"    TIMESTAMP DEFAULT NOW() NOT NULL
);
