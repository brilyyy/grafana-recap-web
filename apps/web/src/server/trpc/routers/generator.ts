import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../init'

const API = process.env.GENERATOR_API_URL ?? 'http://localhost:8321'

// ── Types (mirror sr-gen Python models) ───────────────────────

interface HealthResponse {
  status: string
  db_configured: boolean
  db_connected: boolean
}

interface DbApp {
  app_id: string
  app_name: string
}

interface MappingInfo {
  name: string
  app_id: string
  generate_from?: string
}

interface GenerateResponse {
  app_name: string
  output_path?: string | null
  success: boolean
  message: string
}

interface ReportInfo {
  filename: string
  path: string
  size_bytes: number
  created_at: string
}

// ── Fetch helper ──────────────────────────────────────────────

async function srGenFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new TRPCError({
      code: res.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
      message: body.detail ?? res.statusText,
    })
  }
  return res.json() as Promise<T>
}

// ── Router ────────────────────────────────────────────────────

export const generatorRouter = router({
  health: protectedProcedure.query(async () => {
    return srGenFetch<HealthResponse>('/health')
  }),

  listApps: protectedProcedure.query(async () => {
    return srGenFetch<DbApp[]>('/apps/db')
  }),

  listMappings: protectedProcedure.query(async () => {
    return srGenFetch<MappingInfo[]>('/apps/mappings')
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
      return srGenFetch<GenerateResponse>('/generate/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    }),

  generateExcel: protectedProcedure.input(z.any()).mutation(async ({ input }) => {
    const form = input as FormData
    const res = await fetch(`${API}/generate/excel`, { method: 'POST', body: form })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }))
      throw new TRPCError({ code: 'BAD_REQUEST', message: body.detail ?? res.statusText })
    }
    return res.json()
  }),

  listReports: protectedProcedure.query(async () => {
    return srGenFetch<ReportInfo[]>('/reports')
  }),

  deleteReport: protectedProcedure.input(z.object({ filename: z.string() })).mutation(async ({ input }) => {
    return srGenFetch<Record<string, string>>(`/reports/${input.filename}`, {
      method: 'DELETE',
    })
  }),

  getReportDownloadUrl: protectedProcedure
    .input(z.object({ filename: z.string() }))
    .query(async ({ input }) => {
      return { url: `${API}/reports/${input.filename}` }
    }),
})
