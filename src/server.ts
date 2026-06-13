import { fork } from 'node:child_process'
import { resolve } from 'node:path'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import '@/env'

const IS_COMPILED = import.meta.url.endsWith('.mjs') || import.meta.url.endsWith('.js')
const WORKER_PATH = IS_COMPILED
  ? resolve(process.cwd(), 'dist/server/workers/scheduler-worker.mjs')
  : resolve(process.cwd(), 'src/workers/scheduler-worker.ts')
const MAX_RESTART_ATTEMPTS = 5

let schedulerWorker: ReturnType<typeof fork> | null = null
let restartAttempts = 0

function startSchedulerWorker() {
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
    return handler.fetch(request)
  },
})
