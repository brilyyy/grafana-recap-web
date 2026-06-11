import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/db'
import { env } from '@/env'
import * as pgSchema from '@/db/schema'

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

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

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },

  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: false,
        input: true,
      },
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false,
      },
    },
  },

  plugins: [
    admin({
      defaultRole: 'user',
      adminRole: ['admin', 'superadmin'],
    }),
    nextCookies(),
  ],
})

export type Auth = typeof auth
export type Session = typeof auth.$Infer.Session
