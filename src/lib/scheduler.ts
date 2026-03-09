/**
 * Scheduler instance storage
 * Using 'any' type because node-cron is dynamically imported
 *
 * Note: MySQL branches are deprecated. Use PostgreSQL + pg_cron instead.
 */
let baleProcessingTask: any = null
let baleBisnisProcessingTask: any = null
let olobProcessingTask: any = null

/**
 * Execute the Bale daily processing stored procedure.
 */
async function executeBaleProcessing(): Promise<void> {
  const dbType = (process.env.DB_TYPE ?? 'mysql').toLowerCase()
  const isPostgres = dbType === 'postgresql' || dbType === 'postgres'

  if (isPostgres) {
    const { Pool } = await import('pg')
    const pool = new Pool({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT ?? '5432', 10),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    })
    try {
      await pool.query('SELECT public.sp_process_bale_daily($1::date)', [null])
    } finally {
      await pool.end()
    }
  } else {
    // @deprecated MySQL – use PostgreSQL + pg_cron
    const mysql = await import('mysql2/promise')
    const connection = await mysql.createConnection({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT ?? '3306', 10),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    })
    try {
      await connection.execute('CALL sp_process_bale_daily(?)', [null])
    } finally {
      await connection.end()
    }
  }
}

/**
 * Execute the Bale Bisnis daily processing stored procedure.
 */
async function executeBaleBisnisProcessing(): Promise<void> {
  const dbType = (process.env.DB_TYPE ?? 'mysql').toLowerCase()
  const isPostgres = dbType === 'postgresql' || dbType === 'postgres'

  if (isPostgres) {
    const { Pool } = await import('pg')
    const pool = new Pool({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT ?? '5432', 10),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    })
    try {
      await pool.query('SELECT public.sp_process_bale_bisnis_daily($1::date)', [null])
    } finally {
      await pool.end()
    }
  } else {
    // @deprecated MySQL – use PostgreSQL + pg_cron
    const mysql = await import('mysql2/promise')
    const connection = await mysql.createConnection({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT ?? '3306', 10),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    })
    try {
      await connection.execute('CALL sp_process_bale_bisnis_daily(?)', [null])
    } finally {
      await connection.end()
    }
  }
}

/**
 * Execute the OLOB daily processing stored procedure.
 */
async function executeOlobProcessing(): Promise<void> {
  const dbType = (process.env.DB_TYPE ?? 'mysql').toLowerCase()
  const isPostgres = dbType === 'postgresql' || dbType === 'postgres'

  if (isPostgres) {
    const { Pool } = await import('pg')
    const pool = new Pool({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT ?? '5432', 10),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    })
    try {
      await pool.query('SELECT public.sp_process_olob_daily($1::date)', [null])
    } finally {
      await pool.end()
    }
  } else {
    // @deprecated MySQL – use PostgreSQL + pg_cron
    const mysql = await import('mysql2/promise')
    const connection = await mysql.createConnection({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT ?? '3306', 10),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    })
    try {
      await connection.execute('CALL sp_process_olob_daily(?)', [null])
    } finally {
      await connection.end()
    }
  }
}

/**
 * Check if application-level scheduler should be used
 */
function shouldUseAppLevelScheduler(): boolean {
  const value = process.env.USE_APP_LEVEL_SCHEDULER
  console.log('USE_APP_LEVEL_SCHEDULER : ', value)
  return value === 'true'
}

/**
 * Get scheduler timezone from environment or use default
 */
function getSchedulerTimezone(): string {
  return process.env.SCHEDULER_TIMEZONE ?? 'Asia/Jakarta'
}

/**
 * Get cron schedule from environment or use default
 * Format: minute hour day month dayOfWeek
 */
function getCronSchedule(envVar: string, defaultSchedule: string = '1 0 * * *'): string {
  const schedule = process.env[envVar] ?? defaultSchedule
  const cronPattern = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([12]?\d|3[01])) (\*|([1-9]|1[0-2])) (\*|([0-6]))$/
  if (!cronPattern.test(schedule.trim())) {
    console.warn(`⚠️  Invalid cron schedule format: ${schedule}. Using default: '${defaultSchedule}'`)
    return defaultSchedule
  }
  return schedule.trim()
}

/**
 * Setup BALE and Bale Bisnis daily processing schedulers
 * Each app uses its own schedule from env (BALE_PROCESSING_SCHEDULE, BALE_BISNIS_PROCESSING_SCHEDULE)
 */
