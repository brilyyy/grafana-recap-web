'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

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

type TabType = 'users' | 'audit-logs' | 'app-processing'

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
  const [processingStates, setProcessingStates] = useState<{
    [appName: string]: { loading: boolean; result: any; error: string | null }
  }>({})
  const [processingDates, setProcessingDates] = useState<{ [appName: string]: string }>({})

  useEffect(() => {
    let isMounted = true

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check')
        if (!isMounted) return

        const data = await response.json()

        if (data.success && data.data.authenticated) {
          setIsAuthenticated(true)
          setUserRole(data.data.user.role)

          if (data.data.user.role !== 'superadmin') {
            router.replace('/')
            return
          }
        } else {
          router.replace('/login')
        }
      } catch (error) {
        if (!isMounted) return
        router.replace('/login')
      }
    }

    checkAuth()

    return () => {
      isMounted = false
    }
  }, [router])

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

  const hasProcessingCapability = (appName: string): boolean => {
    return appName.toLowerCase() === 'bale'
  }

  const handleApplicationProcessingTrigger = async (appName: string, date?: string) => {
    if (!hasProcessingCapability(appName)) {
      return
    }

    // Initialize processing state for this application
    setProcessingStates((prev) => ({
      ...prev,
      [appName]: { loading: true, result: null, error: null },
    }))

    try {
      // Determine API endpoint based on app name
      const appNameLower = appName.toLowerCase()
      const endpoint = `/api/${appNameLower}/process-manual${date ? `?date=${date}` : ''}`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (data.success) {
        setProcessingStates((prev) => ({
          ...prev,
          [appName]: { loading: false, result: data.data, error: null },
        }))
      } else {
        setProcessingStates((prev) => ({
          ...prev,
          [appName]: { loading: false, result: null, error: data.message || 'Processing failed' },
        }))
      }
    } catch (error: any) {
      setProcessingStates((prev) => ({
        ...prev,
        [appName]: { loading: false, result: null, error: error.message || 'Error triggering processing' },
      }))
    }
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || userRole !== 'superadmin') {
    return null
  }

  return (
    <main className="min-h-screen p-4 md:p-6 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
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
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
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
                Manually trigger data processing for applications. Processing will aggregate transaction data and update success rate metrics.
              </p>
            </div>

            {applicationsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-white/70">Loading applications...</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-white/70">No applications found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {applications.map((app) => {
                  const hasCapability = hasProcessingCapability(app.app_name)
                  const processingState = processingStates[app.app_name] || { loading: false, result: null, error: null }
                  const processingDate = processingDates[app.app_name] || ''

                  return (
                    <div
                      key={app.id}
                      className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden"
                    >
                      <div className="p-4 border-b border-white/20">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-white">{app.app_name}</h4>
                          {hasCapability ? (
                            <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-medium">
                              Available
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded text-xs font-medium">
                              Not Available
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        {hasCapability ? (
                          <>
                            <div>
                              <label className="block text-sm text-white/70 mb-2">
                                Processing Date (Optional)
                              </label>
                              <input
                                type="date"
                                value={processingDate}
                                onChange={(e) => {
                                  setProcessingDates((prev) => ({
                                    ...prev,
                                    [app.app_name]: e.target.value,
                                  }))
                                }}
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Leave empty for H-1 (yesterday)"
                              />
                              <p className="text-xs text-white/50 mt-1">
                                Leave empty to process yesterday's data (H-1)
                              </p>
                            </div>

                            <button
                              onClick={() => handleApplicationProcessingTrigger(app.app_name, processingDate || undefined)}
                              disabled={processingState.loading}
                              className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              {processingState.loading ? (
                                <span className="flex items-center justify-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Processing...
                                </span>
                              ) : (
                                'Trigger Processing'
                              )}
                            </button>

                            {processingState.error && (
                              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                                <p className="text-sm text-red-300">{processingState.error}</p>
                              </div>
                            )}

                            {processingState.result && (
                              <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg space-y-2">
                                <p className="text-sm font-semibold text-green-300">Processing Successful</p>
                                {processingState.result.logEntry && (
                                  <div className="text-xs text-white/70 space-y-1">
                                    <p>
                                      <span className="font-medium">Status:</span>{' '}
                                      <span
                                        className={`${
                                          processingState.result.logEntry.status === 'success'
                                            ? 'text-green-300'
                                            : processingState.result.logEntry.status === 'failed'
                                            ? 'text-red-300'
                                            : 'text-yellow-300'
                                        }`}
                                      >
                                        {processingState.result.logEntry.status}
                                      </span>
                                    </p>
                                    <p>
                                      <span className="font-medium">Records Processed:</span>{' '}
                                      {processingState.result.logEntry.recordsProcessed || 0}
                                    </p>
                                    <p>
                                      <span className="font-medium">Records Inserted:</span>{' '}
                                      {processingState.result.logEntry.recordsInserted || 0}
                                    </p>
                                    {processingState.result.logEntry.startTime && (
                                      <p>
                                        <span className="font-medium">Start Time:</span>{' '}
                                        {formatDate(processingState.result.logEntry.startTime)}
                                      </p>
                                    )}
                                    {processingState.result.logEntry.endTime && (
                                      <p>
                                        <span className="font-medium">End Time:</span>{' '}
                                        {formatDate(processingState.result.logEntry.endTime)}
                                      </p>
                                    )}
                                    {processingState.result.logEntry.errorMessage && (
                                      <p className="text-red-300">
                                        <span className="font-medium">Error:</span>{' '}
                                        {processingState.result.logEntry.errorMessage}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="p-3 bg-gray-500/20 border border-gray-500/50 rounded-lg">
                            <p className="text-sm text-gray-300">
                              Processing capability not yet available for this application.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
