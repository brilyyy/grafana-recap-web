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
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { schedulerJobs } from '../db/schema/scheduler'
import { createFileLogger } from '../lib/logger'

// Separate process → own log files so it never rotates the same files as the
// main server (concurrent rotation would corrupt them).
const log = createFileLogger('worker')

const DB_HOST = process.env.DB_HOST ?? 'localhost'
const DB_PORT = parseInt(process.env.DB_PORT ?? '5432', 10)
const DB_USER = process.env.DB_USER ?? 'root'
const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
const DB_NAME = process.env.DB_NAME ?? 'platform_db'

const client = postgres({
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
})
const db = drizzle(client)

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
    log.error({ err: e.message }, 'Failed to import node-cron')
    return
  }

  for (const job of currentJobs) {
    if (runningTasks.has(job.id)) continue

    const schedule = job.schedule.trim()
    if (!cron.validate(schedule)) {
      log.warn({ job: job.name, schedule }, 'Invalid cron, skipping')
      continue
    }

    const task = cron.schedule(
      schedule,
      async () => {
        const start = performance.now()
        try {
          log.info({ job: job.name, procedure: job.procedure }, 'Job starting')
          await updateJobStatus(job.id, 'running')
          await runProcedure(job.procedure)
          log.info(
            { job: job.name, durationMs: Math.round(performance.now() - start) },
            'Job completed',
          )
          await updateJobStatus(job.id, 'success')
        } catch (error: any) {
          log.error(
            { job: job.name, durationMs: Math.round(performance.now() - start), err: error.message },
            'Job failed',
          )
          await updateJobStatus(job.id, 'error', error.message)
        }
      },
      { timezone: job.timezone ?? 'Asia/Jakarta' },
    )
    runningTasks.set(job.id, task)
    log.info({ job: job.name, schedule }, 'Job scheduled')
  }
}

async function stopAll() {
  for (const [id, task] of runningTasks) {
    task.stop()
    runningTasks.delete(id)
  }
}

async function restart() {
  log.info('Restarting')
  await stopAll()
  await loadJobs()
  await startAll()
  log.info({ jobCount: currentJobs.length }, 'Restarted')
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
  log.info('SIGTERM received, shutting down')
  await stopAll()
  await client.end()
  process.exit(0)
})

process.on('SIGINT', async () => {
  log.info('SIGINT received, shutting down')
  await stopAll()
  await client.end()
  process.exit(0)
})

// ── Boot ──
loadJobs()
  .then(startAll)
  .then(() => {
    log.info({ pid: process.pid, jobCount: currentJobs.length }, 'Ready')
    process.send?.({ type: 'ready', jobCount: currentJobs.length })
  })
  .catch((err) => {
    log.error({ err: err.message }, 'Fatal')
    process.exit(1)
  })
