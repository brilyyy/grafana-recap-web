import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { db } from '@/db'
import { applyPhase, type ColumnResolutions, detectColumnConflicts, diagnose, type Phase } from '@/db/schema-engine'
import { logAuditEvent } from '@/lib/audit'
import { router, superAdminProcedure } from '../init'

const phaseEnum = z.enum(['schema', 'core', 'better-auth', 'processing-log', 'recap-tables', 'indexes', 'fdw', 'procedures', 'seed', 'cron', 'all'])

export const setupRouter = router({
  /** Read-only schema/config doctor. Executes no DDL. */
  diagnose: superAdminProcedure.query(async () => {
    const report = await diagnose(db)
    return { success: true, data: report }
  }),

  /**
   * Read-only pre-flight: NOT NULL columns that would conflict (table already has rows) when the
   * schema phase runs. The UI lets the user pick null/random for each before applying.
   */
  preflight: superAdminProcedure.query(async () => {
    const conflicts = await detectColumnConflicts(db)
    return { success: true, data: { conflicts } }
  }),

  /** Run an idempotent migration phase against the connected DB. Superadmin-only, audited. */
  migrate: superAdminProcedure
    .input(
      z.object({
        phase: phaseEnum,
        resolutions: z.record(z.string(), z.enum(['null', 'random'])).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const phase = input.phase as Phase
      const resolutions = (input.resolutions ?? {}) as ColumnResolutions
      const steps: string[] = []
      const log = (line: string) => steps.push(line)

      try {
        // `db.$client` is the underlying postgres-js client (needed for postgres_fdw setup).
        await applyPhase(db, db.$client, phase, log, resolutions)
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        steps.push(`\n❌ ${message}`)
        await logAuditEvent(
          ctx.session.userId,
          ctx.session.username,
          'APP_SETUP_MIGRATE_FAILED',
          'system',
          null,
          `phase=${phase}: ${message}`,
        )
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message, cause: { steps } })
      }

      const resolvedCount = Object.keys(resolutions).length
      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'APP_SETUP_MIGRATE',
        'system',
        null,
        `phase=${phase}${resolvedCount > 0 ? `, conflicts_resolved=${resolvedCount}` : ''}`,
      )

      return { success: true, data: { steps }, message: `Migration phase "${phase}" completed` }
    }),
})
