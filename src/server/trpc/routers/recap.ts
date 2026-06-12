import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { RecapValidationError, triggerRecap } from '@/application/recap/trigger-recap'
import { buildRecapCatalog, getCatalogEntryById } from '@/domain/recap/catalog'
import { normalizeAppNameToKey } from '@/domain/recap/resolve-app'
import { env } from '@/env'
import { logAuditEvent } from '@/lib/audit'
import { publicProcedure, router, superAdminProcedure } from '../init'

function resolvedSchedule(envVar: string | null): string | null {
  if (!envVar) return null
  const v = (process.env as Record<string, string | undefined>)[envVar]
  return v ?? '1 0 * * *'
}

export const recapRouter = router({
  listCatalog: superAdminProcedure.query(() => {
    const entries = buildRecapCatalog().map((e) => ({
      ...e,
      scheduleCronResolved: resolvedSchedule(e.scheduleEnvVar),
    }))
    return { success: true as const, data: entries }
  }),

  getCatalogEntry: superAdminProcedure.input(z.object({ id: z.string() })).query(({ input }) => {
    const e = getCatalogEntryById(input.id)
    if (!e) throw new TRPCError({ code: 'NOT_FOUND', message: 'Catalog entry not found' })
    return {
      success: true as const,
      data: { ...e, scheduleCronResolved: resolvedSchedule(e.scheduleEnvVar) },
    }
  }),

  triggerManual: superAdminProcedure
    .input(
      z.object({
        catalogEntryId: z.string(),
        date: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await triggerRecap({
          catalogEntryId: input.catalogEntryId,
          date: input.date ?? null,
        })
        await logAuditEvent(
          ctx.session.userId,
          ctx.session.username,
          `RECAP_MANUAL_${input.catalogEntryId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
          'app_processing_log',
          result.logEntry?.id?.toString() || 'unknown',
          `Manually triggered recap ${input.catalogEntryId}${input.date ? ` for ${input.date}` : ' (H-1)'}. Status: ${result.logEntry?.status || 'unknown'}`,
        )
        return { success: true as const, data: result }
      } catch (e: unknown) {
        if (e instanceof RecapValidationError) {
          throw new TRPCError({
            code: e.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: e.message,
          })
        }
        throw e
      }
    }),

  /**
   * Machine-to-machine trigger (replaces POST /api/processing/process-manual).
   * Authenticated by the x-recap-api-key header, not a session.
   */
  triggerExternal: publicProcedure
    .input(
      z.object({
        app_name: z.string().min(1).optional(),
        catalogEntryId: z.string().min(1).optional(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD')
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const apiKey = ctx.headers.get('x-recap-api-key')
      if (!env.RECAP_TRIGGER_API_KEY || apiKey !== env.RECAP_TRIGGER_API_KEY) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or missing x-recap-api-key' })
      }

      const catalogEntryId =
        input.catalogEntryId?.trim() || (input.app_name?.trim() ? `sr:${normalizeAppNameToKey(input.app_name)}` : null)
      if (!catalogEntryId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'catalogEntryId or app_name required' })
      }

      try {
        const result = await triggerRecap({ catalogEntryId, date: input.date ?? null })
        await logAuditEvent(
          null,
          'external-api',
          'RECAP_EXTERNAL_TRIGGER',
          'app_processing_log',
          result.logEntry?.id?.toString() || 'unknown',
          `Externally triggered ${catalogEntryId}${input.date ? ` for ${input.date}` : ' (H-1)'}`,
          ctx.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ctx.headers.get('x-real-ip'),
          ctx.headers.get('user-agent'),
        )
        return { success: true as const, message: result.message, data: result }
      } catch (e: unknown) {
        if (e instanceof RecapValidationError) {
          throw new TRPCError({
            code: e.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: e.message,
          })
        }
        throw e
      }
    }),
})
