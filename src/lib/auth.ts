import argon2 from '@node-rs/argon2'
import { auth } from './better-auth'

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

const roleHierarchy: Record<UserRole, number> = {
  user: 1,
  admin: 2,
  superadmin: 3,
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

export function isSuperAdmin(userRole: UserRole): boolean {
  return userRole === 'superadmin'
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

export async function requireAuth(request: Request): Promise<SessionPayload> {
  const session = await getSession(request)
  if (!session) throw new Error('Unauthorized: Authentication required')
  return session
}

export async function requireRole(request: Request, requiredRole: UserRole): Promise<SessionPayload> {
  const session = await requireAuth(request)
  if (!hasRole(session.role, requiredRole)) {
    throw new Error(`Forbidden: ${requiredRole} role required`)
  }
  return session
}

export async function requireSuperAdmin(request: Request): Promise<SessionPayload> {
  return requireRole(request, 'superadmin')
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password)
}
