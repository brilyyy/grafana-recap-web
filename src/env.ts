import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    // Database (PostgreSQL + pg_cron)
    DB_TYPE: z.enum(['postgresql', 'postgres']).default('postgresql'),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z.string().min(1),
    DB_USER_TARGET: z.string().optional(),

    // BetterAuth
    BETTER_AUTH_SECRET: z.string().min(1).optional(),
    BETTER_AUTH_URL: z.string().url().optional(),

    // Scheduler
    USE_APP_LEVEL_SCHEDULER: z.enum(['true', 'false']).optional(),
    SCHEDULER_TIMEZONE: z.string().default('Asia/Jakarta'),
    BALE_PROCESSING_SCHEDULE: z.string().default('1 0 * * *'),
    BALE_BISNIS_PROCESSING_SCHEDULE: z.string().default('1 0 * * *'),
    OLOB_PROCESSING_SCHEDULE: z.string().default('1 0 * * *'),
    EDC_AGEN_PROCESSING_SCHEDULE: z.string().default('1 0 * * *'),
    EDC_MERCHANT_PROCESSING_SCHEDULE: z.string().default('1 0 * * *'),
    EDC_MERCHANT_ANCOL_PROCESSING_SCHEDULE: z.string().default('1 0 * * *'),
    CMS_PROCESSING_SCHEDULE: z.string().default('1 0 * * *'),
    BALE_KORPORA_PROCESSING_SCHEDULE: z.string().default('1 0 * * *'),
    CMS_CORP_RECAP_SCHEDULE: z.string().default('1 0 * * *'),
    BALE_KORPORA_CORP_RECAP_SCHEDULE: z.string().default('1 0 * * *'),
    HOUSEKEEPING_SCHEDULE: z.string().default('0 2 * * *'),

    /** Optional: allows POST /api/processing/process-manual without session when header matches */
    RECAP_TRIGGER_API_KEY: z.string().optional(),

    // Migrations / seeds
    TARGET_DATABASES: z.string().optional(),
    DEFAULT_SU_USERNAME: z.string().optional(),
    DEFAULT_SU_PASSWORD: z.string().optional(),
    DEFAULT_SU_EMAIL: z.string().optional(),

    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },

  runtimeEnv: process.env,

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
