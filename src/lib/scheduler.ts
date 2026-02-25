/**
 * Scheduler instance storage
 * Using 'any' type because node-cron is dynamically imported
 */
let baleProcessingTask: any = null

/**
 * Execute the Bale daily processing stored procedure.
 * Uses raw driver imports (no @/ aliases) so this works in both
 * the CJS server-dev.js context and the Next.js ESM context.
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
      await pool.query('SELECT sp_process_bale_daily($1)', [null])
    } finally {
      await pool.end()
    }
  } else {
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
 * Default: '1 0 * * *' (00:01 every day)
 * Format: minute hour day month dayOfWeek
 */
function getCronSchedule(): string {
  const schedule = process.env.BALE_PROCESSING_SCHEDULE ?? '1 0 * * *'
  
  // Validate cron format (basic validation)
  const cronPattern = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([12]?\d|3[01])) (\*|([1-9]|1[0-2])) (\*|([0-6]))$/
  
  if (!cronPattern.test(schedule.trim())) {
    console.warn(`⚠️  Invalid cron schedule format: ${schedule}. Using default: '1 0 * * *'`)
    return '1 0 * * *'
  }
  
  return schedule.trim()
}

/**
 * Setup BALE daily processing scheduler
 * Runs at 00:01 every day
 */
async function setupBaleProcessingScheduler(): Promise<void> {
  // Check if already scheduled
  if (baleProcessingTask) {
    console.log('ℹ️  BALE processing scheduler already initialized')
    return
  }

  // Ensure we're on server-side before importing node-cron
  if (typeof window !== 'undefined') {
    console.warn('⚠️  Cannot setup scheduler in browser environment')
    return
  }

  // Dynamic import node-cron - only at runtime, never during build
  // Webpack is configured to ignore this in client bundle
  let cron: any
  try {
    // Dynamic import - webpack will ignore this for client bundle
    cron = await import('node-cron')
  } catch (error: any) {
    console.error('❌ Failed to import node-cron:', error.message)
    console.error('   Make sure node-cron is installed: npm install node-cron')
    return
  }

  const timezone = getSchedulerTimezone()
  let cronSchedule = getCronSchedule()
  
  // Validate cron schedule format using node-cron
  if (!cron.validate(cronSchedule)) {
    console.error(`❌ Invalid cron schedule format: ${cronSchedule}. Using default: '1 0 * * *'`)
    cronSchedule = '1 0 * * *'
  }
  
  // Schedule from environment variable (or default if invalid)
  // Cron format: minute hour day month dayOfWeek
  baleProcessingTask = cron.schedule(
    cronSchedule,
    async () => {
      try {
        console.log('🔄 Starting scheduled BALE processing...')
        await executeBaleProcessing()
        console.log('✅ Scheduled BALE processing completed successfully')
      } catch (error: any) {
        console.error('❌ Scheduled BALE processing failed:', error.message)
      }
    },
    {
      scheduled: true,
      timezone: timezone,
    }
  )
  
  console.log(`✅ BALE processing scheduler configured: Schedule '${cronSchedule}' (timezone: ${timezone})`)
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler(): void {
  if (baleProcessingTask) {
    baleProcessingTask.stop()
    baleProcessingTask = null
    console.log('✅ Scheduler stopped')
  }
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
    await setupBaleProcessingScheduler()
  } else {
    console.log('ℹ️  Application-level scheduler only available for PostgreSQL. MySQL uses Event Scheduler.')
  }
}
