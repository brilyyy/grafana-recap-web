import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, superAdminProcedure } from '../init'
import { pool } from '@/lib/db'
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

      let whereClause = 'WHERE 1=1'
      const params: any[] = []
      if (search) { whereClause += ' AND (username LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
      if (role) { whereClause += ' AND role = ?'; params.push(role) }

      const [users]: any = await pool.execute(`SELECT id, username, email, role, created_at, updated_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
      const [countResult]: any = await pool.execute(`SELECT COUNT(*) as total FROM users ${whereClause}`, params)
      const total = countResult[0].total

      return { success: true, data: { users, total, page, limit, totalPages: Math.ceil(total / limit) } }
    }),

  get: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const [users]: any = await pool.execute('SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?', [input.id])
      if (users.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
      return { success: true, data: { user: users[0] } }
    }),

  update: superAdminProcedure
    .input(z.object({ id: z.number().int(), role: z.enum(['superadmin', 'admin', 'user']).optional(), email: z.string().email().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { id, role, email } = input
      const updates: string[] = []
      const params: any[] = []
      if (role) { updates.push('role = ?'); params.push(role) }
      if (email) { updates.push('email = ?'); params.push(email) }
      if (updates.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' })
      params.push(id)
      await pool.execute(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params)
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'USER_UPDATED', 'user', id.toString(), `Updated: ${updates.join(', ')}`)
      return { success: true, message: 'User updated successfully' }
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const [users]: any = await pool.execute('SELECT id, username FROM users WHERE id = ?', [input.id])
      if (users.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
      if (users[0].id === ctx.session.userId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete yourself' })
      await pool.execute('DELETE FROM users WHERE id = ?', [input.id])
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'USER_DELETED', 'user', input.id.toString(), `Deleted: ${users[0].username}`)
      return { success: true, message: 'User deleted' }
    }),

  create: superAdminProcedure
    .input(z.object({ username: z.string().min(1), email: z.string().email(), password: z.string().min(8), role: z.enum(['superadmin', 'admin', 'user']).default('user') }))
    .mutation(async ({ input, ctx }) => {
      const { username, email, password, role } = input
      const passwordHash = await hashPassword(password)
      const [existing]: any = await pool.execute('SELECT id FROM users WHERE username = ? OR email = ?', [username, email])
      if (existing.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Username or email already exists' })
      const [, result]: any = await pool.execute('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)', [username, email, passwordHash, role])
      const userId = result?.insertId ?? result?.[0]?.id ?? 0
      await logAuditEvent(ctx.session.userId, ctx.session.username, 'USER_CREATED', 'user', userId.toString(), `Created ${role}: ${username}`)
      return { success: true, message: `User "${username}" created`, data: { userId, username, email, role } }
    }),
})