async function setupProcessingSchedulers(): Promise<void> {
  if (typeof window !== 'undefined') {
    console.warn('⚠️  Cannot setup scheduler in browser environment')
    return
  }

  let cron: any
  try {
    cron = await import('node-cron')
  } catch (error: any) {
    console.error('❌ Failed to import node-cron:', error.message)
    return
  }

  const timezone = getSchedulerTimezone()

  // Bale
  if (!baleProcessingTask) {
    let baleSchedule = getCronSchedule('BALE_PROCESSING_SCHEDULE')
    if (!cron.validate(baleSchedule)) baleSchedule = '1 0 * * *'
    baleProcessingTask = cron.schedule(
      baleSchedule,
      async () => {
        try {
          console.log('🔄 Starting scheduled BALE processing...')
          await executeBaleProcessing()
          console.log('✅ Scheduled BALE processing completed successfully')
        } catch (error: any) {
          console.error('❌ Scheduled BALE processing failed:', error.message)
        }
      },
      { scheduled: true, timezone }
    )
    console.log(`✅ BALE processing scheduler configured: Schedule '${baleSchedule}' (timezone: ${timezone})`)
  }

  // Bale Bisnis
  if (!baleBisnisProcessingTask) {
    let bisnisSchedule = getCronSchedule('BALE_BISNIS_PROCESSING_SCHEDULE')
    if (!cron.validate(bisnisSchedule)) bisnisSchedule = '1 0 * * *'
    baleBisnisProcessingTask = cron.schedule(
      bisnisSchedule,
      async () => {
        try {
          console.log('🔄 Starting scheduled Bale Bisnis processing...')
          await executeBaleBisnisProcessing()
          console.log('✅ Scheduled Bale Bisnis processing completed successfully')
        } catch (error: any) {
          console.error('❌ Scheduled Bale Bisnis processing failed:', error.message)
        }
      },
      { scheduled: true, timezone }
    )
    console.log(`✅ Bale Bisnis processing scheduler configured: Schedule '${bisnisSchedule}' (timezone: ${timezone})`)
  }

  // OLOB
  if (!olobProcessingTask) {
    let olobSchedule = getCronSchedule('OLOB_PROCESSING_SCHEDULE')
    if (!cron.validate(olobSchedule)) olobSchedule = '1 0 * * *'
    olobProcessingTask = cron.schedule(
      olobSchedule,
      async () => {
        try {
          console.log('🔄 Starting scheduled OLOB processing...')
          await executeOlobProcessing()
          console.log('✅ Scheduled OLOB processing completed successfully')
        } catch (error: any) {
          console.error('❌ Scheduled OLOB processing failed:', error.message)
        }
      },
      { scheduled: true, timezone }
    )
    console.log(`✅ OLOB processing scheduler configured: Schedule '${olobSchedule}' (timezone: ${timezone})`)
  }
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler(): void {
  if (baleProcessingTask) {
    baleProcessingTask.stop()
    baleProcessingTask = null
  }
  if (baleBisnisProcessingTask) {
    baleBisnisProcessingTask.stop()
    baleBisnisProcessingTask = null
  }
  if (olobProcessingTask) {
    olobProcessingTask.stop()
    olobProcessingTask = null
  }
  console.log('✅ Scheduler stopped')
}

/**
 * Initialize scheduler
 * This should be called when the application starts
 */
export async function initializeScheduler(): Promise<void> {
  // Ensure this only runs on server-side
  if (typeof window !== 'undefined') {
    console.warn('⚠️  Scheduler initialization skipped: running in browser')
    return
  }

  // Only initialize if app-level scheduler is enabled
  if (!shouldUseAppLevelScheduler()) {
    console.log('ℹ️  Application-level scheduler disabled (USE_APP_LEVEL_SCHEDULER != true)')
    return
  }

  // Check DB type directly from env — no @/ import needed
  const dbType = (process.env.DB_TYPE ?? 'mysql').toLowerCase()

  // Only setup for PostgreSQL when app-level scheduler is enabled
  // MySQL should continue using Event Scheduler
  if (dbType === 'postgresql' || dbType === 'postgres') {
    console.log('ℹ️  Initializing application-level scheduler for PostgreSQL...')
    await setupProcessingSchedulers()
  } else {
    console.log('ℹ️  Application-level scheduler only available for PostgreSQL. MySQL is deprecated – use PostgreSQL + pg_cron.')
  }
}
