import pool from '@/lib/db'
import type { UserRole } from './auth'

export interface AuditLog {
  id?: number
  user_id: number | null
  username: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: string | null
  ip_address: string | null
  user_agent: string | null
  created_at?: Date
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(
  userId: number | null,
  username: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null = null,
  details: string | null = null,
  ipAddress: string | null = null,
  userAgent: string | null = null
): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO audit_logs 
       (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, action, resourceType, resourceId, details, ipAddress, userAgent]
    )
  } catch (error) {
    // Don't throw - audit logging failures shouldn't break the application
    console.error('Failed to log audit event:', error)
  }
}

/**
 * Get client IP address from request
 */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIp) {
    return realIp.trim()
  }
  
  return null
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent')
}
