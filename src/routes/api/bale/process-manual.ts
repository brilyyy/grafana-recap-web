import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'

export const Route = createFileRoute('/api/bale/process-manual')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await requireAuth(request)
          if (session.role !== 'superadmin') {
            return Response.json({ success: false, message: 'Unauthorized' }, { status: 403 })
          }

          const { searchParams } = new URL(request.url)
          const dateParam = searchParams.get('date')

          let processingDate: Date | null = null
          if (dateParam) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
              return Response.json({ success: false, message: 'Invalid date format' }, { status: 400 })
            }
            processingDate = new Date(dateParam)
          }

          const dateParamForDB = processingDate ? processingDate.toISOString().split('T')[0] : null
          await db.execute(sql`SELECT public.sp_process_bale_daily(${dateParamForDB}::date)`)

          const logResult = await db.execute(sql`SELECT * FROM app_processing_log WHERE app_name = 'Bale' ORDER BY created_at DESC LIMIT 1`)
          const logEntry = logResult.rows[0] as any

          await logAuditEvent(session.userId, session.username, 'BALE_PROCESSING_MANUAL_TRIGGER', 'app_processing_log', logEntry?.id?.toString() || 'unknown', `Manually triggered BALE processing${processingDate ? ` for ${dateParam}` : ' (H-1)'}`, getClientIp(request), getUserAgent(request))

          return Response.json({
            success: true,
            message: `BALE processing triggered${processingDate ? ` for ${dateParam}` : ' (H-1)'}`,
            data: { processingDate: processingDate ? dateParam : 'H-1', logEntry: logEntry ? { id: logEntry.id, status: logEntry.status, recordsProcessed: logEntry.records_processed, recordsInserted: logEntry.records_inserted } : null },
          })
        } catch (error: any) {
          if (error.message?.includes('Unauthorized')) return Response.json({ success: false, message: error.message }, { status: 403 })
          console.error('Error:', error)
          return Response.json({ success: false, message: error.message }, { status: 500 })
        }
      },
    },
  },
})
