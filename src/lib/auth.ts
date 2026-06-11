/**
 * Auth helpers – BetterAuth edition (TanStack Start)
 *
 * Uses BetterAuth for session management.
 * hashPassword / verifyPassword kept for pending-user-request flow.
 */

import { auth } from './better-auth'

// ─── Public types ────────────────────────────────────────────────────────────

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

// ─── Role hierarchy ──────────────────────────────────────────────────────────

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

// ─── Session helpers (server-side) ───────────────────────────────────────────

/**
 * Get BetterAuth session from an incoming Request (reads cookie header).
 * Returns SessionPayload or null.
 */
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

// ─── Route guards (async) ────────────────────────────────────────────────────

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

// ─── Password utilities (kept for pending-user-request flow) ─────────────────

import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
