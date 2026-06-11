import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { RecapValidationError, triggerRecap } from '@/application/recap/trigger-recap'
import { buildRecapCatalog, getCatalogEntryById } from '@/domain/recap/catalog'
import { logAuditEvent } from '@/lib/audit'
import { router, superAdminProcedure } from '../init'

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
})
