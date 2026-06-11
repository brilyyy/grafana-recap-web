import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getClientIp, getUserAgent, logAuditEvent } from '@/lib/audit'
import { auth } from '@/lib/better-auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          enforceRateLimit(request, RATE_LIMITS.AUTH)

          const body = await request.json()
          const { username, password } = body

          if (!username || !password) {
            return Response.json({ success: false, message: 'Username and password are required' }, { status: 400 })
          }

          const result = await db
            .select({ id: users.id, username: users.username, email: users.email, role: users.role })
            .from(users)
            .where(eq(users.username, username))

          if (result.length === 0) {
            await logAuditEvent(
              null,
              username,
              'LOGIN_FAILED',
              'auth',
              null,
              'Invalid username',
              getClientIp(request),
              getUserAgent(request),
            )
            return Response.json({ success: false, message: 'Invalid username or password' }, { status: 401 })
          }

          const user = result[0]

          try {
            await auth.api.signInEmail({
              body: { email: user.email, password },
              headers: request.headers,
            })
          } catch {
            await logAuditEvent(
              user.id,
              username,
              'LOGIN_FAILED',
              'auth',
              null,
              'Invalid password',
              getClientIp(request),
              getUserAgent(request),
            )
            return Response.json({ success: false, message: 'Invalid username or password' }, { status: 401 })
          }

          await logAuditEvent(
            user.id,
            username,
            'LOGIN_SUCCESS',
            'auth',
            null,
            `Role: ${user.role}`,
            getClientIp(request),
            getUserAgent(request),
          )

          return Response.json({
            success: true,
            message: 'Login successful',
            data: { user: { id: user.id, username: user.username, email: user.email, role: user.role } },
          })
        } catch (error: any) {
          if (error.statusCode === 429) {
            return Response.json({ success: false, message: error.message }, { status: 429 })
          }
          console.error('Login error:', error.message)
          return Response.json({ success: false, message: 'Internal server error' }, { status: 500 })
        }
      },
    },
  },
})
