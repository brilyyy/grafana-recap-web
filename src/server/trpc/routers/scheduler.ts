import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { schedulerJobs } from '@/db/schema/scheduler'
import { logAuditEvent } from '@/lib/audit'
import { router, superAdminProcedure } from '../init'

function restartSchedulerWorker() {
  const restart = (globalThis as any).__restartScheduler
  if (typeof restart === 'function') {
    restart()
  }
}

export const schedulerRouter = router({
  listJobs: superAdminProcedure.query(async () => {
    const jobs = await db.select().from(schedulerJobs).orderBy(schedulerJobs.name)
    return { success: true as const, data: jobs }
  }),

  createJob: superAdminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        procedure: z.string().min(1),
        schedule: z.string().min(1).default('1 0 * * *'),
        timezone: z.string().optional().default('Asia/Jakarta'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const [job] = await db
          .insert(schedulerJobs)
          .values({
            name: input.name,
            procedure: input.procedure,
            schedule: input.schedule,
            timezone: input.timezone,
          })
          .returning()

        await logAuditEvent(
          ctx.session.userId,
          ctx.session.username,
          'SCHEDULER_JOB_CREATED',
          'scheduler_jobs',
          job.id.toString(),
          `Created job: ${input.name} (${input.procedure}) schedule=${input.schedule}`,
        )

        restartSchedulerWorker()
        return { success: true as const, data: job, message: 'Job created. Scheduler worker restarting.' }
      } catch (e: any) {
        if (e?.code === '23505' || e?.message?.includes('unique')) {
          throw new TRPCError({ code: 'CONFLICT', message: `Job with procedure '${input.procedure}' already exists` })
        }
        throw e
      }
    }),

  updateJob: superAdminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).optional(),
        schedule: z.string().min(1).optional(),
        timezone: z.string().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input
      if (Object.keys(updates).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' })
      }

      const [job] = await db
        .update(schedulerJobs)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schedulerJobs.id, id))
        .returning()

      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' })
      }

      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'SCHEDULER_JOB_UPDATED',
        'scheduler_jobs',
        id.toString(),
        `Updated job: ${JSON.stringify(updates)}`,
      )

      restartSchedulerWorker()
      return { success: true as const, data: job, message: 'Job updated. Scheduler worker restarting.' }
    }),

  deleteJob: superAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const [job] = await db.delete(schedulerJobs).where(eq(schedulerJobs.id, input.id)).returning()

      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' })
      }

      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'SCHEDULER_JOB_DELETED',
        'scheduler_jobs',
        input.id.toString(),
        `Deleted job: ${job.name} (${job.procedure})`,
      )

      restartSchedulerWorker()
      return { success: true as const, message: 'Job deleted. Scheduler worker restarting.' }
    }),

  restartWorker: superAdminProcedure.mutation(async ({ ctx }) => {
    await logAuditEvent(
      ctx.session.userId,
      ctx.session.username,
      'SCHEDULER_WORKER_RESTART',
      'scheduler_jobs',
      '',
      'Manual scheduler worker restart',
    )
    restartSchedulerWorker()
    return { success: true as const, message: 'Scheduler worker restart signal sent.' }
  }),

  workerStatus: superAdminProcedure.query(() => {
    const worker = (globalThis as any).__getSchedulerWorker?.()
    return {
      success: true as const,
      data: {
        pid: worker?.pid ?? null,
        connected: worker?.connected ?? false,
      },
    }
  }),
})
