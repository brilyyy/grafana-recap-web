import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure, superAdminProcedure } from '../init'
import { auth } from '@/lib/better-auth'
import { pool } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import type { ApiResponse } from '@/types'

export const authRouter = router({
  /** Check current session */
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

  /** Check if any admin exists */
  checkAdmin: publicProcedure.query(async () => {
    const [admins]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin' OR role = 'superadmin'"
    )
    return {
      success: true,
      data: { adminExists: admins[0].count > 0 },
    } as ApiResponse
  }),

  /** Get pending user requests (superadmin only) */
  pendingRequests: superAdminProcedure.query(async () => {
    const [requests]: any = await pool.execute(
      `SELECT pur.id, pur.username, pur.email, pur.requested_role, pur.status,
              pur.created_at, pur.updated_at, u.username as requested_by_username
       FROM pending_user_requests pur
       LEFT JOIN users u ON pur.requested_by = u.id
       WHERE pur.status = 'pending'
       ORDER BY pur.created_at DESC`
    )
    return { success: true, data: { requests } } as ApiResponse
  }),

  /** Create first admin OR submit pending request */
  createAdmin: publicProcedure
    .input(z.object({ username: z.string().min(1), email: z.string().email(), password: z.string().min(8) }))
    .mutation(async ({ input }) => {
      const { username, email, password } = input

      const [admins]: any = await pool.execute(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin' OR role = 'superadmin'"
      )
      const passwordHash = await hashPassword(password)

      if (admins[0].count > 0) {
        // Check duplicates
        const [existing]: any = await pool.execute(
          'SELECT id FROM users WHERE username = ? OR email = ?',
          [username, email]
        )
        if (existing.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Username or email already exists' })

        const [existingReqs]: any = await pool.execute(
          'SELECT id FROM pending_user_requests WHERE username = ? OR email = ?',
          [username, email]
        )
        if (existingReqs.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Request already pending' })

        await pool.execute(
          "INSERT INTO pending_user_requests (username, email, password_hash, requested_role, requested_by, status) VALUES (?, ?, ?, ?, NULL, 'pending')",
          [username, email, passwordHash, 'admin']
        )
        return {
          success: true,
          message: 'Admin registration request submitted. Awaiting superadmin approval.',
          data: { username, email, requestedRole: 'admin', status: 'pending' },
        } as ApiResponse
      }

      // First-time setup
      await pool.execute(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [username, email, passwordHash, 'admin']
      )
      return { success: true, message: 'Admin user created successfully (first-time setup)' } as ApiResponse
    }),

  /** Submit a user registration request */
  submitUserRequest: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        requestedRole: z.enum(['admin', 'user']).default('user'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { username, email, password, requestedRole } = input
      const passwordHash = await hashPassword(password)
      const requestedById = ctx.session?.userId ?? null

      const [existing]: any = await pool.execute(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
      )
      if (existing.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Username or email already exists' })

      const [existingReqs]: any = await pool.execute(
        'SELECT id FROM pending_user_requests WHERE username = ? OR email = ?',
        [username, email]
      )
      if (existingReqs.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Request already pending' })

      await pool.execute(
        "INSERT INTO pending_user_requests (username, email, password_hash, requested_role, requested_by, status) VALUES (?, ?, ?, ?, ?, 'pending')",
        [username, email, passwordHash, requestedRole, requestedById]
      )
      return { success: true, message: 'Registration request submitted. Awaiting approval.' } as ApiResponse
    }),

  /** Approve a pending user request (superadmin only) */
  approveRequest: superAdminProcedure
    .input(z.object({ id: z.number().int(), approvedRole: z.enum(['superadmin', 'admin', 'user']) }))
    .mutation(async ({ input, ctx }) => {
      const { id, approvedRole } = input

      const [requests]: any = await pool.execute(
        "SELECT * FROM pending_user_requests WHERE id = ? AND status = 'pending'",
        [id]
      )
      if (requests.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending request not found' })

      const pending = requests[0]

      // Create user via BetterAuth Admin plugin
      await auth.api.createUser({
        body: {
          name: pending.username,
          email: pending.email,
          password: undefined as any, // Use existing password_hash via direct insert below
          role: approvedRole,
        },
      }).catch(() => null) // Fallback to direct insert if admin API not set up yet

      // Direct insert to preserve password_hash from the pending request
      const connection = await pool.getConnection()
      await connection.beginTransaction()
      try {
        await connection.execute(
          'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [pending.username, pending.email, pending.password_hash, approvedRole]
        )
        await connection.execute(
          "UPDATE pending_user_requests SET status = 'approved', approved_role = ?, approved_by = ?, updated_at = NOW() WHERE id = ?",
          [approvedRole, ctx.session.userId, id]
        )
        await connection.commit()
      } catch (e) {
        await connection.rollback()
        throw e
      } finally {
        connection.release()
      }

      await logAuditEvent(ctx.session.userId, ctx.session.username, 'USER_REQUEST_APPROVED', 'pending_user_request', id.toString(), `Approved: ${pending.username} as ${approvedRole}`)
      return { success: true, message: `User "${pending.username}" created with role "${approvedRole}"` } as ApiResponse
    }),

  /** Reject a pending user request (superadmin only) */
  rejectRequest: superAdminProcedure
    .input(z.object({ id: z.number().int(), rejectionReason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { id, rejectionReason } = input

      const [requests]: any = await pool.execute(
        "SELECT * FROM pending_user_requests WHERE id = ? AND status = 'pending'",
        [id]
      )
      if (requests.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending request not found' })

      const pending = requests[0]
      await pool.execute(
        "UPDATE pending_user_requests SET status = 'rejected', rejected_by = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?",
        [ctx.session.userId, rejectionReason ?? null, id]
      )

      await logAuditEvent(ctx.session.userId, ctx.session.username, 'USER_REQUEST_REJECTED', 'pending_user_request', id.toString(), `Rejected: ${pending.username}`)
      return { success: true, message: 'User request rejected' } as ApiResponse
    }),

  /** Get current user session info */
  me: protectedProcedure.query(({ ctx }) => ({
    success: true,
    data: { user: { id: ctx.session.userId, username: ctx.session.username, role: ctx.session.role } },
  })),
})
