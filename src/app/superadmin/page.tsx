'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'

interface User {
  id: number
  username: string
  email: string
  role: 'superadmin' | 'admin' | 'user'
  created_at: string
  updated_at: string
}

interface PendingUserRequest {
  id: number
  username: string
  email: string
  requested_role: string
  status: string
  created_at: string
  updated_at: string
  requested_by_username: string | null
}

interface AuditLogEntry {
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

interface AuditStats {
  total: number
  actionCounts: Array<{ action: string; count: number }>
  resourceTypeCounts: Array<{ resource_type: string; count: number }>
  dailyActivity: Array<{ date: string; count: number }>
  topUsers: Array<{ username: string; count: number }>
}

type TabType = 'users' | 'audit-logs' | 'app-processing' | 'app-config'

export default function SuperadminPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('users')

  // User Management State
  const [users, setUsers] = useState<User[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingUserRequest[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const [usersFilters, setUsersFilters] = useState({
    search: '',
    role: '',
  })
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showEditRoleModal, setShowEditRoleModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PendingUserRequest | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [approvedRole, setApprovedRole] = useState<string>('user')
  const [newRole, setNewRole] = useState<string>('user')
  const [rejectionReason, setRejectionReason] = useState<string>('')
  const [processing, setProcessing] = useState(false)

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    resource_type: '',
    username: '',
    start_date: '',
    end_date: '',
  })

  // Application Data Processing State
  const [applications, setApplications] = useState<Array<{ id: number; app_name: string }>>([])
  const [applicationsLoading, setApplicationsLoading] = useState(true)
  const [processingLogs, setProcessingLogs] = useState<Array<{
    id: number
    app_name: string
    processing_date: string
    status: 'running' | 'success' | 'failed'
    records_processed: number
    records_inserted: number
    start_time: string
    end_time: string | null
    error_message: string | null
  }>>([])
  const [processingLogsLoading, setProcessingLogsLoading] = useState(false)
  const [processingFilters, setProcessingFilters] = useState({
    app_name: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  })
  const [processingStates, setProcessingStates] = useState<{
    [date: string]: { loading: boolean; error: string | null }
  }>({})
  const [editingAppConfig, setEditingAppConfig] = useState<{ id: number; db_name: string; raw_table_name: string } | null>(null)

  const { data: authCheck, isLoading: authLoading } = trpc.auth.check.useQuery(undefined, { retry: false })
  const { data: appsWithConfig, refetch: refetchAppsConfig } = trpc.applications.list.useQuery(undefined, { enabled: !!(isAuthenticated && userRole === 'superadmin' && activeTab === 'app-config') })
  const updateConfigMutation = trpc.applications.updateConfig.useMutation({ onSuccess: () => refetchAppsConfig() })

  useEffect(() => {
    if (!authLoading && authCheck !== undefined) {
      if (!authCheck?.data?.authenticated) {
        router.replace('/login')
      } else {
        const role = (authCheck.data as any)?.user?.role
        setIsAuthenticated(true)
        setUserRole(role)
        if (role !== 'superadmin') router.replace('/')
      }
    }
  }, [authCheck, authLoading, router])


  useEffect(() => {
    if (isAuthenticated && userRole === 'superadmin') {
      if (activeTab === 'users') {
        fetchUsers()
        fetchPendingRequests()
      } else if (activeTab === 'audit-logs') {
        fetchAuditLogs()
        fetchStats()
      } else if (activeTab === 'app-processing') {
        fetchApplications()
      } else if (activeTab === 'app-config') {
        fetchApplications()
      }
    }
  }, [isAuthenticated, userRole, activeTab, usersPage, usersFilters, auditPage, auditFilters])

