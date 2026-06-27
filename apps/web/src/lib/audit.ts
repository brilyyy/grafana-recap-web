import { db } from '@/db'
import { auditLogs } from '@/db/schema'

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

export async function logAuditEvent(
  userId: number | null,
  username: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null = null,
  details: string | null = null,
  ipAddress: string | null = null,
  userAgent: string | null = null,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId,
      username,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent,
    })
  } catch (error) {
    console.error('Failed to log audit event:', error)
  }
}

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp.trim()
  return null
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent')
}
