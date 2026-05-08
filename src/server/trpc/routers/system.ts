import { router, superAdminProcedure, publicProcedure } from '../init'
import { pool } from '@/lib/db'

export const systemRouter = router({
  dbStatus: publicProcedure.query(async () => {
    try {
      await pool.execute('SELECT 1')
      return { success: true, data: { connected: true } }
    } catch {
      return { success: false, data: { connected: false } }
    }
  }),

  restartDb: superAdminProcedure.mutation(async () => {
    try {
      await pool.execute('SELECT 1')
      return { success: true, message: 'Database connection verified' }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  }),
})
