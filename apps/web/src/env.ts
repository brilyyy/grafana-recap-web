import { z } from 'zod'
import 'dotenv/config'

const schema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
  SCHEDULER_TIMEZONE: z.string().default('Asia/Jakarta'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_DIR: z.string().default('log'),
  TARGET_DATABASES: z.string().optional(),
  DEFAULT_SU_USERNAME: z.string().optional(),
  DEFAULT_SU_PASSWORD: z.string().optional(),
  DEFAULT_SU_EMAIL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

function withoutEmptyStrings(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    out[key] = value === '' ? undefined : value
  }
  return out
}

export type ServerEnv = z.infer<typeof schema>

const skip = typeof process !== 'undefined' && !!process.env?.SKIP_ENV_VALIDATION

export const env: ServerEnv = skip
  ? (process.env as unknown as ServerEnv)
  : (() => {
      const result = schema.safeParse(withoutEmptyStrings(process.env as Record<string, unknown>))
      if (!result.success) {
        const lines: string[] = ['❌ Environment validation failed:\n']
        for (const issue of result.error.issues) {
          lines.push(`  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        }
        throw new Error(lines.join('\n'))
      }
      return result.data
    })()
