import jwt, { type SignOptions, type Secret } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

export type UserRole = 'superadmin' | 'admin' | 'user'

export interface User {
  id: number
  username: string
  email: string
  role: UserRole
  created_at: Date
}

export interface SessionPayload {
  userId: number
  username: string
  role: UserRole
}

const JWT_SECRET: Secret = (process.env.JWT_SECRET || 'change-this-secret-key-in-production') as Secret
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || '7d'
const SESSION_COOKIE_NAME = 'auth_session'

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a JWT token for a user session
 */
export function generateToken(payload: SessionPayload): string {
  const options: SignOptions = {
    // Cast to any to satisfy jsonwebtoken's stricter typing while still allowing string like '7d'
    expiresIn: JWT_EXPIRES_IN as any,
  }

  return jwt.sign(payload, JWT_SECRET, options)
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as Secret) as SessionPayload
    return decoded
  } catch (error) {
    return null
  }
}

/**
 * Get session from request cookies
 */
export function getSession(request: NextRequest): SessionPayload | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return verifyToken(token)
}

/**
 * Set session cookie (returns cookie string to set in response)
 */
export function setSessionCookie(payload: SessionPayload): string {
  const token = generateToken(payload)
  
  const cookieOptions = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'HttpOnly',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 7}`, // 7 days
    'Path=/',
  ].filter(Boolean).join('; ')

  return cookieOptions
}

/**
 * Clear session cookie (returns cookie string to clear in response)
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    user: 1,
    admin: 2,
    superadmin: 3,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

/**
 * Check if user is superadmin
 */
export function isSuperAdmin(userRole: UserRole): boolean {
  return userRole === 'superadmin'
}

/**
 * Require superadmin role - throws if user is not superadmin
 */
export function requireSuperAdmin(request: NextRequest): SessionPayload {
  const session = requireAuth(request)

  if (session.role !== 'superadmin') {
    throw new Error('Forbidden: superadmin role required')
  }

  return session
}

/**
 * Require authentication - throws if not authenticated
 */
export function requireAuth(request: NextRequest): SessionPayload {
  const session = getSession(request)

  if (!session) {
    throw new Error('Unauthorized: Authentication required')
  }

  return session
}

/**
 * Require specific role - throws if user doesn't have required role
 */
export function requireRole(
  request: NextRequest,
  requiredRole: UserRole
): SessionPayload {
  const session = requireAuth(request)

  if (!hasRole(session.role, requiredRole)) {
    throw new Error(`Forbidden: ${requiredRole} role required`)
  }

  return session
}
