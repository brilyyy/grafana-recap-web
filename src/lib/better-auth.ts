import argon2 from '@node-rs/argon2'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createAuthMiddleware } from 'better-auth/api'
import { admin, username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { db } from '@/db'
import * as pgSchema from '@/db/schema'
import { env } from '@/env'
import { getClientIp, getUserAgent, logAuditEvent } from '@/lib/audit'

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS
    ? env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [],

  database: drizzleAdapter(db as any, {
    provider: 'pg',
    schema: {
      user: pgSchema.users,
      session: pgSchema.sessions,
      account: pgSchema.accounts,
      verification: pgSchema.verifications,
    },
    usePlural: false,
  }),

  advanced: {
    // Secure cookies are dropped by browsers over plain HTTP (local dev)
    useSecureCookies: env.BETTER_AUTH_URL.startsWith('https'),
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'],
      ipv6Subnet: 64,
    },
  },

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    password: {
      hash: async (password: string) => argon2.hash(password),
      verify: async ({ password, hash }: { password: string; hash: string }) => argon2.verify(hash, password),
    },
  },

  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 60,
    cookieCache: {
      enabled: true,
      maxAge: 300,
      strategy: 'jwe',
    },
  },

  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
    storage: 'memory',
    customRules: {
      '/sign-in/*': { window: 60, max: 5 },
      '/sign-up/*': { window: 60, max: 3 },
      '/change-password': { window: 60, max: 3 },
      '/change-email': { window: 60, max: 3 },
    },
  },

  account: {
    encryptOAuthTokens: true,
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user: any, ctx: any) => {
          const req = ctx?.request
          await logAuditEvent(
            Number(user.id),
            user.username ?? user.name ?? user.email,
            'USER_CREATED',
            'user',
            String(user.id),
            null,
            req ? getClientIp(req) : null,
            req ? getUserAgent(req) : null,
          )
        },
      },
      update: {
        after: async (user: any, ctx: any) => {
          const oldData = ctx?.context?.returned?.user
          const changes: string[] = []
          if (oldData && user.email !== oldData?.email) changes.push('email')
          if (oldData && user.role !== oldData?.role) changes.push('role')
          if (oldData && user.username !== oldData?.username) changes.push('username')
          if (changes.length > 0) {
            await logAuditEvent(
              Number(user.id),
              user.username ?? user.name ?? user.email,
              'USER_UPDATED',
              'user',
              String(user.id),
              `Changed: ${changes.join(', ')}`,
            )
          }
        },
      },
    },
    session: {
      create: {
        after: async (session: any, ctx: any) => {
          const req = ctx?.request
          await logAuditEvent(
            Number(session.userId),
            null,
            'LOGIN_SUCCESS',
            'auth',
            null,
            null,
            req ? getClientIp(req) : null,
            req ? getUserAgent(req) : null,
          )
        },
      },
      delete: {
        before: async (session: any) => {
          await logAuditEvent(Number(session.userId), null, 'LOGOUT', 'auth', session.id, null)
        },
      },
    },
    account: {
      create: {
        after: async (account: any) => {
          await logAuditEvent(
            Number(account.userId),
            null,
            'ACCOUNT_LINKED',
            'account',
            String(account.id),
            `Provider: ${account.providerId}`,
          )
        },
      },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-in/username' || ctx.path === '/sign-in/email') {
        const returned = (ctx as any).context?.returned
        if (returned && 'error' in returned && returned.error) {
          const req = ctx.request
          await logAuditEvent(
            null,
            (ctx as any).body?.username ?? (ctx as any).body?.email ?? null,
            'LOGIN_FAILED',
            'auth',
            null,
            returned.error.message ?? 'Invalid credentials',
            req ? getClientIp(req) : null,
            req ? getUserAgent(req) : null,
          )
        }
      }
    }),
  },

  plugins: [
    username({
      usernameNormalization: false,
    }),
    admin({
      defaultRole: 'user',
      adminRole: ['admin', 'superadmin'],
    }),
    tanstackStartCookies(),
  ],
})

export type Auth = typeof auth
export type Session = typeof auth.$Infer.Session
