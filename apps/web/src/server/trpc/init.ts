import { initTRPC, TRPCError } from '@trpc/server'
import { db } from '@/db'
import type { SessionPayload } from '@/lib/auth'
import { auth } from '@/lib/better-auth'
import { getLogger } from '@/lib/logger'

const trpcLog = getLogger('trpc')

export async function createTRPCContext(opts: { headers: Headers }) {
  const betterSession = await auth.api.getSession({ headers: opts.headers }).catch(() => null)

  const session: SessionPayload | null = betterSession?.user
    ? {
        userId: Number(betterSession.user.id),
        username: (betterSession.user as any).username ?? betterSession.user.name ?? betterSession.user.email,
        role: ((betterSession.user as any).role ?? 'user') as SessionPayload['role'],
      }
    : null

  return { session, db, headers: opts.headers }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router

/**
 * Operational logging for every procedure: name, type, caller, outcome and
 * duration. Sits at the base of all procedures so all ~62 are covered in one
 * place. Does NOT duplicate `audit_logs` (user action trail).
 */
const loggingMiddleware = t.middleware(async ({ path, type, ctx, next }) => {
  const start = performance.now()
  const result = await next()
  const durationMs = Math.round((performance.now() - start) * 100) / 100
  const meta = {
    path,
    type,
    user: ctx.session?.username,
    durationMs,
    ok: result.ok,
  }
  if (result.ok) {
    trpcLog.info(meta, `${type} ${path}`)
  } else {
    trpcLog.error({ ...meta, err: result.error }, `${type} ${path} failed`)
  }
  return result
})

export const publicProcedure = t.procedure.use(loggingMiddleware)

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})

const enforceAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  const { role } = ctx.session
  if (role !== 'admin' && role !== 'superadmin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'admin role required' })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})

const enforceSuperAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  if (ctx.session.role !== 'superadmin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'superadmin role required' })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})

export const protectedProcedure = publicProcedure.use(enforceAuth)
export const adminProcedure = publicProcedure.use(enforceAdmin)
export const superAdminProcedure = publicProcedure.use(enforceSuperAdmin)
