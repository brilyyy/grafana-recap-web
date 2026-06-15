/**
 * `withLogging` — higher-order wrapper that instruments a function with
 * start / success / error logging and duration, without changing its
 * signature or behavior. Works for sync and async functions.
 *
 * Usage:
 *   export const triggerRecap = withLogging('triggerRecap', _triggerRecap)
 */
import { logger } from './index'

type AnyFn = (...args: any[]) => any

interface WithLoggingOpts {
  /** Override the module tag (defaults to "fn"). */
  module?: string
  /** Log argument summary on start (default true; disable for noisy/secret args). */
  logArgs?: boolean
}

function durationMs(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return { message: String(err) }
}

/** Shallow, length-capped arg summary so we never dump huge payloads. */
function safeArgs(args: unknown[]): unknown[] {
  return args.map((a) => {
    if (a === null || a === undefined) return a
    if (typeof a === 'function') return '[Function]'
    if (typeof a === 'object') {
      const s = (() => {
        try {
          return JSON.stringify(a)
        } catch {
          return '[Unserializable]'
        }
      })()
      return s.length > 500 ? `${s.slice(0, 500)}…` : s
    }
    return a
  })
}

export function withLogging<F extends AnyFn>(
  name: string,
  fn: F,
  opts: WithLoggingOpts = {},
): F {
  const { module = 'fn', logArgs = true } = opts
  const log = logger.child({ module, fn: name })

  const wrapped = function (this: unknown, ...args: Parameters<F>): ReturnType<F> {
    const start = performance.now()
    log.debug(logArgs ? { args: safeArgs(args) } : {}, `${name} start`)

    const onError = (err: unknown): never => {
      log.error(
        { durationMs: durationMs(start), status: 'error', err: serializeError(err) },
        `${name} failed`,
      )
      throw err
    }

    try {
      const out = fn.apply(this, args)
      if (out instanceof Promise) {
        return out.then((value) => {
          log.info({ durationMs: durationMs(start), status: 'success' }, `${name} ok`)
          return value
        }, onError) as ReturnType<F>
      }
      log.info({ durationMs: durationMs(start), status: 'success' }, `${name} ok`)
      return out
    } catch (err) {
      return onError(err)
    }
  }

  return wrapped as F
}
