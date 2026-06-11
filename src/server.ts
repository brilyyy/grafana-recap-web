import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

// Initialize scheduler on server boot
if (process.env.USE_APP_LEVEL_SCHEDULER === 'true') {
  if (!(globalThis as any).__schedulerStarted) {
    ;(globalThis as any).__schedulerStarted = true
    import('@/lib/scheduler').then(({ initializeScheduler }) => initializeScheduler())
  }
}

export default createServerEntry({
  async fetch(request: Request) {
    return handler.fetch(request)
  },
})
