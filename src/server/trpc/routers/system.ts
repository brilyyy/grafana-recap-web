import { and, count, desc, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { appIdentifier, appProcessingLog, appSuccessRate, responseCodeDictionary, unmappedRc } from '@/db/schema'
import { protectedProcedure, publicProcedure, router, superAdminProcedure } from '../init'

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

  summary: protectedProcedure.query(async () => {
    const [apps, dictionary, unmapped, noRc, recentLogs] = await Promise.all([
      db.select({ total: count() }).from(appIdentifier),
      db.select({ total: count() }).from(responseCodeDictionary),
      db.select({ total: count() }).from(unmappedRc),
      db
        .select({ total: count() })
        .from(appSuccessRate)
        .where(and(isNull(appSuccessRate.rc), isNull(appSuccessRate.errorType))),
      db
        .select({
          id: appProcessingLog.id,
          app_name: appProcessingLog.appName,
          processing_date: appProcessingLog.processingDate,
          status: appProcessingLog.status,
          records_processed: appProcessingLog.recordsProcessed,
          records_inserted: appProcessingLog.recordsInserted,
          created_at: appProcessingLog.createdAt,
        })
        .from(appProcessingLog)
        .orderBy(desc(appProcessingLog.createdAt))
        .limit(8),
    ])

    return {
      success: true,
      data: {
        counts: {
          applications: apps[0].total,
          dictionaryEntries: dictionary[0].total,
          unmappedRcs: unmapped[0].total,
          noRcTransactions: noRc[0].total,
        },
        recentLogs,
      },
    }
  }),
})
