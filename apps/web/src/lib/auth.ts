import { auth } from './better-auth'
import { hashPassword, verifyPassword } from './password'

export { hashPassword, verifyPassword }

export type UserRole = 'superadmin' | 'admin' | 'user'

export interface SessionPayload {
  userId: number
  username: string
  role: UserRole
}

export interface User {
  id: number
  username: string
  email: string
  role: UserRole
  created_at: Date
}

export async function getSession(request: Request): Promise<SessionPayload | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session?.user) return null

  return {
    userId: Number(session.user.id),
    username: (session.user as any).username ?? session.user.name ?? session.user.email,
    role: ((session.user as any).role as UserRole) ?? 'user',
  }
}
