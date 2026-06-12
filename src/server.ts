import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import '@/env'

if (!(globalThis as any).__schedulerStarted) {
  ;(globalThis as any).__schedulerStarted = true
  import('@/lib/scheduler').then(({ initializeScheduler }) => initializeScheduler())
}

export default createServerEntry({
  async fetch(request: Request) {
    return handler.fetch(request)
  },
})
