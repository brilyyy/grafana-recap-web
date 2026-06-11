import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import { triggerRecap, RecapValidationError } from '@/application/recap/trigger-recap'
import { normalizeAppNameToKey } from '@/domain/recap/resolve-app'

export const Route = createFileRoute('/api/processing/process-manual')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { env } = await import('@/env')
          const apiKey = request.headers.get('x-recap-api-key')
          const apiOk = !!env.RECAP_TRIGGER_API_KEY && apiKey === env.RECAP_TRIGGER_API_KEY

          let session: Awaited<ReturnType<typeof requireAuth>> | null = null
          if (!apiOk) {
            session = await requireAuth(request)
            if (session.role !== 'superadmin') {
              return Response.json({ success: false, message: 'Unauthorized' }, { status: 403 })
            }
          }

          const body = await request.json()
          const { app_name, date, catalogEntryId: bodyCatalogId } = body as { app_name?: string; date?: string; catalogEntryId?: string }

          let catalogEntryId = bodyCatalogId?.trim() || null
          if (!catalogEntryId) {
            if (!app_name?.trim()) return Response.json({ success: false, message: 'catalogEntryId or app_name required' }, { status: 400 })
            catalogEntryId = `sr:${normalizeAppNameToKey(app_name)}`
          }

          const dateParam = date?.trim() || null
          if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            return Response.json({ success: false, message: 'Invalid date format' }, { status: 400 })
          }

          const result = await triggerRecap({ catalogEntryId, date: dateParam })

          if (session) {
            await logAuditEvent(session.userId, session.username, `RECAP_MANUAL_${catalogEntryId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`, 'app_processing_log', result.logEntry?.id?.toString() || 'unknown', `Manually triggered ${catalogEntryId}`, getClientIp(request), getUserAgent(request))
          }

          return Response.json({ success: true, message: result.message, data: result })
        } catch (error: any) {
          if (error instanceof RecapValidationError) return Response.json({ success: false, message: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 400 })
          console.error('Error:', error)
          return Response.json({ success: false, message: error.message }, { status: 500 })
        }
      },
    },
  },
})
