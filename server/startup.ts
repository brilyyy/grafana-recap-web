'use server'

let started = false

export async function startServer() {

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return
  }

  if (started) {
    return
  }

  started = true

  console.log('🚀 Starting server initialization...')

  const { initializeScheduler } = await import('@/lib/scheduler')

  await initializeScheduler()

  console.log('✅ Server initialization complete')
}
