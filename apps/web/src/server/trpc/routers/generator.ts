import { PolyRPCError, py } from '@repo/api'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../init'

function handleSrGenError(err: unknown): never {
  if (err instanceof PolyRPCError) {
    const detail = err.data as { detail?: string } | undefined
    throw new TRPCError({
      code: err.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
      message: detail?.detail ?? err.message,
    })
  }
  if (err instanceof Error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message })
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'sr-generator error' })
}

export const generatorRouter = router({
  health: protectedProcedure.query(async () => {
    try {
      return await py.health.health.query()
    } catch (err) {
      handleSrGenError(err)
    }
  }),

  listApps: protectedProcedure.query(async () => {
    try {
      return await py.apps.list_db_apps_endpoint.query()
    } catch (err) {
      handleSrGenError(err)
    }
  }),

  listMappings: protectedProcedure.query(async () => {
    try {
      return await py.apps.list_mappings.query()
    } catch (err) {
      handleSrGenError(err)
    }
  }),

  generateDb: protectedProcedure
    .input(
      z.object({
        app_name: z.string(),
        app_id: z.string(),
        master_date_from: z.string(),
        master_date_to: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await py.generate.generate_db.mutate(input)
      } catch (err) {
        handleSrGenError(err)
      }
    }),

  generateExcel: protectedProcedure.input(z.any()).mutation(async ({ input }) => {
    try {
      const form = input as FormData
      const res = await fetch(`${process.env.SR_GEN_BASE_URL || 'http://localhost:8321'}/generate/excel`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }))
        throw new TRPCError({ code: 'BAD_REQUEST', message: detail.detail ?? res.statusText })
      }
      return await res.json()
    } catch (err) {
      if (err instanceof TRPCError) throw err
      handleSrGenError(err)
    }
  }),

  listReports: protectedProcedure.query(async () => {
    try {
      return await py.reports.list_reports.query()
    } catch (err) {
      handleSrGenError(err)
    }
  }),

  deleteReport: protectedProcedure.input(z.object({ filename: z.string() })).mutation(async ({ input }) => {
    try {
      return await py.reports.delete_report.mutate({ filename: input.filename })
    } catch (err) {
      handleSrGenError(err)
    }
  }),
})
