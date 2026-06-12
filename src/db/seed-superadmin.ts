#!/usr/bin/env node
/**
 * Standalone Superadmin Seeder (Drizzle ORM)
 *
 * Reads DEFAULT_SU_USERNAME, DEFAULT_SU_PASSWORD, DEFAULT_SU_EMAIL from .env.
 * Supports comma-separated values for multiple superadmins.
 *
 * Upserts into `users` table with role `superadmin` and links BetterAuth
 * credential accounts with argon2 password hashing.
 *
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   pnpm db:seed-superadmin
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, users } from '@/db/schema'
import { hashPassword } from '@/lib/auth'

async function main() {
  const usernames = (process.env.DEFAULT_SU_USERNAME ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const passwords = (process.env.DEFAULT_SU_PASSWORD ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const emails = (process.env.DEFAULT_SU_EMAIL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (usernames.length === 0 || passwords.length === 0) {
    console.log('⏭  No DEFAULT_SU_USERNAME/PASSWORD set — nothing to seed')
    process.exit(0)
  }
  if (usernames.length !== passwords.length) {
    console.error('❌ DEFAULT_SU_USERNAME and DEFAULT_SU_PASSWORD must have the same number of comma-separated values')
    process.exit(1)
  }

  console.log('\n🌱 Seeding superadmin(s)')

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i]
    const password = passwords[i]
    const email = (emails[i] ?? `${username}@superadmin.local`).toLowerCase()

    if (password.length < 8) {
      console.warn(`  ⚠️  Password for "${username}" is too short (< 8 chars) — skipping`)
      continue
    }

    try {
      const passwordHash = await hashPassword(password)

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username))

      let userId: number

      if (existing.length > 0) {
        userId = existing[0].id
        await db
          .update(users)
          .set({
            email,
            passwordHash,
            name: username,
            emailVerified: 1,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
        console.log(`  ✅ Superadmin "${username}" updated (id=${userId})`)
      } else {
        const inserted = await db
          .insert(users)
          .values({
            username,
            email,
            passwordHash,
            role: 'superadmin',
            name: username,
            emailVerified: 1,
          })
          .returning({ id: users.id })
        userId = inserted[0].id
        console.log(`  ✅ Superadmin "${username}" created (id=${userId})`)
      }

      const existingAccount = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.userId, userId))

      if (existingAccount.length > 0) {
        await db
          .update(accounts)
          .set({ password: passwordHash, updatedAt: new Date() })
          .where(eq(accounts.id, existingAccount[0].id))
        console.log(`  ✅ Credential account updated`)
      } else {
        const { randomUUID } = await import('node:crypto')
        await db.insert(accounts).values({
          id: randomUUID(),
          accountId: String(userId),
          providerId: 'credential',
          userId,
          password: passwordHash,
        })
        console.log(`  ✅ Credential account linked`)
      }
    } catch (e: unknown) {
      console.error(`  ❌ Failed to seed "${username}":`, (e as Error).message)
    }
  }

  console.log('\n✅ Done\n')
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err)
  process.exit(1)
})
