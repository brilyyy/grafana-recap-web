import { fork } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import '@/env'
import { paraglideMiddleware } from '@/paraglide/server'

const IS_COMPILED = import.meta.url.endsWith('.mjs') || import.meta.url.endsWith('.js')
const OUTPUT_DIR = existsSync(resolve(process.cwd(), '.output'))
  ? resolve(process.cwd(), '.output')
  : resolve(process.cwd(), 'output')
const WORKER_PATH = IS_COMPILED
  ? resolve(OUTPUT_DIR, 'server/workers/scheduler-worker.mjs')
  : resolve(process.cwd(), 'src/workers/scheduler-worker.ts')
const MAX_RESTART_ATTEMPTS = 5

let schedulerWorker: ReturnType<typeof fork> | null = null
let restartAttempts = 0

function startSchedulerWorker() {
  if (IS_COMPILED && !existsSync(WORKER_PATH)) {
    console.error(`[server] Scheduler worker not found at ${WORKER_PATH}. Was 'pnpm run build:worker' run?`)
    return
  }
  const forkOptions: Parameters<typeof fork>[2] = { env: { ...process.env } }
  if (!IS_COMPILED) {
    forkOptions.execPath = resolve(process.cwd(), 'node_modules/.bin/tsx')
  }
  schedulerWorker = fork(WORKER_PATH, [], forkOptions)

  schedulerWorker.on('message', (msg: any) => {
    if (msg?.type === 'ready') {
      restartAttempts = 0
      console.log(`[server] Scheduler worker ready (pid=${schedulerWorker?.pid}, jobs=${msg.jobCount})`)
    }
  })

  schedulerWorker.on('error', (err) => {
    console.error('[server] Scheduler worker error:', err.message)
  })

  schedulerWorker.on('exit', (code, signal) => {
    console.warn(`[server] Scheduler worker exited (code=${code}, signal=${signal})`)
    schedulerWorker = null
    if (code !== 0 && restartAttempts < MAX_RESTART_ATTEMPTS) {
      restartAttempts++
      const delay = 2000 * restartAttempts
      console.log(
        `[server] Restarting scheduler worker in ${delay}ms (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`,
      )
      setTimeout(startSchedulerWorker, delay)
    }
  })
}

;(globalThis as any).__getSchedulerWorker = () => schedulerWorker
;(globalThis as any).__restartScheduler = () => {
  schedulerWorker?.send('restart')
}

if (!(globalThis as any).__schedulerStarted) {
  ;(globalThis as any).__schedulerStarted = true
  startSchedulerWorker()
}

export default createServerEntry({
  async fetch(request: Request) {
    // Resolve the request locale (cookie → Accept-Language → base) and run the render
    // inside Paraglide's request-scoped context so m.*() and getLocale() are correct
    // during SSR without cross-request bleed.
    return paraglideMiddleware(request, ({ request: localizedRequest }) => handler.fetch(localizedRequest))
  },
})
