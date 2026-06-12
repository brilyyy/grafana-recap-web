import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { useAuthSession } from '@/hooks/use-auth-session'

export interface User {
  id: number
  username: string
  email: string
  role: 'superadmin' | 'admin' | 'user'
  created_at: string
  updated_at: string
}

export interface PendingUserRequest {
  id: number
  username: string
  email: string
  requested_role: string
  status: string
  created_at: string
  updated_at: string
  requested_by_username: string | null
}

export interface AuditLogEntry {
  id: number
  user_id: number | null
  username: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditStats {
  total: number
  actionCounts: Array<{ action: string; count: number }>
  resourceTypeCounts: Array<{ resource_type: string; count: number }>
  dailyActivity: Array<{ date: string; count: number }>
  topUsers: Array<{ username: string; count: number }>
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case 'superadmin':
      return <Badge>superadmin</Badge>
    case 'admin':
      return <Badge variant="secondary">admin</Badge>
    default:
      return <Badge variant="outline">{role}</Badge>
  }
}

/**
 * Redirects non-superadmin users to the home page. The dashboard layout
 * already guarantees authentication; this only adds the role check.
 */
export function useSuperadminGuard() {
  const navigate = useNavigate()
  const { isLoading, user } = useAuthSession()

  useEffect(() => {
    if (!isLoading && user && user.role !== 'superadmin') {
      navigate({ to: '/', replace: true })
    }
  }, [isLoading, user, navigate])

  return { isLoading, isSuperadmin: user?.role === 'superadmin' }
}
