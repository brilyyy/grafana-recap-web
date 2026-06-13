#!/usr/bin/env node
/**
 * Scheduler Worker – standalone process
 *
 * Forked by the main server. Fetches job definitions from the
 * scheduler_jobs database table and runs them via node-cron.
 * Communicates with the parent via IPC messages.
 */

import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { schedulerJobs } from '../db/schema/scheduler'

const DB_HOST = process.env.DB_HOST ?? 'localhost'
const DB_PORT = parseInt(process.env.DB_PORT ?? '5432', 10)
const DB_USER = process.env.DB_USER ?? 'root'
const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
const DB_NAME = process.env.DB_NAME ?? 'platform_db'

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
})
const db = drizzle(pool)

const runningTasks = new Map<number, { stop: () => void }>()
let currentJobs: (typeof schedulerJobs.$inferSelect)[] = []

async function loadJobs() {
  currentJobs = await db.select().from(schedulerJobs).where(eq(schedulerJobs.enabled, true))
  return currentJobs
}

async function runProcedure(procedure: string): Promise<void> {
  const { sql } = await import('drizzle-orm')
  await db.execute(sql.raw(`SELECT public.${procedure}(NULL::date)`))
}

async function updateJobStatus(id: number, status: string, error?: string) {
  const { sql: sqlModule } = await import('drizzle-orm')
  await db
    .update(schedulerJobs)
    .set({
      lastRunAt: new Date(),
      lastStatus: status,
      lastError: error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schedulerJobs.id, id))
}

async function startAll() {
  let cron: typeof import('node-cron')
  try {
    cron = await import('node-cron')
  } catch (e: any) {
    console.error('[scheduler-worker] Failed to import node-cron:', e.message)
    return
  }

  for (const job of currentJobs) {
    if (runningTasks.has(job.id)) continue

    const schedule = job.schedule.trim()
    if (!cron.validate(schedule)) {
      console.warn(`[scheduler-worker] Invalid cron for ${job.name}: '${schedule}', skipping`)
      continue
    }

    const task = cron.schedule(
      schedule,
      async () => {
        try {
          console.log(`[scheduler-worker] Starting ${job.name}...`)
          await updateJobStatus(job.id, 'running')
          await runProcedure(job.procedure)
          console.log(`[scheduler-worker] ✅ ${job.name} completed`)
          await updateJobStatus(job.id, 'success')
        } catch (error: any) {
          console.error(`[scheduler-worker] ❌ ${job.name} failed:`, error.message)
          await updateJobStatus(job.id, 'error', error.message)
        }
      },
      { timezone: job.timezone ?? 'Asia/Jakarta' },
    )
    runningTasks.set(job.id, task)
    console.log(`[scheduler-worker] ✅ ${job.name} scheduled: ${schedule}`)
  }
}

async function stopAll() {
  for (const [id, task] of runningTasks) {
    task.stop()
    runningTasks.delete(id)
  }
}

async function restart() {
  console.log('[scheduler-worker] Restarting...')
  await stopAll()
  await loadJobs()
  await startAll()
  console.log(`[scheduler-worker] Restarted with ${currentJobs.length} jobs`)
  process.send?.({ type: 'ready', jobCount: currentJobs.length })
}

process.on('message', async (msg: string) => {
  if (msg === 'restart') {
    await restart()
  } else if (msg === 'status') {
    process.send?.({
      type: 'status',
      pid: process.pid,
      jobCount: currentJobs.length,
      jobs: currentJobs.map((j) => ({
        id: j.id,
        name: j.name,
        procedure: j.procedure,
        schedule: j.schedule,
        enabled: j.enabled,
        lastRunAt: j.lastRunAt,
        lastStatus: j.lastStatus,
      })),
    })
  }
})

process.on('SIGTERM', async () => {
  console.log('[scheduler-worker] SIGTERM received, shutting down...')
  await stopAll()
  await pool.end()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[scheduler-worker] SIGINT received, shutting down...')
  await stopAll()
  await pool.end()
  process.exit(0)
})

// ── Boot ──
loadJobs()
  .then(startAll)
  .then(() => {
    console.log(`[scheduler-worker] Ready (pid=${process.pid}, ${currentJobs.length} jobs)`)
    process.send?.({ type: 'ready', jobCount: currentJobs.length })
  })
  .catch((err) => {
    console.error('[scheduler-worker] Fatal:', err.message)
    process.exit(1)
  })