  // User Management Functions
  const fetchUsers = async () => {
    try {
      setUsersLoading(true)
      const params = new URLSearchParams({
        page: usersPage.toString(),
        limit: '25',
        ...Object.fromEntries(Object.entries(usersFilters).filter(([_, v]) => v !== '')),
      })

      const response = await fetch(`/api/users?${params}`)
      const data = await response.json()

      if (data.success) {
        setUsers(data.data)
        setUsersTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch('/api/auth/pending-user-requests')
      const data = await response.json()

      if (data.success) {
        setPendingRequests(data.data.requests)
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error)
    }
  }

  const handleApprove = async () => {
    if (!selectedRequest) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/auth/approve-user-request/${selectedRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedRole }),
      })

      const data = await response.json()

      if (data.success) {
        setShowApproveModal(false)
        setSelectedRequest(null)
        setApprovedRole('user')
        fetchUsers()
        fetchPendingRequests()
      } else {
        alert(data.message || 'Failed to approve user request')
      }
    } catch (error) {
      console.error('Error approving request:', error)
      alert('Error approving user request')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/auth/reject-user-request/${selectedRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      })

      const data = await response.json()

      if (data.success) {
        setShowRejectModal(false)
        setSelectedRequest(null)
        setRejectionReason('')
        fetchPendingRequests()
      } else {
        alert(data.message || 'Failed to reject user request')
      }
    } catch (error) {
      console.error('Error rejecting request:', error)
      alert('Error rejecting user request')
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdateRole = async () => {
    if (!selectedUser) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await response.json()

      if (data.success) {
        setShowEditRoleModal(false)
        setSelectedUser(null)
        setNewRole('user')
        fetchUsers()
      } else {
        alert(data.message || 'Failed to update user role')
      }
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Error updating user role')
    } finally {
      setProcessing(false)
    }
  }

  // Audit Logs Functions
  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true)
      const params = new URLSearchParams({
        page: auditPage.toString(),
        limit: '50',
        ...Object.fromEntries(Object.entries(auditFilters).filter(([_, v]) => v !== '')),
      })

      const response = await fetch(`/api/audit-logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setAuditLogs(data.data)
        setAuditTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setAuditLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/audit-logs/stats?days=30')
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Application Data Processing Functions
  const fetchApplications = async () => {
    try {
      setApplicationsLoading(true)
      const response = await fetch('/api/applications')
      const data = await response.json()

      if (data.success) {
        setApplications(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setApplicationsLoading(false)
    }
  }

  const fetchProcessingLogs = async () => {
    if (!processingFilters.app_name || !processingFilters.month || !processingFilters.year) {
      return
    }

    try {
      setProcessingLogsLoading(true)
      const params = new URLSearchParams({
        app_name: processingFilters.app_name,
        month: processingFilters.month.toString(),
        year: processingFilters.year.toString(),
      })

      const response = await fetch(`/api/processing-logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setProcessingLogs(data.data || [])
      } else {
        alert(data.message || 'Failed to fetch processing logs')
        setProcessingLogs([])
      }
    } catch (error) {
      console.error('Error fetching processing logs:', error)
      alert('Error fetching processing logs')
      setProcessingLogs([])
    } finally {
      setProcessingLogsLoading(false)
    }
  }

  const formatProcessingDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatProcessingTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleDateProcessing = async (appName: string, date: string) => {
    // Validate date: cannot process future dates or current date
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const processingDate = new Date(date + 'T00:00:00')
    processingDate.setHours(0, 0, 0, 0)

    if (processingDate >= today) {
      alert('Cannot process future dates. Only H-1 (yesterday) and earlier dates can be processed.')
      return
    }

    // Initialize processing state for this date
    setProcessingStates((prev) => ({
      ...prev,
      [date]: { loading: true, error: null },
    }))

    try {
      const response = await fetch('/api/processing/process-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_name: appName,
          date: date,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setProcessingStates((prev) => ({
          ...prev,
          [date]: { loading: false, error: null },
        }))
        // Show success message
        if (data.data?.logEntry) {
          const logEntry = data.data.logEntry
          const statusMsg = logEntry.status === 'success' 
            ? `Successfully processed ${logEntry.recordsProcessed || 0} records (${logEntry.recordsInserted || 0} inserted)`
            : logEntry.status === 'failed'
            ? `Processing failed: ${logEntry.errorMessage || 'Unknown error'}`
            : 'Processing is running...'
          alert(`Processing triggered for ${date}.\n${statusMsg}`)
        } else {
          alert(`Processing triggered successfully for ${date}`)
        }
        // Refresh processing logs after successful processing
        // Add small delay to ensure stored procedure has finished writing to database
        await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms for DB write to complete
        await fetchProcessingLogs()
      } else {
        setProcessingStates((prev) => ({
          ...prev,
          [date]: { loading: false, error: data.message || 'Processing failed' },
        }))
        alert(data.message || 'Failed to process data')
      }
    } catch (error: any) {
      setProcessingStates((prev) => ({
        ...prev,
        [date]: { loading: false, error: error.message || 'Error triggering processing' },
      }))
      alert('Error triggering processing: ' + error.message)
    }
  }

  // Generate all dates in the selected month
  const getAllDatesInMonth = (month: number, year: number): string[] => {
    const dates: string[] = []
    const lastDay = new Date(year, month, 0).getDate()
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      dates.push(dateStr)
    }
    return dates
  }

  // Create a map of logs by date for easy lookup
  const logsByDate = processingLogs.reduce((acc, log) => {
    acc[log.processing_date] = log
    return acc
  }, {} as Record<string, typeof processingLogs[0]>)

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || userRole !== 'superadmin') {
    return null
  }

  return (
    <main className="min-h-screen p-4 md:p-6 superadmin-page" data-page="superadmin">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-red-200">
              Superadmin Dashboard
            </h1>
            <p className="text-white/70 text-sm">Manage users and monitor system activities</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/')}
              className="bg-gray-700/80 hover:bg-gray-600/80 text-white border-white/10"
            >
              Back to Dashboard
            </Button>
            <LogoutButton />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/20">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'users'
                ? 'text-white border-b-2 border-blue-400'
                : 'text-white/70 hover:text-white'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('audit-logs')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'audit-logs'
                ? 'text-white border-b-2 border-blue-400'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('app-processing')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'app-processing'
                ? 'text-white border-b-2 border-blue-400'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Application Data Processing
          </button>
          <button
            onClick={() => setActiveTab('app-config')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'app-config'
                ? 'text-white border-b-2 border-blue-400'
                : 'text-white/70 hover:text-white'
            }`}
          >
            App Config
          </button>
        </div>

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Pending Requests Section */}
            {pendingRequests.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
                <div className="p-4 border-b border-white/20">
                  <h3 className="text-lg font-semibold text-white">
                    Pending User Requests ({pendingRequests.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Username</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Requested Role</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Requested By</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {pendingRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-white/5">
                          <td className="px-4 py-3 text-sm text-white/90">{request.username}</td>
                          <td className="px-4 py-3 text-sm text-white/90">{request.email}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-medium">
                              {request.requested_role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-white/70">
                            {request.requested_by_username || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/70">
                            {formatDate(request.created_at)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedRequest(request)
                                  setApprovedRole(request.requested_role === 'admin' ? 'admin' : 'user')
                                  setShowApproveModal(true)
                                }}
                                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(request)
                                  setRejectionReason('')
                                  setShowRejectModal(true)
                                }}
                                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Users List Section */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
              <div className="p-4 border-b border-white/20 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">All Users</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={usersFilters.search}
                    onChange={(e) => {
                      setUsersFilters((prev) => ({ ...prev, search: e.target.value }))
                      setUsersPage(1)
                    }}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <select
                    value={usersFilters.role}
                    onChange={(e) => {
                      setUsersFilters((prev) => ({ ...prev, role: e.target.value }))
                      setUsersPage(1)
                    }}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">All Roles</option>
                    <option value="superadmin">Superadmin</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </select>
                </div>
              </div>
              {usersLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-white/70">Loading...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-white/70">No users found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Username</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Created</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {users.map((user) => (
                          <tr key={user.id} className="hover:bg-white/5">
                            <td className="px-4 py-3 text-sm text-white/90">{user.username}</td>
                            <td className="px-4 py-3 text-sm text-white/90">{user.email}</td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  user.role === 'superadmin'
                                    ? 'bg-red-500/20 text-red-300'
                                    : user.role === 'admin'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-gray-500/20 text-gray-300'
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-white/70">
                              {formatDate(user.created_at)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <button
                                onClick={() => {
                                  setSelectedUser(user)
                                  setNewRole(user.role)
                                  setShowEditRoleModal(true)
                                }}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors"
                              >
                                Edit Role
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {usersTotalPages > 1 && (
                    <div className="p-4 border-t border-white/20 flex justify-between items-center">
                      <button
                        onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                        disabled={usersPage === 1}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-white/70 text-sm">
                        Page {usersPage} of {usersTotalPages}
                      </span>
                      <button
                        onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                        disabled={usersPage === usersTotalPages}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit-logs' && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <p className="text-white/70 text-sm mb-1">Total Activities</p>
                  <p className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</p>
                  <p className="text-xs text-white/50 mt-1">Last 30 days</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <p className="text-white/70 text-sm mb-1">Top Action</p>
                  <p className="text-xl font-bold text-white break-words overflow-hidden">
                    {stats.actionCounts[0]?.action || 'N/A'}
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    {stats.actionCounts[0]?.count || 0} times
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <p className="text-white/70 text-sm mb-1">Top Resource</p>
                  <p className="text-xl font-bold text-white break-words overflow-hidden">
                    {stats.resourceTypeCounts[0]?.resource_type || 'N/A'}
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    {stats.resourceTypeCounts[0]?.count || 0} times
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <p className="text-white/70 text-sm mb-1">Most Active User</p>
                  <p className="text-xl font-bold text-white">
                    {stats.topUsers[0]?.username || 'N/A'}
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    {stats.topUsers[0]?.count || 0} activities
                  </p>
                </div>
              </div>
            )}

            {/* Charts Section */}
            {stats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                  <h3 className="text-lg font-semibold text-white mb-4">Top Actions</h3>
                  <div className="space-y-3">
                    {stats.actionCounts.slice(0, 5).map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-sm mb-1 gap-2">
                          <span className="text-white/90 break-words overflow-hidden flex-1 min-w-0">{item.action}</span>
                          <span className="text-white/70 flex-shrink-0">{item.count}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full"
                            style={{
                              width: `${(item.count / (stats.actionCounts[0]?.count || 1)) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                  <h3 className="text-lg font-semibold text-white mb-4">Daily Activity (Last 7 Days)</h3>
                  <div className="flex items-end justify-between h-48 gap-2">
                    {stats.dailyActivity.slice(0, 7).reverse().map((item, idx) => {
                      const maxCount = Math.max(...stats.dailyActivity.map((d) => d.count), 1)
                      const height = (item.count / maxCount) * 100
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center">
                          <div className="w-full flex flex-col items-center justify-end h-full">
                            <div
                              className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                              style={{ height: `${height}%`, minHeight: '4px' }}
                            ></div>
                          </div>
                          <p className="text-xs text-white/70 mt-2 text-center">
                            {new Date(item.date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                          <p className="text-xs text-white/50">{item.count}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Action</label>
                  <input
                    type="text"
                    value={auditFilters.action}
                    onChange={(e) => {
                      setAuditFilters((prev) => ({ ...prev, action: e.target.value }))
                      setAuditPage(1)
                    }}
                    placeholder="Filter by action"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Resource Type</label>
                  <input
                    type="text"
                    value={auditFilters.resource_type}
                    onChange={(e) => {
                      setAuditFilters((prev) => ({ ...prev, resource_type: e.target.value }))
                      setAuditPage(1)
                    }}
                    placeholder="Filter by resource"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Username</label>
                  <input
                    type="text"
                    value={auditFilters.username}
                    onChange={(e) => {
                      setAuditFilters((prev) => ({ ...prev, username: e.target.value }))
                      setAuditPage(1)
                    }}
                    placeholder="Filter by username"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={auditFilters.start_date}
                    onChange={(e) => {
                      setAuditFilters((prev) => ({ ...prev, start_date: e.target.value }))
                      setAuditPage(1)
                    }}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">End Date</label>
                  <input
                    type="date"
                    value={auditFilters.end_date}
                    onChange={(e) => {
                      setAuditFilters((prev) => ({ ...prev, end_date: e.target.value }))
                      setAuditPage(1)
                    }}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
              <div className="p-4 border-b border-white/20">
                <h3 className="text-lg font-semibold text-white">Audit Logs</h3>
              </div>
              {auditLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-white/70">Loading...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-white/70">No audit logs found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">User</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Action</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Resource</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Details</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">IP Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-white/5">
                            <td className="px-4 py-3 text-sm text-white/90">
                              {formatDate(log.created_at)}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/90">
                              {log.username || 'System'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-white/90">
                              {log.resource_type}
                              {log.resource_id && ` #${log.resource_id}`}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/70 max-w-md truncate">
                              {log.details || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/70">
                              {log.ip_address || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {auditTotalPages > 1 && (
                    <div className="p-4 border-t border-white/20 flex justify-between items-center">
                      <button
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        disabled={auditPage === 1}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-white/70 text-sm">
                        Page {auditPage} of {auditTotalPages}
                      </span>
                      <button
                        onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                        disabled={auditPage === auditTotalPages}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Application Data Processing Tab */}
        {activeTab === 'app-processing' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Application Data Processing</h3>
              <p className="text-white/70 text-sm mb-4">
                View application data processing logs by selecting an application, month, and year.
              </p>
            </div>

            {/* Filters */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">App Name</label>
                  {applicationsLoading ? (
                    <div className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white/50 text-sm">
                      Loading...
                    </div>
                  ) : (
                    <select
                      value={processingFilters.app_name}
                      onChange={(e) => {
                        setProcessingFilters((prev) => ({ ...prev, app_name: e.target.value }))
                      }}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                        Select Application
                      </option>
                      {applications.map((app) => (
                        <option 
                          key={app.id} 
                          value={app.app_name} 
                          style={{ backgroundColor: '#1f2937', color: '#ffffff' }}
                        >
                          {app.app_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Month</label>
                  <select
                    value={processingFilters.month}
                    onChange={(e) => {
                      setProcessingFilters((prev) => ({ ...prev, month: parseInt(e.target.value) }))
                    }}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="1" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>January</option>
                    <option value="2" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>February</option>
                    <option value="3" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>March</option>
                    <option value="4" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>April</option>
                    <option value="5" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>May</option>
                    <option value="6" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>June</option>
                    <option value="7" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>July</option>
                    <option value="8" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>August</option>
                    <option value="9" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>September</option>
                    <option value="10" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>October</option>
                    <option value="11" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>November</option>
                    <option value="12" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>December</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Year</label>
                  <select
                    value={processingFilters.year}
                    onChange={(e) => {
                      setProcessingFilters((prev) => ({ ...prev, year: parseInt(e.target.value) }))
                    }}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ colorScheme: 'dark' }}
                  >
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - i
                      return (
                        <option 
                          key={year} 
                          value={year} 
                          style={{ backgroundColor: '#1f2937', color: '#ffffff' }}
                        >
                          {year}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={fetchProcessingLogs}
                  disabled={!processingFilters.app_name || processingLogsLoading}
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {processingLogsLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </span>
                  ) : (
                    'Search'
                  )}
                </button>
              </div>
            </div>

            {/* Processing Results */}
            {processingLogsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-white/70">Loading processing logs...</p>
              </div>
            ) : processingFilters.app_name ? (
              (() => {
                const allDates = getAllDatesInMonth(processingFilters.month, processingFilters.year)
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                // Calculate statistics
                const stats = {
                  total: allDates.length,
                  success: allDates.filter(d => logsByDate[d]?.status === 'success').length,
                  failed: allDates.filter(d => logsByDate[d]?.status === 'failed').length,
                  processing: allDates.filter(d => logsByDate[d]?.status === 'running').length,
                  notProcessed: allDates.filter(d => !logsByDate[d]).length,
                }

                return (
                  <div className="space-y-4">
                    {/* Summary Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-sm rounded-lg p-3 border border-green-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-medium text-green-300">Success</span>
                        </div>
                        <p className="text-xl font-bold text-white">{stats.success}</p>
                      </div>
                      <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 backdrop-blur-sm rounded-lg p-3 border border-red-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-medium text-red-300">Failed</span>
                        </div>
                        <p className="text-xl font-bold text-white">{stats.failed}</p>
                      </div>
                      <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 backdrop-blur-sm rounded-lg p-3 border border-yellow-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-medium text-yellow-300">Processing</span>
                        </div>
                        <p className="text-xl font-bold text-white">{stats.processing}</p>
                      </div>
                      <div className="bg-gradient-to-br from-gray-500/20 to-gray-600/10 backdrop-blur-sm rounded-lg p-3 border border-gray-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          <span className="text-xs font-medium text-gray-300">Not Processed</span>
                        </div>
                        <p className="text-xl font-bold text-white">{stats.notProcessed}</p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-sm rounded-lg p-3 border border-blue-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <span className="text-xs font-medium text-blue-300">Total</span>
                        </div>
                        <p className="text-xl font-bold text-white">{stats.total}</p>
                      </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">
                          {new Date(processingFilters.year, processingFilters.month - 1, 1).toLocaleDateString('id-ID', { 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-white/70">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-green-500/50"></div>
                            <span>Success</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-red-500/50"></div>
                            <span>Failed</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-gray-500/50"></div>
                            <span>Not Processed</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-2 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="text-center text-xs font-semibold text-white/50 py-1">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {(() => {
                          const firstDay = new Date(processingFilters.year, processingFilters.month - 1, 1).getDay()
                          const emptyDays = Array(firstDay).fill(null)
                          return [...emptyDays, ...allDates].map((dateStr, idx) => {
                            if (!dateStr) {
                              return <div key={`empty-${idx}`} className="aspect-square"></div>
                            }

                            const log = logsByDate[dateStr]
                            const date = new Date(dateStr + 'T00:00:00')
                            date.setHours(0, 0, 0, 0)
                            const canProcess = date < today
                            const processingState = processingStates[dateStr] || { loading: false, error: null }
                            const status = log?.status || null
                            const isToday = dateStr === today.toISOString().split('T')[0]
                            
                            // Check if it's a simple success (only tick, no other important info)
                            const isSimpleSuccess = status === 'success' && (!log || (!log.error_message && log.records_processed === null))

                            // Determine card styling based on status
                            let cardClasses = "aspect-square bg-white/10 backdrop-blur-sm rounded-lg border flex flex-col transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer"
                            let borderColor = "border-white/20"
                            let bgGradient = ""
                            let paddingClass = "p-2"

                            if (status === 'success') {
                              borderColor = "border-green-500/50"
                              bgGradient = "bg-gradient-to-br from-green-500/20 to-green-600/10"
                              // Make it more compact if it's simple success
                              if (isSimpleSuccess) {
                                paddingClass = "p-1.5"
                              }
                            } else if (status === 'failed') {
                              borderColor = "border-red-500/50"
                              bgGradient = "bg-gradient-to-br from-red-500/20 to-red-600/10"
                            } else if (status === 'running') {
                              borderColor = "border-yellow-500/50"
                              bgGradient = "bg-gradient-to-br from-yellow-500/20 to-yellow-600/10"
                            } else {
                              borderColor = "border-gray-500/30"
                              bgGradient = "bg-gradient-to-br from-gray-500/10 to-gray-600/5"
                            }

                            if (isToday) {
                              borderColor = "border-blue-400/70 border-2"
                            }

                            return (
                              <div
                                key={dateStr}
                                className={`${cardClasses} ${bgGradient} ${borderColor} ${paddingClass} ${!canProcess ? 'opacity-50' : ''}`}
                                title={isToday ? 'Today' : ''}
                              >
                                {/* Date Number */}
                                <div className={`flex items-center justify-between ${isSimpleSuccess ? 'mb-0.5' : 'mb-1'}`}>
                                  <span className={`${isSimpleSuccess ? 'text-xs' : 'text-sm'} font-bold ${isToday ? 'text-blue-300' : 'text-white'}`}>
                                    {new Date(dateStr).getDate()}
                                  </span>
                                  {isToday && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                                  )}
                                </div>

                                {/* Status Icon - Smaller for simple success */}
                                {!isSimpleSuccess && (
                                  <div className="flex-1 flex items-center justify-center mb-1">
                                    {status === 'success' && (
                                      <svg className="w-5 h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                    {status === 'failed' && (
                                      <svg className="w-5 h-5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    )}
                                    {status === 'running' && (
                                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-yellow-300 border-t-transparent"></div>
                                    )}
                                    {!status && (
                                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      </svg>
                                    )}
                                  </div>
                                )}

                                {/* Simple Success - Just show small icon */}
                                {isSimpleSuccess && (
                                  <div className="flex-1 flex items-center justify-center mb-0.5">
                                    <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}

                                {/* Quick Stats - Only show if not simple success */}
                                {log && !isSimpleSuccess && (
                                  <div className="text-[10px] text-white/70 space-y-0.5">
                                    {log.records_processed !== null && (
                                      <div className="flex items-center gap-1">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="truncate">{log.records_processed || 0}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Process Button - Larger for simple success */}
                                {canProcess && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDateProcessing(processingFilters.app_name, dateStr)
                                    }}
                                    disabled={processingState.loading}
                                    className={`w-full bg-gradient-to-r from-blue-600/80 to-blue-500/80 hover:from-blue-500 hover:to-blue-400 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-1 ${
                                      isSimpleSuccess 
                                        ? 'px-2 py-2 text-xs' 
                                        : 'mt-1 px-1.5 py-1 text-[10px]'
                                    }`}
                                  >
                                    {processingState.loading ? (
                                      <>
                                        <div className={`animate-spin rounded-full border-2 border-white border-t-transparent ${isSimpleSuccess ? 'h-3 w-3' : 'h-2.5 w-2.5'}`}></div>
                                        <span>Processing</span>
                                      </>
                                    ) : (
                                      <>
                                        <svg className={isSimpleSuccess ? 'w-3 h-3' : 'w-2.5 h-2.5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Process</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>

                    {/* Detailed View Toggle */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <details className="group">
                        <summary className="cursor-pointer flex items-center justify-between text-white font-medium hover:text-blue-300 transition-colors">
                          <span>View Detailed Information</span>
                          <svg className="w-5 h-5 transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {allDates.map((dateStr) => {
                            const log = logsByDate[dateStr]
                            if (!log) return null

                            return (
                              <div
                                key={dateStr}
                                className={`bg-white/10 backdrop-blur-sm rounded-lg p-3 border ${
                                  log.status === 'success'
                                    ? 'border-green-500/30'
                                    : log.status === 'failed'
                                    ? 'border-red-500/30'
                                    : 'border-yellow-500/30'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-sm font-semibold text-white">
                                    {new Date(dateStr).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </h4>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      log.status === 'success'
                                        ? 'bg-green-500/20 text-green-300'
                                        : log.status === 'failed'
                                        ? 'bg-red-500/20 text-red-300'
                                        : 'bg-yellow-500/20 text-yellow-300'
                                    }`}
                                  >
                                    {log.status}
                                  </span>
                                </div>
                                <div className="text-xs text-white/70 space-y-1.5">
                                  <div className="flex justify-between">
                                    <span className="font-medium">Records Processed:</span>
                                    <span className="text-white">{log.records_processed || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-medium">Records Inserted:</span>
                                    <span className="text-white">{log.records_inserted || 0}</span>
                                  </div>
                                  {log.start_time && (
                                    <div>
                                      <span className="font-medium">Start:</span>{' '}
                                      <span className="text-white/90">
                                        {new Date(log.start_time).toLocaleString('id-ID', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                  )}
                                  {log.end_time && (
                                    <div>
                                      <span className="font-medium">End:</span>{' '}
                                      <span className="text-white/90">
                                        {new Date(log.end_time).toLocaleString('id-ID', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                  )}
                                  {log.error_message && (
                                    <div className="mt-2 p-2 bg-red-500/10 rounded border border-red-500/20">
                                      <p className="text-red-300 text-xs break-words">{log.error_message}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </details>
                    </div>
                  </div>
                )
              })()
            ) : null}
          </div>
        )}

        {/* App Config Tab */}
        {activeTab === 'app-config' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Application Config (Cross-DB)</h3>
              <p className="text-white/70 text-sm mb-4">
                Configure db_name and raw_table_name for each app. CDC creates raw tables in db_{'{app_name}'}. Update these when adding new apps or changing CDC targets.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">App Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">db_name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">raw_table_name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {appsWithConfig?.data?.applications?.map((app: { id: number; app_name: string; db_name?: string | null; raw_table_name?: string | null }) => (
                      <tr key={app.id} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-sm text-white/90">{app.app_name}</td>
                        <td className="px-4 py-3 text-sm">
                          {editingAppConfig?.id === app.id ? (
                            <input
                              type="text"
                              value={editingAppConfig.db_name}
                              onChange={(e) => setEditingAppConfig((p) => p ? { ...p, db_name: e.target.value } : null)}
                              className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                            />
                          ) : (
                            <span className="text-white/90">{app.db_name || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editingAppConfig?.id === app.id ? (
                            <input
                              type="text"
                              value={editingAppConfig.raw_table_name}
                              onChange={(e) => setEditingAppConfig((p) => p ? { ...p, raw_table_name: e.target.value } : null)}
                              className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                            />
                          ) : (
                            <span className="text-white/90">{app.raw_table_name || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editingAppConfig?.id === app.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  updateConfigMutation.mutate(
                                    { id: app.id, db_name: editingAppConfig.db_name, raw_table_name: editingAppConfig.raw_table_name },
                                    { onSuccess: () => setEditingAppConfig(null) }
                                  )
                                }}
                                disabled={updateConfigMutation.isPending}
                                className="px-2 py-1 bg-green-600/80 hover:bg-green-500 text-white rounded text-xs disabled:opacity-50"
                              >
                                {updateConfigMutation.isPending ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingAppConfig(null)}
                                className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingAppConfig({ id: app.id, db_name: app.db_name || '', raw_table_name: app.raw_table_name || '' })}
                              className="px-2 py-1 bg-blue-600/80 hover:bg-blue-500 text-white rounded text-xs"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    )) ?? []}
                  </tbody>
                </table>
              </div>
              {(!appsWithConfig?.data?.applications?.length) && !appsWithConfig && (
                <div className="p-8 text-center text-white/50">Loading...</div>
              )}
              {appsWithConfig?.data?.applications?.length === 0 && (
                <div className="p-8 text-center text-white/50">No applications configured.</div>
              )}
            </div>
          </div>
        )}

        {/* Modals */}
        {/* Approve Modal */}
        {showApproveModal && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Approve User Request</h3>
              <p className="text-white/70 mb-4">
                Approve registration request for <strong className="text-white">{selectedRequest.username}</strong>?
              </p>
              <div className="mb-4">
                <label className="block text-sm text-white/70 mb-2">Assign Role</label>
                <select
                  value={approvedRole}
                  onChange={(e) => setApprovedRole(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="superadmin" className="bg-gray-700 text-white">Superadmin</option>
                  <option value="admin" className="bg-gray-700 text-white">Admin</option>
                  <option value="user" className="bg-gray-700 text-white">User</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowApproveModal(false)
                    setSelectedRequest(null)
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Reject User Request</h3>
              <p className="text-white/70 mb-4">
                Reject registration request for <strong className="text-white">{selectedRequest.username}</strong>?
              </p>
              <div className="mb-4">
                <label className="block text-sm text-white/70 mb-2">Rejection Reason (Optional)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedRequest(null)
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Role Modal */}
        {showEditRoleModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Edit User Role</h3>
              <p className="text-white/70 mb-4">
                Change role for <strong className="text-white">{selectedUser.username}</strong>
              </p>
              <div className="mb-4">
                <label className="block text-sm text-white/70 mb-2">Current Role</label>
                <p className="text-white font-medium mb-4">{selectedUser.role}</p>
                <label className="block text-sm text-white/70 mb-2">New Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="superadmin" className="bg-gray-700 text-white">Superadmin</option>
                  <option value="admin" className="bg-gray-700 text-white">Admin</option>
                  <option value="user" className="bg-gray-700 text-white">User</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowEditRoleModal(false)
                    setSelectedUser(null)
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRole}
                  disabled={processing || newRole === selectedUser.role}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Update Role'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
