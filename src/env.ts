import { z } from 'zod'
import 'dotenv/config'
import { createEnv } from '@/lib/create-env'

/**
 * Environment validation via createEnv (src/lib/create-env.ts).
 *
 * - `env`       → server-only variables read from `process.env`. Accessing
 *                 it from browser code throws immediately (Proxy guard), so
 *                 secrets can never leak into the client bundle silently.
 * - `clientEnv` → browser-safe variables read from `import.meta.env`. Vite
 *                 only exposes variables prefixed with `VITE_`, so the schema
 *                 must use that prefix.
 */

const serverSchema = z.object({
  // Database (PostgreSQL)
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  // BetterAuth
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),

  // Scheduler
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

  /** Optional: allows tRPC `recap.triggerExternal` without session when x-recap-api-key matches */
  RECAP_TRIGGER_API_KEY: z.string().optional(),

  // Migrations / seeds
  TARGET_DATABASES: z.string().optional(),
  DEFAULT_SU_USERNAME: z.string().optional(),
  DEFAULT_SU_PASSWORD: z.string().optional(),
  DEFAULT_SU_EMAIL: z.string().optional(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

/** Browser-exposed variables. Every key MUST be prefixed with `VITE_`. */
const clientSchema = z.object({})

export type ServerEnv = z.infer<typeof serverSchema>
export type ClientEnv = z.infer<typeof clientSchema>

const _env = createEnv({
  server: serverSchema,
  client: clientSchema,
  clientPrefix: 'VITE_',
  skipValidation: !!process.env?.SKIP_ENV_VALIDATION,
})

export const env = _env as ServerEnv & ClientEnv
export const clientEnv = _env as ClientEnv
