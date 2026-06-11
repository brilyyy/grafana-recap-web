import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@/lib/better-auth'
import { db } from '@/db'
import type { SessionPayload } from '@/lib/auth'

/**
 * tRPC context – created per request.
 * Headers MUST be passed in (no more next/headers auto-read).
 */
export async function createTRPCContext(opts: { headers: Headers }) {
  const betterSession = await auth.api.getSession({ headers: opts.headers }).catch(() => null)

  const session: SessionPayload | null = betterSession?.user
    ? {
        userId: Number(betterSession.user.id),
        username:
          (betterSession.user as any).username ??
          betterSession.user.name ??
          betterSession.user.email,
        role: ((betterSession.user as any).role ?? 'user') as SessionPayload['role'],
      }
    : null

  return { session, db, headers: opts.headers }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

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

export const protectedProcedure = t.procedure.use(enforceAuth)
export const adminProcedure = t.procedure.use(enforceAdmin)
export const superAdminProcedure = t.procedure.use(enforceSuperAdmin)
