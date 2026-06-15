/**
 * Storage-optimized application logger.
 *
 * - Engine: pino (low-overhead newline-delimited JSON).
 * - Persistence: rotating-file-stream → size + daily rotation, gzip of
 *   rotated files, 14-file retention. Bounds disk use in dev and prod.
 * - Output dir: `LOG_DIR` (default `log/`).
 * - Server-only: pulls in `node:fs` and must never enter the client bundle.
 *   In a browser context this returns a disabled (no-op) logger as a guard.
 *
 * This module reads config straight from `process.env` (not `src/env.ts`) so
 * it is usable from BOTH the main server and the forked scheduler-worker,
 * which does not import the app env. `src/env.ts` still validates the vars for
 * the main process.
 *
 * Diagnostic/operational logging only — does NOT replace the `audit_logs`
 * (user actions) or `app_processing_log` (recap metrics) DB tables.
 */
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import pino from 'pino'
import { createStream } from 'rotating-file-stream'

const isServer = typeof window === 'undefined'

const LOG_DIR = process.env.LOG_DIR ?? 'log'
const NODE_ENV = process.env.NODE_ENV ?? 'development'
const LOG_LEVEL = (process.env.LOG_LEVEL ??
  (NODE_ENV === 'development' ? 'debug' : 'info')) as pino.Level

/** Secrets / noisy fields scrubbed before anything is written. */
const redact: pino.LoggerOptions['redact'] = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'headers.authorization',
    'headers.cookie',
    'password',
    '*.password',
    'DB_PASSWORD',
    '*.DB_PASSWORD',
    'BETTER_AUTH_SECRET',
    '*.BETTER_AUTH_SECRET',
    'token',
    '*.token',
    'apiKey',
    '*.apiKey',
  ],
  censor: '[Redacted]',
}

function rotatingStream(filename: string) {
  return createStream(filename, {
    path: LOG_DIR,
    size: '10M', // rotate at 10MB
    interval: '1d', // …or daily, whichever first
    compress: 'gzip', // gzip rotated files
    maxFiles: 14, // keep 14 rotated files
  })
}

/**
 * Build a pino logger that writes `<base>.log` (all levels ≥ LOG_LEVEL) and
 * `<base>-error.log` (errors only). In development it also mirrors JSON to
 * stdout (pipe to `pino-pretty` for readable console output).
 *
 * @param base file prefix — use distinct prefixes per process so two
 *   processes never rotate the same file (e.g. main `app`, worker `worker`).
 */
export function createFileLogger(base = 'app'): pino.Logger {
  if (!isServer) {
    return pino({ enabled: false })
  }

  mkdirSync(LOG_DIR, { recursive: true })

  const streams: pino.StreamEntry[] = [
    { level: LOG_LEVEL, stream: rotatingStream(`${base}.log`) },
    { level: 'error', stream: rotatingStream(`${base}-error.log`) },
  ]

  if (NODE_ENV === 'development') {
    // pino-pretty is a devDependency only — lazy-require it so production
    // (where it isn't installed) never tries to load it. Falls back to raw
    // JSON on stdout if unavailable.
    try {
      const require = createRequire(import.meta.url)
      const pretty = require('pino-pretty') as (opts: unknown) => NodeJS.WritableStream
      streams.push({
        level: LOG_LEVEL,
        stream: pretty({ colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid' }),
      })
    } catch {
      streams.push({ level: LOG_LEVEL, stream: process.stdout })
    }
  }

  return pino(
    {
      level: LOG_LEVEL,
      redact,
      base: { pid: process.pid },
    },
    pino.multistream(streams),
  )
}

/** Shared application logger (main server process). */
export const logger = createFileLogger('app')

/** Child logger scoped to a module/area. */
export function getLogger(module: string): pino.Logger {
  return logger.child({ module })
}
