import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { eq, and, or, ilike, desc, count, sql, type SQL } from 'drizzle-orm'
import { router, superAdminProcedure } from '../init'
import { db } from '@/db'
import { users } from '@/db/schema'
import { hashPassword } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export const usersRouter = router({
  list: superAdminProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(20), search: z.string().optional(), role: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1
      const limit = input?.limit ?? 20
      const offset = (page - 1) * limit
      const search = input?.search ?? ''
      const role = input?.role ?? ''

      const conditions: SQL[] = []
      if (search) {
        conditions.push(or(ilike(users.username, `%${search}%`), ilike(users.email, `%${search}%`))!)
      }
      if (role) {
        conditions.push(eq(users.role, role as 'superadmin' | 'admin' | 'user'))
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined

      const rows = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          created_at: users.createdAt,
          updated_at: users.updatedAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset)
      const countResult = await db.select({ total: count() }).from(users).where(where)
      const total = countResult[0].total

      return { success: true, data: { users: rows, total, page, limit, totalPages: Math.ceil(total / limit) } }
    }),

  get: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          created_at: users.createdAt,
          updated_at: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, input.id))
      if (rows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
      return { success: true, data: { user: rows[0] } }
    }),

  update: superAdminProcedure
    .input(z.object({ id: z.number().int(), role: z.enum(['superadmin', 'admin', 'user']).optional(), email: z.string().email().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { id, role, email } = input
      const set: Record<string, unknown> = {}
      const updatedFields: string[] = []
      if (role) { set.role = role; updatedFields.push('role') }
      if (email) { set.email = email; updatedFields.push('email') }
      if (updatedFields.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' })
      set.updatedAt = sql`NOW()`
      await db.update(users).set(set).where(eq(users.id, id))
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'USER_UPDATED', 'user', id.toString(), `Updated: ${updatedFields.join(', ')}`)
      return { success: true, message: 'User updated successfully' }
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const rows = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.id, input.id))
      if (rows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
      if (rows[0].id === ctx.session.userId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete yourself' })
      await db.delete(users).where(eq(users.id, input.id))
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'USER_DELETED', 'user', input.id.toString(), `Deleted: ${rows[0].username}`)
      return { success: true, message: 'User deleted' }
    }),

  create: superAdminProcedure
    .input(z.object({ username: z.string().min(1), email: z.string().email(), password: z.string().min(8), role: z.enum(['superadmin', 'admin', 'user']).default('user') }))
    .mutation(async ({ input, ctx }) => {
      const { username, email, password, role } = input
      const passwordHash = await hashPassword(password)
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.username, username), eq(users.email, email)))
      if (existing.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Username or email already exists' })
      const inserted = await db
        .insert(users)
        .values({ username, email, passwordHash, role })
        .returning({ id: users.id })
      const userId = inserted[0]?.id ?? 0
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'USER_CREATED', 'user', userId.toString(), `Created ${role}: ${username}`)
      return { success: true, message: `User "${username}" created`, data: { userId, username, email, role } }
    }),
})
