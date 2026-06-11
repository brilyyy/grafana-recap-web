import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { publicProcedure, router, superAdminProcedure } from '../init'

export const systemRouter = router({
  dbStatus: publicProcedure.query(async () => {
    try {
      await db.execute(sql`SELECT 1`)
      return { success: true, data: { connected: true } }
    } catch {
      return { success: false, data: { connected: false } }
    }
  }),

  restartDb: superAdminProcedure.mutation(async () => {
    try {
      await db.execute(sql`SELECT 1`)
      return { success: true, message: 'Database connection verified' }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  }),
})
