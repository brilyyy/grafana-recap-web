import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/env'
import { requireAuth } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'
import { normalizeAppNameToKey } from '@/domain/recap/resolve-app'
import { triggerRecap, RecapValidationError } from '@/application/recap/trigger-recap'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

/**
 * POST /api/processing/process-manual
 * Body:
 * - Preferred: { catalogEntryId: string, date?: string }
 * - Legacy: { app_name: string, date?: string } → maps to catalog sr:{appKey}
 *
 * Auth: superadmin session OR x-recap-api-key matching RECAP_TRIGGER_API_KEY (PostgreSQL only).
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-recap-api-key')
    const apiOk =
      !!env.RECAP_TRIGGER_API_KEY &&
      apiKey === env.RECAP_TRIGGER_API_KEY

    let session: Awaited<ReturnType<typeof requireAuth>> | null = null
    if (!apiOk) {
      session = await requireAuth(request)
      if (session.role !== 'superadmin') {
        return NextResponse.json(
          {
            success: false,
            message: 'Unauthorized: Only superadmin can trigger manual processing',
          } as ApiResponse,
          { status: 403 },
        )
      }
    }

    if (!isPostgres) {
      return NextResponse.json(
        {
          success: false,
          message: 'Manual processing recap API requires PostgreSQL (DB_TYPE=postgresql).',
        } as ApiResponse,
        { status: 400 },
      )
    }

    const body = await request.json()
    const { app_name, date, catalogEntryId: bodyCatalogId } = body as {
      app_name?: string
      date?: string
      catalogEntryId?: string
    }

    let catalogEntryId = bodyCatalogId?.trim() || null
    if (!catalogEntryId) {
      if (!app_name?.trim()) {
        return NextResponse.json(
          { success: false, message: 'catalogEntryId or app_name is required' } as ApiResponse,
          { status: 400 },
        )
      }
      const appKey = normalizeAppNameToKey(app_name)
      catalogEntryId = `sr:${appKey}`
    }

    const dateParam = date && String(date).trim() ? String(date).trim() : null
    if (dateParam) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(dateParam)) {
        return NextResponse.json(
          { success: false, message: 'Invalid date format. Use YYYY-MM-DD' } as ApiResponse,
          { status: 400 },
        )
      }
    }

    let result
    try {
      result = await triggerRecap({ catalogEntryId, date: dateParam })
    } catch (e: unknown) {
      if (e instanceof RecapValidationError) {
        return NextResponse.json(
          { success: false, message: e.message } as ApiResponse,
          { status: e.code === 'NOT_FOUND' ? 404 : 400 },
        )
      }
      const errMsg = (e as Error).message ?? String(e)
      if (errMsg.includes('relation') && errMsg.includes('does not exist')) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Required table or foreign table is missing. Ensure CDC/FDW and migration have been applied.',
            detail: errMsg,
          } as ApiResponse,
          { status: 404 },
        )
      }
      if (errMsg.includes('does not exist') && (errMsg.includes('function') || errMsg.includes('Function'))) {
        return NextResponse.json(
          {
            success: false,
            message: 'Processing function not found. Run db:migrate to install procedures.',
            detail: errMsg,
          } as ApiResponse,
          { status: 404 },
        )
      }
      throw e
    }

    const logEntry = result.logEntry
    if (session) {
      const label = app_name?.trim() || catalogEntryId
      await logAuditEvent(
        session.userId,
        session.username,
        `RECAP_MANUAL_${catalogEntryId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
        'app_processing_log',
        logEntry?.id?.toString() || 'unknown',
        `Manually triggered recap ${catalogEntryId}${dateParam ? ` for ${dateParam}` : ' (H-1)'}. Status: ${logEntry?.status || 'unknown'}`,
        getClientIp(request),
        getUserAgent(request),
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: {
        catalogEntryId,
        processingDate: result.processingDateLabel,
        targetDate: result.targetDate,
        logEntry: logEntry
          ? {
              id: logEntry.id,
              status: logEntry.status,
              recordsProcessed: logEntry.recordsProcessed,
              recordsInserted: logEntry.recordsInserted,
              startTime: logEntry.startTime,
              endTime: logEntry.endTime,
              errorMessage: logEntry.errorMessage,
              recapKind: logEntry.recapKind,
            }
          : null,
      },
    } as ApiResponse)
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message?.includes('Unauthorized') || err.message?.includes('Forbidden')) {
      return NextResponse.json({ success: false, message: err.message } as ApiResponse, { status: 403 })
    }

    console.error('Error triggering processing:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error triggering processing: ' + (err.message ?? String(error)),
      } as ApiResponse,
      { status: 500 },
    )
  }
}
