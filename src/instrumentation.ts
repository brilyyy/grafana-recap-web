/**
 * Next.js Instrumentation Hook
 * This file is automatically called when the Next.js server starts
 * Only runs on server-side
 */

export async function register() {
  if (typeof window === 'undefined') {
    try {
      // Static import path - webpack config handles server-only modules
      const { initializeScheduler } = await import('./lib/scheduler')
      await initializeScheduler()
    } catch (error: any) {
      console.error('❌ Failed to initialize scheduler:', error.message)
    }
  }
}
