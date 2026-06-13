import { randomUUID } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { and, count, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { accounts, pendingUserRequests, users } from '@/db/schema'
import { logAuditEvent } from '@/lib/audit'
import { hashPassword } from '@/lib/auth'
import type { ApiResponse } from '@/types'
import { protectedProcedure, publicProcedure, router, superAdminProcedure } from '../init'

async function createCredentialAccount(userId: number, passwordHash: string): Promise<void> {
  await db.insert(accounts).values({
    id: randomUUID(),
    accountId: String(userId),
    providerId: 'credential',
    userId,
    password: passwordHash,
  })
}

export const authRouter = router({
  check: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session) {
      return { success: true, data: { authenticated: false } } as ApiResponse
    }
    return {
      success: true,
      data: {
        authenticated: true,
        user: {
          id: ctx.session.userId,
          username: ctx.session.username,
          role: ctx.session.role,
        },
      },
    } as ApiResponse
  }),

  checkAdmin: publicProcedure.query(async () => {
    const [result] = await db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.role} = 'admin' OR ${users.role} = 'superadmin'`)
    return {
      success: true,
      data: { adminExists: result.count > 0 },
    } as ApiResponse
  }),

  pendingRequests: superAdminProcedure.query(async () => {
    const requests = await db
      .select({
        id: pendingUserRequests.id,
        username: pendingUserRequests.username,
        email: pendingUserRequests.email,
        requested_role: pendingUserRequests.requestedRole,
        status: pendingUserRequests.status,
        created_at: pendingUserRequests.createdAt,
        updated_at: pendingUserRequests.updatedAt,
        requested_by_username: users.username,
      })
      .from(pendingUserRequests)
      .leftJoin(users, eq(pendingUserRequests.requestedById, users.id))
      .where(eq(pendingUserRequests.status, 'pending'))
      .orderBy(sql`${pendingUserRequests.createdAt} DESC`)
    return { success: true, data: { requests } } as ApiResponse
  }),

  createAdmin: publicProcedure
    .input(z.object({ username: z.string().min(1), email: z.string().email(), password: z.string().min(8) }))
    .mutation(async ({ input }) => {
      const { username, email, password } = input

      const [adminCount] = await db
        .select({ count: count() })
        .from(users)
        .where(sql`${users.role} = 'admin' OR ${users.role} = 'superadmin'`)
      const passwordHash = await hashPassword(password)

      if (adminCount.count > 0) {
        const existingUser = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`${users.username} = ${username} OR ${users.email} = ${email}`)
        if (existingUser.length > 0)
          throw new TRPCError({ code: 'CONFLICT', message: 'Username or email already exists' })

        const existingReq = await db
          .select({ id: pendingUserRequests.id })
          .from(pendingUserRequests)
          .where(sql`${pendingUserRequests.username} = ${username} OR ${pendingUserRequests.email} = ${email}`)
        if (existingReq.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Request already pending' })

        await db.insert(pendingUserRequests).values({
          username,
          email,
          passwordHash,
          requestedRole: 'admin',
          requestedById: null,
          status: 'pending',
        })
        await logAuditEvent(
          null,
          username,
          'ADMIN_REQUEST_SUBMITTED',
          'pending_user_request',
          null,
          `Admin registration request submitted for: ${username}`,
        )
        return {
          success: true,
          message: 'Admin registration request submitted. Awaiting superadmin approval.',
          data: { username, email, requestedRole: 'admin', status: 'pending' },
        } as ApiResponse
      }

      const inserted = await db
        .insert(users)
        .values({ username, email, passwordHash, role: 'admin' })
        .returning({ id: users.id })
      const userId = inserted[0]?.id
      if (userId) {
        await createCredentialAccount(userId, passwordHash)
      }
      await logAuditEvent(
        null,
        username,
        'ADMIN_CREATED',
        'user',
        userId?.toString() ?? 'unknown',
        `First admin user created: ${username}`,
      )
      return { success: true, message: 'Admin user created successfully (first-time setup)' } as ApiResponse
    }),

  submitUserRequest: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        requestedRole: z.enum(['admin', 'user']).default('user'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { username, email, password, requestedRole } = input
      const passwordHash = await hashPassword(password)
      const requestedById = ctx.session?.userId ?? null

      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`${users.username} = ${username} OR ${users.email} = ${email}`)
      if (existingUser.length > 0)
        throw new TRPCError({ code: 'CONFLICT', message: 'Username or email already exists' })

      const existingReq = await db
        .select({ id: pendingUserRequests.id })
        .from(pendingUserRequests)
        .where(sql`${pendingUserRequests.username} = ${username} OR ${pendingUserRequests.email} = ${email}`)
      if (existingReq.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Request already pending' })

      await db.insert(pendingUserRequests).values({
        username,
        email,
        passwordHash,
        requestedRole,
        requestedById,
        status: 'pending',
      })
      await logAuditEvent(
        requestedById,
        ctx.session?.username ?? username,
        'USER_REQUEST_SUBMITTED',
        'pending_user_request',
        null,
        `Registration request submitted for ${username} as ${requestedRole}`,
      )
      return { success: true, message: 'Registration request submitted. Awaiting approval.' } as ApiResponse
    }),

  approveRequest: superAdminProcedure
    .input(z.object({ id: z.number().int().positive(), approvedRole: z.enum(['superadmin', 'admin', 'user']) }))
    .mutation(async ({ input, ctx }) => {
      const { id, approvedRole } = input

      const [pending] = await db
        .select()
        .from(pendingUserRequests)
        .where(and(eq(pendingUserRequests.id, id), eq(pendingUserRequests.status, 'pending')))
      if (!pending) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending request not found' })

      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(users)
          .values({
            username: pending.username,
            email: pending.email,
            passwordHash: pending.passwordHash,
            role: approvedRole,
          })
          .returning({ id: users.id })
        const userId = inserted[0]?.id
        if (userId) {
          await tx.insert(accounts).values({
            id: randomUUID(),
            accountId: String(userId),
            providerId: 'credential',
            userId,
            password: pending.passwordHash,
          })
        }
        await tx
          .update(pendingUserRequests)
          .set({
            status: 'approved',
            approvedRole,
            approvedById: ctx.session.userId,
            updatedAt: sql`NOW()`,
          })
          .where(eq(pendingUserRequests.id, id))
      })

      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'USER_REQUEST_APPROVED',
        'pending_user_request',
        id.toString(),
        `Approved: ${pending.username} as ${approvedRole}`,
      )
      return { success: true, message: `User "${pending.username}" created with role "${approvedRole}"` } as ApiResponse
    }),

  rejectRequest: superAdminProcedure
    .input(z.object({ id: z.number().int().positive(), rejectionReason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { id, rejectionReason } = input

      const [pending] = await db
        .select()
        .from(pendingUserRequests)
        .where(and(eq(pendingUserRequests.id, id), eq(pendingUserRequests.status, 'pending')))
      if (!pending) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending request not found' })

      await db
        .update(pendingUserRequests)
        .set({
          status: 'rejected',
          rejectedById: ctx.session.userId,
          rejectionReason: rejectionReason ?? null,
          updatedAt: sql`NOW()`,
        })
        .where(eq(pendingUserRequests.id, id))

      await logAuditEvent(
        ctx.session.userId,
        ctx.session.username,
        'USER_REQUEST_REJECTED',
        'pending_user_request',
        id.toString(),
        `Rejected: ${pending.username}`,
      )
      return { success: true, message: 'User request rejected' } as ApiResponse
    }),

  me: protectedProcedure.query(({ ctx }) => ({
    success: true,
    data: { user: { id: ctx.session.userId, username: ctx.session.username, role: ctx.session.role } },
  })),
})
