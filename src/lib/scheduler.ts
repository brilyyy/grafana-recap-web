/**
 * Scheduler – node-cron v4 based
 *
 * Each job invokes a PostgreSQL stored procedure via Drizzle.
 * Schedules are configurable via environment variables or
 * passed in directly (for DB-driven scheduling).
 */

export interface RecapJobInput {
  id?: number
  /** Human-readable name used in log lines */
  name: string
  /** Environment variable holding the cron schedule (fallback) */
  envVar?: string
  /** Stored procedure to invoke (in the `public` schema) */
  procedure: string
  /** Direct cron schedule (takes precedence over envVar) */
  schedule?: string
  /** Timezone override */
  timezone?: string
}

const DEFAULT_SCHEDULE = '1 0 * * *'

const RECAP_JOBS: RecapJobInput[] = [
  { name: 'BALE processing', envVar: 'BALE_PROCESSING_SCHEDULE', procedure: 'sp_process_bale_daily' },
  {
    name: 'Bale Bisnis processing',
    envVar: 'BALE_BISNIS_PROCESSING_SCHEDULE',
    procedure: 'sp_process_bale_bisnis_daily',
  },
  { name: 'OLOB processing', envVar: 'OLOB_PROCESSING_SCHEDULE', procedure: 'sp_process_olob_daily' },
  { name: 'CMS processing', envVar: 'CMS_PROCESSING_SCHEDULE', procedure: 'sp_process_cms_daily' },
  { name: 'CMS CORP recap', envVar: 'CMS_CORP_RECAP_SCHEDULE', procedure: 'sp_recap_cms_corp_daily' },
  {
    name: 'Bale Korpora CORP recap',
    envVar: 'BALE_KORPORA_CORP_RECAP_SCHEDULE',
    procedure: 'sp_recap_bale_korpora_corp_daily',
  },
  {
    name: 'Bale Korpora processing',
    envVar: 'BALE_KORPORA_PROCESSING_SCHEDULE',
    procedure: 'sp_process_bale_korpora_daily',
  },
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
export async function initializeScheduler(jobs?: RecapJobInput[]): Promise<void> {
  if (typeof window !== 'undefined') {
    console.warn('⚠️  Scheduler initialization skipped: running in browser')
    return
  }

  let cron: typeof import('node-cron')
  try {
    cron = await import('node-cron')
  } catch (error: any) {
    console.error('❌ Failed to import node-cron:', error.message)
    return
  }

  const jobsToRun = jobs ?? RECAP_JOBS
  console.log(`ℹ️  Initializing scheduler (${jobsToRun.length} jobs)...`)
  const defaultTimezone = process.env.SCHEDULER_TIMEZONE ?? 'Asia/Jakarta'

  for (const job of jobsToRun) {
    const key = job.name
    if (runningTasks.has(key)) continue

    const timezone = job.timezone ?? defaultTimezone
    let schedule = (job.schedule ?? process.env[job.envVar ?? ''] ?? DEFAULT_SCHEDULE).trim()
    if (!cron.validate(schedule)) {
      console.warn(`⚠️  Invalid cron schedule for ${job.name}: '${schedule}'. Using default: '${DEFAULT_SCHEDULE}'`)
      schedule = DEFAULT_SCHEDULE
    }

    const task = cron.schedule(
      schedule,
      async () => {
        try {
          console.log(`🔄 Starting scheduled ${job.name}...`)
          await runStoredProcedure(job.procedure)
          console.log(`✅ Scheduled ${job.name} completed successfully`)
        } catch (error: any) {
          console.error(`❌ Scheduled ${job.name} failed:`, error.message)
        }
      },
      { timezone },
    )
    runningTasks.set(key, task)
    console.log(`✅ ${job.name} scheduler configured: Schedule '${schedule}' (timezone: ${timezone})`)
  }
}

/** Stop all scheduled jobs. */
export function stopScheduler(): void {
  for (const task of runningTasks.values()) task.stop()
  runningTasks.clear()
  console.log('✅ Scheduler stopped')
}
