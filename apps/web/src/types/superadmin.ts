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
