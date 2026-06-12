import { z } from 'zod'
import 'dotenv/config'

/**
 * Custom env validation (replaces @t3-oss/env-core).
 *
 * - `env`      → server-only variables read from `process.env`. Importing it
 *                from code that runs in the browser throws immediately, so
 *                secrets can never leak into the client bundle silently.
 * - `clientEnv` → browser-safe variables read from `import.meta.env`. Vite only
 *                exposes variables prefixed with `VITE_`, so the schema must
 *                use that prefix.
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

const isServer = typeof window === 'undefined'
const skipValidation = !!process.env?.SKIP_ENV_VALIDATION

/** Treat empty strings as missing so `z.string().min(1)` and `.default()` behave. */
function withoutEmptyStrings(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    out[key] = value === '' ? undefined : value
  }
  return out
}

function parseEnv<S extends z.ZodType>(schema: S, source: Record<string, unknown>, label: string): z.infer<S> {
  const result = schema.safeParse(withoutEmptyStrings(source))
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    throw new Error(`❌ Invalid ${label} environment variables:\n${issues.join('\n')}`)
  }
  return result.data
}

export const env: ServerEnv = (() => {
  if (!isServer) {
    throw new Error('Server env accessed from client code — use `clientEnv` (VITE_*) instead')
  }
  if (skipValidation) return process.env as unknown as ServerEnv
  return parseEnv(serverSchema, process.env, 'server')
})()

export const clientEnv: ClientEnv = parseEnv(
  clientSchema,
  typeof import.meta.env === 'undefined' ? {} : import.meta.env,
  'client',
)
