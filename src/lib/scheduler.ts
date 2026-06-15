/**
 * Scheduler – node-cron v4 based
 *
 * Each job invokes a PostgreSQL stored procedure via Drizzle.
 * Schedules are passed in directly (DB-driven) or fall back to DEFAULT_SCHEDULE.
 */

import { getLogger } from '@/lib/logger'
import { withLogging } from '@/lib/logger/with-logging'

const log = getLogger('scheduler')

export interface RecapJobInput {
  id?: number
  /** Human-readable name used in log lines */
  name: string
  /** Stored procedure to invoke (in the `public` schema) */
  procedure: string
  /** Direct cron schedule */
  schedule?: string
  /** Timezone override */
  timezone?: string
}

const DEFAULT_SCHEDULE = '1 0 * * *'

const RECAP_JOBS: RecapJobInput[] = [
  { name: 'BALE processing', procedure: 'sp_process_bale_daily' },
  { name: 'Bale Bisnis processing', procedure: 'sp_process_bale_bisnis_daily' },
  { name: 'OLOB processing', procedure: 'sp_process_olob_daily' },
  { name: 'CMS processing', procedure: 'sp_process_cms_daily' },
  { name: 'CMS CORP recap', procedure: 'sp_recap_cms_corp_daily' },
  { name: 'Bale Korpora CORP recap', procedure: 'sp_recap_bale_korpora_corp_daily' },
  { name: 'Bale Korpora processing', procedure: 'sp_process_bale_korpora_daily' },
]

const runningTasks = new Map<string, { stop: () => void }>()

/**
 * Run a stored procedure with a NULL date argument through the shared
 * Drizzle connection pool. Imports are dynamic so the scheduler module
 * stays cheap to load until a job actually fires.
 */
async function runStoredProcedure(procedureName: string): Promise<void> {
  const { db } = await import('@/db')
  const { sql } = await import('drizzle-orm')
  await db.execute(sql`SELECT ${sql.raw(`public.${procedureName}`)}(${null}::date)`)
}

/**
 * Initialize scheduler. Idempotent: jobs that are already running are left
 * untouched. Should be called once when the application starts.
 *
 * @param jobs - Optional job list. Falls back to hardcoded RECAP_JOBS (env-var driven).
 */
async function _initializeScheduler(jobs?: RecapJobInput[]): Promise<void> {
  if (typeof window !== 'undefined') {
    log.warn('Scheduler initialization skipped: running in browser')
    return
  }

  let cron: typeof import('node-cron')
  try {
    cron = await import('node-cron')
  } catch (error: any) {
    log.error({ err: error.message }, 'Failed to import node-cron')
    return
  }

  const jobsToRun = jobs ?? RECAP_JOBS
  log.info({ jobCount: jobsToRun.length }, 'Initializing scheduler (DB-driven via scheduler_jobs)')
  const defaultTimezone = process.env.SCHEDULER_TIMEZONE ?? 'Asia/Jakarta'

  for (const job of jobsToRun) {
    const key = job.name
    if (runningTasks.has(key)) continue

    const timezone = job.timezone ?? defaultTimezone
    let schedule = (job.schedule ?? DEFAULT_SCHEDULE).trim()
    if (!cron.validate(schedule)) {
      log.warn(
        { job: job.name, schedule, fallback: DEFAULT_SCHEDULE },
        'Invalid cron schedule, using default',
      )
      schedule = DEFAULT_SCHEDULE
    }

    const task = cron.schedule(
      schedule,
      async () => {
        const start = performance.now()
        try {
          log.info({ job: job.name, procedure: job.procedure }, 'Scheduled job starting')
          await runStoredProcedure(job.procedure)
          log.info(
            { job: job.name, durationMs: Math.round(performance.now() - start) },
            'Scheduled job completed',
          )
        } catch (error: any) {
          log.error(
            { job: job.name, durationMs: Math.round(performance.now() - start), err: error.message },
            'Scheduled job failed',
          )
        }
      },
      { timezone },
    )
    runningTasks.set(key, task)
    log.info({ job: job.name, schedule, timezone }, 'Scheduler configured')
  }
}

/** Initialize scheduler. Idempotent: already-running jobs are left untouched. */
export const initializeScheduler = withLogging('initializeScheduler', _initializeScheduler, {
  module: 'scheduler',
})

/** Stop all scheduled jobs. */
export function stopScheduler(): void {
  for (const task of runningTasks.values()) task.stop()
  runningTasks.clear()
  log.info('Scheduler stopped')
}
