/**
 * Next.js server startup hook
 * Runs once when server starts (production)
 */

let initialized = false

export async function register() {

  // Only run in Node.js runtime (not edge, not browser)
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  // Prevent double initialization
  if (initialized) {
    console.log('ℹ️ Scheduler already initialized')
    return
  }
  initialized = true
  console.log('🚀 instrumentation.ts: Starting server initialization...')

  try {
    const { initializeScheduler } = await import('@/lib/scheduler')
    await initializeScheduler()
    console.log('✅ instrumentation.ts: Scheduler initialized')
  } catch (error: any) {
    console.error('❌ instrumentation.ts: Scheduler failed to start')
    console.error(error)
  }
}
