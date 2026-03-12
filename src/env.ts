import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    // Database (mysql deprecated – use postgresql/postgres + pg_cron)
    DB_TYPE: z.enum(['mysql', 'postgresql', 'postgres']).default('postgresql'),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(3306),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z.string().min(1),
    DB_USER_TARGET: z.string().optional(),

    // Auth (JWT – kept until BetterAuth replaces them)
    JWT_SECRET: z.string().min(1).default('change-this-secret-key-in-production'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    COOKIE_SECURE: z.enum(['true', 'false', '0', '1']).optional(),

    // BetterAuth (added for the BetterAuth migration step)
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

    // Migrations / seeds (used by TypeORM CLI scripts, kept here for documentation)
    TARGET_DATABASES: z.string().optional(),
    DEFAULT_SU_USERNAME: z.string().optional(),
    DEFAULT_SU_PASSWORD: z.string().optional(),
    DEFAULT_SU_EMAIL: z.string().optional(),

    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },

  client: {},

  runtimeEnv: {
    DB_TYPE: process.env.DB_TYPE,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_USER_TARGET: process.env.DB_USER_TARGET,

    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    COOKIE_SECURE: process.env.COOKIE_SECURE,

    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,

    USE_APP_LEVEL_SCHEDULER: process.env.USE_APP_LEVEL_SCHEDULER,
    SCHEDULER_TIMEZONE: process.env.SCHEDULER_TIMEZONE,
    BALE_PROCESSING_SCHEDULE: process.env.BALE_PROCESSING_SCHEDULE,
    BALE_BISNIS_PROCESSING_SCHEDULE: process.env.BALE_BISNIS_PROCESSING_SCHEDULE,
    OLOB_PROCESSING_SCHEDULE: process.env.OLOB_PROCESSING_SCHEDULE,
    EDC_AGEN_PROCESSING_SCHEDULE: process.env.EDC_AGEN_PROCESSING_SCHEDULE,
    EDC_MERCHANT_PROCESSING_SCHEDULE: process.env.EDC_MERCHANT_PROCESSING_SCHEDULE,
    EDC_MERCHANT_ANCOL_PROCESSING_SCHEDULE: process.env.EDC_MERCHANT_ANCOL_PROCESSING_SCHEDULE,

    TARGET_DATABASES: process.env.TARGET_DATABASES,
    DEFAULT_SU_USERNAME: process.env.DEFAULT_SU_USERNAME,
    DEFAULT_SU_PASSWORD: process.env.DEFAULT_SU_PASSWORD,
    DEFAULT_SU_EMAIL: process.env.DEFAULT_SU_EMAIL,

    NODE_ENV: process.env.NODE_ENV,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
