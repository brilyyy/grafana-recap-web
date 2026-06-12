import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Fragment, useEffect, useState } from 'react'
import LogoutButton from '@/components/logout-button'
import { Button } from '@/components/ui/button'
import { trpc } from '@/router'

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

type TabType = 'users' | 'audit-logs' | 'app-processing' | 'job-list' | 'app-config' | 'housekeeping'

export const Route = createFileRoute('/superadmin')({
  ssr: false,
  component: SuperadminPage,
})

function SuperadminPage() {
  const navigate = useNavigate()
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
  const [processingLogs, setProcessingLogs] = useState<
    Array<{
      id: number
      app_name: string
      processing_date: string
      status: 'running' | 'success' | 'failed'
      records_processed: number
      records_inserted: number
      start_time: string
      end_time: string | null
      error_message: string | null
      recap_kind: string
      catalog_entry_id: string | null
    }>
  >([])
  const [processingLogsLoading, setProcessingLogsLoading] = useState(false)
  const [processingFilters, setProcessingFilters] = useState({
    catalog_entry_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  })
  const [processingJobSearch, setProcessingJobSearch] = useState('')
  const [processingStates, setProcessingStates] = useState<{
    [date: string]: { loading: boolean; error: string | null }
  }>({})

  // Housekeeping state
  const [editingRetention, setEditingRetention] = useState<{ id: number; value: string } | null>(null)
  const [editingDateConfig, setEditingDateConfig] = useState<{
    id: number
    date_column: string
    date_column_type: 'timestamp' | 'int_1yymmdd'
  } | null>(null)
  const [newHkForm, setNewHkForm] = useState({
    db_name: '',
    table_name: '',
    date_column: '',
    date_column_type: 'timestamp' as 'timestamp' | 'int_1yymmdd',
    retention_days: '',
    notes: '',
  })
  const [housekeepingRunning, setHousekeepingRunning] = useState<{ [id: number]: boolean }>({})
  const [housekeepingMessages, setHousekeepingMessages] = useState<{
    [id: number]: { type: 'success' | 'error'; text: string }
  }>({})

  const utils = trpc.useUtils()
  const approveRequestMutation = trpc.auth.approveRequest.useMutation()
  const rejectRequestMutation = trpc.auth.rejectRequest.useMutation()
  const updateUserMutation = trpc.users.update.useMutation()
  const { data: authCheck, isLoading: authLoading } = trpc.auth.check.useQuery(undefined, { retry: false })
  const { data: fdwData, refetch: refetchFdw } = trpc.fdw.list.useQuery(undefined, {
    enabled: !!(isAuthenticated && userRole === 'superadmin' && activeTab === 'app-config'),
  })
  const fdwAddMutation = trpc.fdw.add.useMutation({
    onSuccess: () => {
      refetchFdw()
      setNewFdwForm({ source_db_name: '', table_name: '', schema_name: 'public' })
    },
  })
  const fdwRemoveMutation = trpc.fdw.remove.useMutation({ onSuccess: () => refetchFdw() })
  const [newFdwForm, setNewFdwForm] = useState({ source_db_name: '', table_name: '', schema_name: 'public' })
  const {
    data: housekeepingData,
    refetch: refetchHousekeeping,
    isLoading: housekeepingLoading,
  } = trpc.housekeeping.list.useQuery(undefined, {
    enabled: !!(isAuthenticated && userRole === 'superadmin' && activeTab === 'housekeeping'),
  })
  const { data: housekeepingScheduleData } = trpc.housekeeping.getSchedule.useQuery(undefined, {
    enabled: !!(isAuthenticated && userRole === 'superadmin' && activeTab === 'housekeeping'),
  })
  const updateConfigMutation = trpc.housekeeping.updateConfig.useMutation({ onSuccess: () => refetchHousekeeping() })
  const upsertHousekeepingMutation = trpc.housekeeping.upsertRow.useMutation({
    onSuccess: () => {
      refetchHousekeeping()
      setNewHkForm({
        db_name: '',
        table_name: '',
        date_column: '',
        date_column_type: 'timestamp',
        retention_days: '',
        notes: '',
      })
    },
  })
  const deleteHousekeepingMutation = trpc.housekeeping.deleteRow.useMutation({ onSuccess: () => refetchHousekeeping() })
  const runHousekeepingMutation = trpc.housekeeping.run.useMutation()

  const {
    data: recapCatalogData,
    isLoading: recapCatalogLoading,
    refetch: refetchRecapCatalog,
  } = trpc.recap.listCatalog.useQuery(undefined, {
    enabled: !!(
      isAuthenticated &&
      userRole === 'superadmin' &&
      (activeTab === 'job-list' || activeTab === 'app-processing')
    ),
  })
  const recapTriggerMutation = trpc.recap.triggerManual.useMutation({
    onSuccess: () => refetchRecapCatalog(),
  })
  const [recapExpandedId, setRecapExpandedId] = useState<string | null>(null)
  const [recapManualDates, setRecapManualDates] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!authLoading && authCheck !== undefined) {
      if (!authCheck?.data?.authenticated) {
        navigate({ to: '/login', replace: true })
      } else {
        const role = (authCheck.data as any)?.user?.role
        setIsAuthenticated(true)
        setUserRole(role)
        if (role !== 'superadmin') navigate({ to: '/', replace: true })
      }
    }
  }, [authCheck, authLoading, navigate])

  const fetchUsers = async () => {
    try {
      setUsersLoading(true)
      const res = await utils.users.list.fetch({
        page: usersPage,
        limit: 25,
        search: usersFilters.search || undefined,
        role: usersFilters.role || undefined,
      })
      if (res.success) {
        setUsers(res.data.users)
        setUsersTotalPages(res.data.totalPages)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchPendingRequests = async () => {
    try {
      const res = await utils.auth.pendingRequests.fetch()
      if (res.success) {
        setPendingRequests((res.data as { requests: PendingUserRequest[] }).requests)
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true)
      const res = await utils.auditLogs.list.fetch({
        page: auditPage,
        limit: 50,
        action: auditFilters.action || undefined,
        resourceType: auditFilters.resource_type || undefined,
        username: auditFilters.username || undefined,
        startDate: auditFilters.start_date || undefined,
        endDate: auditFilters.end_date || undefined,
      })
      if (res.success) {
        setAuditLogs(res.data.logs)
        setAuditTotalPages(res.data.totalPages)
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setAuditLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await utils.auditLogs.stats.fetch({ days: 30 })
      if (res.success) {
        setStats(res.data as AuditStats)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchProcessingLogs = async () => {
    if (!processingFilters.catalog_entry_id || !processingFilters.month || !processingFilters.year) {
      return
    }

    try {
      setProcessingLogsLoading(true)
      const res = await utils.processingLogs.byMonth.fetch({
        catalogEntryId: processingFilters.catalog_entry_id,
        month: processingFilters.month,
        year: processingFilters.year,
      })
      setProcessingLogs(res.data || [])
    } catch (error: any) {
      console.error('Error fetching processing logs:', error)
      alert(error?.message || 'Error fetching processing logs')
      setProcessingLogs([])
    } finally {
      setProcessingLogsLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && userRole === 'superadmin') {
      if (activeTab === 'users') {
        fetchUsers()
        fetchPendingRequests()
      } else if (activeTab === 'audit-logs') {
        fetchAuditLogs()
        fetchStats()
      }
    }
  }, [isAuthenticated, userRole, activeTab, fetchUsers, fetchPendingRequests, fetchStats, fetchAuditLogs])

  useEffect(() => {
    if (activeTab !== 'app-processing') return
    const entries = recapCatalogData?.data ?? []
    if (!entries.length) {
      setProcessingLogs([])
      return
    }

    if (
      !processingFilters.catalog_entry_id ||
      !entries.some((entry) => entry.id === processingFilters.catalog_entry_id)
    ) {
      setProcessingFilters((prev) => ({ ...prev, catalog_entry_id: entries[0].id }))
      return
    }

    if (processingFilters.month && processingFilters.year) {
      fetchProcessingLogs()
    }
  }, [
    activeTab,
    recapCatalogData,
    processingFilters.catalog_entry_id,
    processingFilters.month,
    processingFilters.year,
    fetchProcessingLogs,
  ])

  useEffect(() => {
    if (activeTab !== 'app-processing') return
    if (!processingFilters.catalog_entry_id) {
      setProcessingLogs([])
    }
  }, [activeTab, processingFilters.catalog_entry_id])

  // User Management Functions
  const handleApprove = async () => {
    if (!selectedRequest) return

    try {
      setProcessing(true)
      await approveRequestMutation.mutateAsync({
        id: selectedRequest.id,
        approvedRole: approvedRole as 'superadmin' | 'admin' | 'user',
      })
      setShowApproveModal(false)
      setSelectedRequest(null)
      setApprovedRole('user')
      fetchUsers()
      fetchPendingRequests()
    } catch (error: any) {
      console.error('Error approving request:', error)
      alert(error?.message || 'Error approving user request')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return

    try {
      setProcessing(true)
      await rejectRequestMutation.mutateAsync({
        id: selectedRequest.id,
        rejectionReason: rejectionReason || undefined,
      })
      setShowRejectModal(false)
      setSelectedRequest(null)
      setRejectionReason('')
      fetchPendingRequests()
    } catch (error: any) {
      console.error('Error rejecting request:', error)
      alert(error?.message || 'Error rejecting user request')
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdateRole = async () => {
    if (!selectedUser) return

    try {
      setProcessing(true)
      await updateUserMutation.mutateAsync({
        id: selectedUser.id,
        role: newRole as 'superadmin' | 'admin' | 'user',
      })
      setShowEditRoleModal(false)
      setSelectedUser(null)
      setNewRole('user')
      fetchUsers()
    } catch (error: any) {
      console.error('Error updating role:', error)
      alert(error?.message || 'Error updating user role')
    } finally {
      setProcessing(false)
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

  const _formatProcessingDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const _formatProcessingTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleDateProcessing = async (date: string) => {
    if (!processingFilters.catalog_entry_id) {
      alert('Please select a job before processing data.')
      return
    }

    // Validate date: cannot process future dates or current date
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const processingDate = new Date(`${date}T00:00:00`)
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
      const res = await recapTriggerMutation.mutateAsync({
        catalogEntryId: processingFilters.catalog_entry_id,
        date,
      })

      setProcessingStates((prev) => ({
        ...prev,
        [date]: { loading: false, error: null },
      }))
      const logEntry = res.data?.logEntry
      if (logEntry) {
        const statusMsg =
          logEntry.status === 'success'
            ? `Successfully processed ${logEntry.recordsProcessed || 0} records (${logEntry.recordsInserted || 0} inserted)`
            : logEntry.status === 'failed'
              ? `Processing failed: ${logEntry.errorMessage || 'Unknown error'}`
              : 'Processing is running...'
        alert(`Processing triggered for ${date}.\n${statusMsg}`)
      } else {
        alert(`Processing triggered successfully for ${date}`)
      }
      // Small delay so the stored procedure finishes writing before refresh
      await new Promise((resolve) => setTimeout(resolve, 500))
      await fetchProcessingLogs()
    } catch (error: any) {
      setProcessingStates((prev) => ({
        ...prev,
        [date]: { loading: false, error: error?.message || 'Error triggering processing' },
      }))
      alert(`Error triggering processing: ${error?.message ?? String(error)}`)
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
  const logsByDate = processingLogs.reduce(
    (acc, log) => {
      acc[log.processing_date] = log
      return acc
    },
    {} as Record<string, (typeof processingLogs)[0]>,
  )
  const processingCatalogEntries = recapCatalogData?.data ?? []
  const processingJobSearchTerm = processingJobSearch.trim().toLowerCase()
  const filteredProcessingCatalogEntries = processingCatalogEntries.filter((entry) => {
    if (!processingJobSearchTerm) return true
    return (
      entry.title.toLowerCase().includes(processingJobSearchTerm) ||
      entry.id.toLowerCase().includes(processingJobSearchTerm) ||
      entry.outputTable.toLowerCase().includes(processingJobSearchTerm)
    )
  })
  const selectedProcessingJob = processingCatalogEntries.find(
    (entry) => entry.id === processingFilters.catalog_entry_id,
  )

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
            <h1 className="text-2xl md:text-3xl font-extrabold mb-2 bg-clip-text text-transparent bg-linear-to-r from-white via-blue-200 to-red-200">
              Superadmin Dashboard
            </h1>
            <p className="text-white/70 text-sm">Manage users and monitor system activities</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate({ to: '/' })}
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
              activeTab === 'users' ? 'text-white border-b-2 border-blue-400' : 'text-white/70 hover:text-white'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('audit-logs')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'audit-logs' ? 'text-white border-b-2 border-blue-400' : 'text-white/70 hover:text-white'
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
            onClick={() => setActiveTab('job-list')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'job-list' ? 'text-white border-b-2 border-blue-400' : 'text-white/70 hover:text-white'
            }`}
          >
            Job List
          </button>
          <button
            onClick={() => setActiveTab('app-config')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'app-config' ? 'text-white border-b-2 border-blue-400' : 'text-white/70 hover:text-white'
            }`}
          >
            FDW Configuration
          </button>
          <button
            onClick={() => setActiveTab('housekeeping')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'housekeeping' ? 'text-white border-b-2 border-blue-400' : 'text-white/70 hover:text-white'
            }`}
          >
            Housekeeping
          </button>
        </div>

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Pending Requests Section */}
            {pendingRequests.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
                <div className="p-4 border-b border-white/20">
                  <h3 className="text-lg font-semibold text-white">Pending User Requests ({pendingRequests.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Username</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">
                          Requested Role
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">
                          Requested By
                        </th>
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
                          <td className="px-4 py-3 text-sm text-white/70">{request.requested_by_username || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-white/70">{formatDate(request.created_at)}</td>
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
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <select
                    value={usersFilters.role}
                    onChange={(e) => {
                      setUsersFilters((prev) => ({ ...prev, role: e.target.value }))
                      setUsersPage(1)
                    }}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
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
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">
                            Username
                          </th>
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
                            <td className="px-4 py-3 text-sm text-white/70">{formatDate(user.created_at)}</td>
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
                  <p className="text-xs text-white/50 mt-1">{stats.actionCounts[0]?.count || 0} times</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <p className="text-white/70 text-sm mb-1">Top Resource</p>
                  <p className="text-xl font-bold text-white break-words overflow-hidden">
                    {stats.resourceTypeCounts[0]?.resource_type || 'N/A'}
                  </p>
                  <p className="text-xs text-white/50 mt-1">{stats.resourceTypeCounts[0]?.count || 0} times</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <p className="text-white/70 text-sm mb-1">Most Active User</p>
                  <p className="text-xl font-bold text-white">{stats.topUsers[0]?.username || 'N/A'}</p>
                  <p className="text-xs text-white/50 mt-1">{stats.topUsers[0]?.count || 0} activities</p>
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
                          <span className="text-white/90 break-words overflow-hidden flex-1 min-w-0">
                            {item.action}
                          </span>
                          <span className="text-white/70 shrink-0">{item.count}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-linear-to-r from-blue-500 to-blue-400 h-2 rounded-full"
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
                    {stats.dailyActivity
                      .slice(0, 7)
                      .reverse()
                      .map((item, idx) => {
                        const maxCount = Math.max(...stats.dailyActivity.map((d) => d.count), 1)
                        const height = (item.count / maxCount) * 100
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center">
                            <div className="w-full flex flex-col items-center justify-end h-full">
                              <div
                                className="w-full bg-linear-to-t from-blue-600 to-blue-400 rounded-t"
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
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">
                            Resource
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Details</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">
                            IP Address
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-white/5">
                            <td className="px-4 py-3 text-sm text-white/90">{formatDate(log.created_at)}</td>
                            <td className="px-4 py-3 text-sm text-white/90">{log.username || 'System'}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-white/90">
                              {log.resource_type}
                              {log.resource_id && ` #${log.resource_id}`}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/70 max-w-md truncate">{log.details || '-'}</td>
                            <td className="px-4 py-3 text-sm text-white/70">{log.ip_address || '-'}</td>
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
              <p className="text-white/70 text-sm mb-4">View processing logs by selecting a job, month, and year.</p>
            </div>

            {/* Filters */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Month</label>
                  <select
                    value={processingFilters.month}
                    onChange={(e) => {
                      setProcessingFilters((prev) => ({ ...prev, month: parseInt(e.target.value, 10) }))
                    }}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="1" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      January
                    </option>
                    <option value="2" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      February
                    </option>
                    <option value="3" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      March
                    </option>
                    <option value="4" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      April
                    </option>
                    <option value="5" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      May
                    </option>
                    <option value="6" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      June
                    </option>
                    <option value="7" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      July
                    </option>
                    <option value="8" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      August
                    </option>
                    <option value="9" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      September
                    </option>
                    <option value="10" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      October
                    </option>
                    <option value="11" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      November
                    </option>
                    <option value="12" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                      December
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Year</label>
                  <select
                    value={processingFilters.year}
                    onChange={(e) => {
                      setProcessingFilters((prev) => ({ ...prev, year: parseInt(e.target.value, 10) }))
                    }}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    style={{ colorScheme: 'dark' }}
                  >
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - i
                      return (
                        <option key={year} value={year} style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                          {year}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm text-white/70 mb-1">Search job</label>
                  <input
                    type="text"
                    value={processingJobSearch}
                    onChange={(e) => setProcessingJobSearch(e.target.value)}
                    placeholder="Search by job title, ID, or output table"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-4">
                  <label className="block text-sm text-white/70 mb-1">Job</label>
                  {recapCatalogLoading ? (
                    <div className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white/50 text-sm">
                      Loading jobs...
                    </div>
                  ) : (
                    <select
                      value={processingFilters.catalog_entry_id}
                      onChange={(e) => {
                        setProcessingFilters((prev) => ({ ...prev, catalog_entry_id: e.target.value }))
                      }}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="" style={{ backgroundColor: '#1f2937', color: '#ffffff' }}>
                        Select Job
                      </option>
                      {filteredProcessingCatalogEntries.map((entry) => (
                        <option
                          key={entry.id}
                          value={entry.id}
                          style={{ backgroundColor: '#1f2937', color: '#ffffff' }}
                        >
                          {entry.title} ({entry.id})
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedProcessingJob && (
                    <p className="mt-2 text-xs text-white/50">
                      Output: <span className="font-mono text-white/70">{selectedProcessingJob.outputTable}</span>
                      {' · '}
                      Function: <span className="font-mono text-white/70">{selectedProcessingJob.functionName}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Processing Results */}
            {processingFilters.catalog_entry_id ? (
              (() => {
                const allDates = getAllDatesInMonth(processingFilters.month, processingFilters.year)
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                return (
                  <div className="space-y-4">
                    {/* Summary Statistics */}
                    {processingLogsLoading ? (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-4 h-4 rounded bg-white/20 animate-pulse" />
                              <div className="h-3 w-16 rounded bg-white/20 animate-pulse" />
                            </div>
                            <div className="h-6 w-10 rounded bg-white/20 animate-pulse mt-1" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {(() => {
                          const stats = {
                            total: allDates.length,
                            success: allDates.filter((d) => logsByDate[d]?.status === 'success').length,
                            failed: allDates.filter((d) => logsByDate[d]?.status === 'failed').length,
                            processing: allDates.filter((d) => logsByDate[d]?.status === 'running').length,
                            notProcessed: allDates.filter((d) => !logsByDate[d]).length,
                          }
                          return (
                            <>
                              <div className="bg-linear-to-br from-green-500/20 to-green-600/10 backdrop-blur-sm rounded-lg p-3 border border-green-500/30">
                                <div className="flex items-center gap-2 mb-1">
                                  <svg
                                    className="w-4 h-4 text-green-300"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <span className="text-xs font-medium text-green-300">Success</span>
                                </div>
                                <p className="text-xl font-bold text-white">{stats.success}</p>
                              </div>
                              <div className="bg-linear-to-br from-red-500/20 to-red-600/10 backdrop-blur-sm rounded-lg p-3 border border-red-500/30">
                                <div className="flex items-center gap-2 mb-1">
                                  <svg
                                    className="w-4 h-4 text-red-300"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <span className="text-xs font-medium text-red-300">Failed</span>
                                </div>
                                <p className="text-xl font-bold text-white">{stats.failed}</p>
                              </div>
                              <div className="bg-linear-to-br from-yellow-500/20 to-yellow-600/10 backdrop-blur-sm rounded-lg p-3 border border-yellow-500/30">
                                <div className="flex items-center gap-2 mb-1">
                                  <svg
                                    className="w-4 h-4 text-yellow-300"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <span className="text-xs font-medium text-yellow-300">Processing</span>
                                </div>
                                <p className="text-xl font-bold text-white">{stats.processing}</p>
                              </div>
                              <div className="bg-linear-to-br from-gray-500/20 to-gray-600/10 backdrop-blur-sm rounded-lg p-3 border border-gray-500/30">
                                <div className="flex items-center gap-2 mb-1">
                                  <svg
                                    className="w-4 h-4 text-gray-300"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                    />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-300">Not Processed</span>
                                </div>
                                <p className="text-xl font-bold text-white">{stats.notProcessed}</p>
                              </div>
                              <div className="bg-linear-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-sm rounded-lg p-3 border border-blue-500/30">
                                <div className="flex items-center gap-2 mb-1">
                                  <svg
                                    className="w-4 h-4 text-blue-300"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                    />
                                  </svg>
                                  <span className="text-xs font-medium text-blue-300">Total</span>
                                </div>
                                <p className="text-xl font-bold text-white">{stats.total}</p>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    )}

                    {/* Calendar Grid */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">
                          {new Date(processingFilters.year, processingFilters.month - 1, 1).toLocaleDateString(
                            'id-ID',
                            {
                              month: 'long',
                              year: 'numeric',
                            },
                          )}
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
                        {processingLogsLoading
                          ? (() => {
                              const firstDay = new Date(processingFilters.year, processingFilters.month - 1, 1).getDay()
                              const emptyDays = Array(firstDay).fill(null)
                              return [...emptyDays, ...allDates].map((dateStr, idx) => {
                                if (!dateStr) {
                                  return <div key={`empty-${idx}`} className="aspect-square" />
                                }
                                return (
                                  <div key={dateStr} className="aspect-square bg-white/10 rounded-lg animate-pulse" />
                                )
                              })
                            })()
                          : (() => {
                              const firstDay = new Date(processingFilters.year, processingFilters.month - 1, 1).getDay()
                              const emptyDays = Array(firstDay).fill(null)
                              return [...emptyDays, ...allDates].map((dateStr, idx) => {
                                if (!dateStr) {
                                  return <div key={`empty-${idx}`} className="aspect-square"></div>
                                }

                                const log = logsByDate[dateStr]
                                const date = new Date(`${dateStr}T00:00:00`)
                                date.setHours(0, 0, 0, 0)
                                const canProcess = date < today
                                const processingState = processingStates[dateStr] || { loading: false, error: null }
                                const status = log?.status || null
                                const isToday = dateStr === today.toISOString().split('T')[0]

                                // Check if it's a simple success (only tick, no other important info)
                                const isSimpleSuccess =
                                  status === 'success' &&
                                  (!log || (!log.error_message && log.records_processed === null))

                                // Determine card styling based on status
                                const cardClasses =
                                  'aspect-square bg-white/10 backdrop-blur-sm rounded-lg border flex flex-col transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer'
                                let borderColor = 'border-white/20'
                                let bgGradient = ''
                                let paddingClass = 'p-2'

                                if (status === 'success') {
                                  borderColor = 'border-green-500/50'
                                  bgGradient = 'bg-linear-to-br from-green-500/20 to-green-600/10'
                                  // Make it more compact if it's simple success
                                  if (isSimpleSuccess) {
                                    paddingClass = 'p-1.5'
                                  }
                                } else if (status === 'failed') {
                                  borderColor = 'border-red-500/50'
                                  bgGradient = 'bg-linear-to-br from-red-500/20 to-red-600/10'
                                } else if (status === 'running') {
                                  borderColor = 'border-yellow-500/50'
                                  bgGradient = 'bg-linear-to-br from-yellow-500/20 to-yellow-600/10'
                                } else {
                                  borderColor = 'border-gray-500/30'
                                  bgGradient = 'bg-linear-to-br from-gray-500/10 to-gray-600/5'
                                }

                                if (isToday) {
                                  borderColor = 'border-blue-400/70 border-2'
                                }

                                return (
                                  <div
                                    key={dateStr}
                                    className={`${cardClasses} ${bgGradient} ${borderColor} ${paddingClass} ${!canProcess ? 'opacity-50' : ''}`}
                                    title={isToday ? 'Today' : ''}
                                  >
                                    {/* Date Number */}
                                    <div
                                      className={`flex items-center justify-between ${isSimpleSuccess ? 'mb-0.5' : 'mb-1'}`}
                                    >
                                      <span
                                        className={`${isSimpleSuccess ? 'text-xs' : 'text-sm'} font-bold ${isToday ? 'text-blue-300' : 'text-white'}`}
                                      >
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
                                          <svg
                                            className="w-5 h-5 text-green-300"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M5 13l4 4L19 7"
                                            />
                                          </svg>
                                        )}
                                        {status === 'failed' && (
                                          <svg
                                            className="w-5 h-5 text-red-300"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M6 18L18 6M6 6l12 12"
                                            />
                                          </svg>
                                        )}
                                        {status === 'running' && (
                                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-yellow-300 border-t-transparent"></div>
                                        )}
                                        {!status && (
                                          <svg
                                            className="w-4 h-4 text-gray-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                            />
                                          </svg>
                                        )}
                                      </div>
                                    )}

                                    {/* Simple Success - Just show small icon */}
                                    {isSimpleSuccess && (
                                      <div className="flex-1 flex items-center justify-center mb-0.5">
                                        <svg
                                          className="w-4 h-4 text-green-300"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      </div>
                                    )}

                                    {/* Quick Stats - Only show if not simple success */}
                                    {log && !isSimpleSuccess && (
                                      <div className="text-[10px] text-white/70 space-y-0.5">
                                        {log.records_processed !== null && (
                                          <div className="flex items-center gap-1">
                                            <svg
                                              className="w-2.5 h-2.5"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                              />
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
                                          handleDateProcessing(dateStr)
                                        }}
                                        disabled={processingState.loading}
                                        className={`w-full bg-linear-to-r from-blue-600/80 to-blue-500/80 hover:from-blue-500 hover:to-blue-400 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-1 ${
                                          isSimpleSuccess ? 'px-2 py-2 text-xs' : 'mt-1 px-1.5 py-1 text-[10px]'
                                        }`}
                                      >
                                        {processingState.loading ? (
                                          <>
                                            <div
                                              className={`animate-spin rounded-full border-2 border-white border-t-transparent ${isSimpleSuccess ? 'h-3 w-3' : 'h-2.5 w-2.5'}`}
                                            ></div>
                                            <span>Processing</span>
                                          </>
                                        ) : (
                                          <>
                                            <svg
                                              className={isSimpleSuccess ? 'w-3 h-3' : 'w-2.5 h-2.5'}
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                              />
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

                    {/* Detailed View Toggle - Hidden when loading */}
                    {!processingLogsLoading && (
                      <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                        <details className="group">
                          <summary className="cursor-pointer flex items-center justify-between text-white font-medium hover:text-blue-300 transition-colors">
                            <span>View Detailed Information</span>
                            <svg
                              className="w-5 h-5 transform group-open:rotate-180 transition-transform"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
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
                    )}
                  </div>
                )
              })()
            ) : (
              <div className="p-8 text-center text-white/70">Select a job to view processing logs</div>
            )}
          </div>
        )}

        {/* Job list: schedulable recap jobs (success rate + custom models) */}
        {activeTab === 'job-list' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">Job List</h3>
              <p className="text-white/70 text-sm mb-2">
                All schedulable recap jobs (success rate per app and custom models). Expand a row for the summary and
                representative query text. Use <strong className="text-white">Application Data Processing</strong> with
                the same job to inspect calendar logs.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-white/80">
                    <tr>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Kind</th>
                      <th className="px-3 py-2">Output table</th>
                      <th className="px-3 py-2">Schedule (env)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recapCatalogLoading
                      ? Array.from({ length: 8 }).map((_, i) => (
                          <tr key={`recap-catalog-skeleton-${i}`} className="border-t border-white/10">
                            <td className="px-3 py-2">
                              <div className="h-4 w-40 max-w-full rounded bg-white/20 animate-pulse mb-2" />
                              <div className="h-7 w-[11rem] max-w-full rounded bg-white/15 animate-pulse" />
                            </td>
                            <td className="px-3 py-2">
                              <div className="h-3 w-28 rounded bg-white/20 animate-pulse" />
                            </td>
                            <td className="px-3 py-2">
                              <div className="h-3 w-24 rounded bg-white/20 animate-pulse" />
                            </td>
                            <td className="px-3 py-2">
                              <div className="h-3 w-32 rounded bg-white/20 animate-pulse" />
                            </td>
                            <td className="px-3 py-2">
                              <div className="h-3 w-36 rounded bg-white/20 animate-pulse mb-1" />
                              <div className="h-2 w-24 rounded bg-white/10 animate-pulse" />
                            </td>
                          </tr>
                        ))
                      : (recapCatalogData?.data ?? []).map((row) => (
                          <Fragment key={row.id}>
                            <tr
                              className="border-t border-white/10 hover:bg-white/5 cursor-pointer"
                              onClick={() => setRecapExpandedId((id) => (id === row.id ? null : row.id))}
                            >
                              <td className="px-3 py-2 text-white">
                                <div className="font-medium">{row.title}</div>
                                <div
                                  className="mt-2 flex flex-wrap items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="date"
                                    className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs max-w-[11rem]"
                                    value={recapManualDates[row.id] ?? ''}
                                    onChange={(e) =>
                                      setRecapManualDates((prev) => ({
                                        ...prev,
                                        [row.id]: e.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-white text-xs disabled:opacity-50"
                                    disabled={recapTriggerMutation.isPending}
                                    onClick={() => {
                                      const d = recapManualDates[row.id]?.trim()
                                      recapTriggerMutation.mutate({
                                        catalogEntryId: row.id,
                                        date: d || undefined,
                                      })
                                    }}
                                  >
                                    Run now (empty date = H-1)
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-white/90 font-mono text-xs">{row.id}</td>
                              <td className="px-3 py-2 text-white/80">{row.recapKind}</td>
                              <td className="px-3 py-2 text-white/80 font-mono text-xs">{row.outputTable}</td>
                              <td className="px-3 py-2 text-white/70 text-xs">
                                {row.scheduleEnvVar ?? '—'}
                                <br />
                                <span className="text-white/50">
                                  {(row as { scheduleCronResolved?: string }).scheduleCronResolved ?? ''}
                                </span>
                              </td>
                            </tr>
                            {recapExpandedId === row.id && (
                              <tr className="bg-black/20">
                                <td colSpan={5} className="px-4 py-3 text-white/90">
                                  <p className="text-sm mb-2">{row.description}</p>
                                  <p className="text-xs text-white/70 mb-2">{row.briefProcessSummary}</p>
                                  <p className="text-xs text-white/50 mb-1">
                                    Function: <code className="text-white/80">{row.functionName}</code> · Doc:{' '}
                                    <code className="text-white/80">{row.rawSqlRepoPath}</code>
                                  </p>
                                  <details open className="mt-2">
                                    <summary className="cursor-pointer text-blue-300 text-sm mb-1">
                                      Representative query (brief)
                                    </summary>
                                    <pre className="mt-2 p-3 rounded bg-black/40 border border-white/10 text-xs overflow-x-auto whitespace-pre-wrap">
                                      {row.briefQuery}
                                    </pre>
                                  </details>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                  </tbody>
                </table>
              </div>
              {!recapCatalogLoading && recapTriggerMutation.isError && (
                <p className="p-3 text-red-300 text-sm">{recapTriggerMutation.error?.message ?? 'Trigger failed'}</p>
              )}
              {!recapCatalogLoading && recapTriggerMutation.isSuccess && recapTriggerMutation.data?.data && (
                <p className="p-3 text-green-300 text-sm">
                  {recapTriggerMutation.data.data.message} — status:{' '}
                  {recapTriggerMutation.data.data.logEntry?.status ?? '—'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* FDW Configuration Tab */}
        {activeTab === 'app-config' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">FDW Configuration</h3>
              <p className="text-white/70 text-sm">
                Manage Foreign Data Wrapper (FDW) source tables. These are shared tables imported from external
                databases (e.g. itm_db) used by apps like EDC Agen and EDC Merchant. Run migration to apply changes:{' '}
                <code className="bg-white/10 px-1 rounded text-xs">DB_NAME=platform_db npm run db:migrate</code>
              </p>
            </div>

            {/* FDW Config Section */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">FDW Source Tables</h3>
              <p className="text-white/70 text-sm mb-4">
                Add or remove source tables imported via postgres_fdw. Includes both app database connections (e.g.
                bale_db, bale_bisnis_db) and shared external tables (e.g. itm_db). After changes, run migration to
                recreate the foreign server and table mappings.
              </p>
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Source DB</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">
                          Table Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Schema</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {(fdwData?.data?.fdwSources ?? []).map(
                        (row: { id: number; source_db_name: string; table_name: string; schema_name?: string }) => (
                          <tr key={row.id} className="hover:bg-white/5">
                            <td className="px-4 py-3 text-sm text-white/90">{row.source_db_name}</td>
                            <td className="px-4 py-3 text-sm text-white/90">{row.table_name}</td>
                            <td className="px-4 py-3 text-sm text-white/90">{row.schema_name || 'public'}</td>
                            <td className="px-4 py-3 text-sm">
                              <button
                                onClick={() => fdwRemoveMutation.mutate({ id: row.id })}
                                disabled={fdwRemoveMutation.isPending}
                                className="px-2 py-1 bg-red-600/80 hover:bg-red-500 text-white rounded text-xs disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-4 items-end">
                  <input
                    type="text"
                    placeholder="Source DB (e.g. itm_db)"
                    value={newFdwForm.source_db_name}
                    onChange={(e) => setNewFdwForm((p) => ({ ...p, source_db_name: e.target.value }))}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm min-w-[120px]"
                  />
                  <input
                    type="text"
                    placeholder="Table name"
                    value={newFdwForm.table_name}
                    onChange={(e) => setNewFdwForm((p) => ({ ...p, table_name: e.target.value }))}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm min-w-[180px]"
                  />
                  <input
                    type="text"
                    placeholder="Schema (default: public)"
                    value={newFdwForm.schema_name}
                    onChange={(e) => setNewFdwForm((p) => ({ ...p, schema_name: e.target.value }))}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm min-w-[100px]"
                  />
                  <button
                    onClick={() => fdwAddMutation.mutate(newFdwForm)}
                    disabled={fdwAddMutation.isPending || !newFdwForm.source_db_name || !newFdwForm.table_name}
                    className="px-3 py-2 bg-green-600/80 hover:bg-green-500 text-white rounded text-sm disabled:opacity-50"
                  >
                    {fdwAddMutation.isPending ? 'Adding...' : 'Add FDW'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Housekeeping Tab */}
        {activeTab === 'housekeeping' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">Housekeeping Rules</h3>
              <p className="text-white/70 text-sm">
                Configure retention per raw table. Raw tables that are shared across multiple apps (e.g. EDC Agen, EDC
                Merchant, and EDC Merchant Ancol all use the same{' '}
                <code className="bg-white/10 px-1 rounded">itm_db</code> tables) appear as a single row. Running
                housekeeping deletes rows older than the configured retention period directly from the raw table.
              </p>
            </div>

            {/* scheduler info */}
            <div className="flex items-start gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-3">
              <svg
                className="w-4 h-4 text-indigo-300 mt-0.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-indigo-200 space-y-1">
                <p>
                  <span className="font-semibold text-indigo-100">Housekeeping schedule: </span>
                  <code className="bg-indigo-500/20 px-1.5 py-0.5 rounded text-xs font-mono text-indigo-100">
                    {housekeepingScheduleData?.data?.schedule ?? '0 2 * * *'}
                  </code>
                </p>
                <p className="text-indigo-300/80 text-xs">
                  Housekeeping runs via node-cron on the app server. To change the schedule, set{' '}
                  <code className="bg-indigo-500/20 px-1 rounded">HOUSEKEEPING_SCHEDULE</code> in{' '}
                  <code className="bg-indigo-500/20 px-1 rounded">.env</code> and restart the app.
                </p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 space-y-3">
              <h4 className="text-sm font-semibold text-white">Add raw table</h4>
              <p className="text-xs text-white/60">
                Use the platform relation name (prefixed FDW foreign table when applicable, e.g.{' '}
                <code className="bg-white/10 px-1 rounded">bale_db_raw_bale</code>), not only the short view name.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <input
                  placeholder="db_name"
                  value={newHkForm.db_name}
                  onChange={(e) => setNewHkForm((p) => ({ ...p, db_name: e.target.value }))}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm font-mono"
                />
                <input
                  placeholder="table_name"
                  value={newHkForm.table_name}
                  onChange={(e) => setNewHkForm((p) => ({ ...p, table_name: e.target.value }))}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm font-mono"
                />
                <input
                  placeholder="date_column (optional)"
                  value={newHkForm.date_column}
                  onChange={(e) => setNewHkForm((p) => ({ ...p, date_column: e.target.value }))}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm font-mono"
                />
                <select
                  value={newHkForm.date_column_type}
                  onChange={(e) =>
                    setNewHkForm((p) => ({ ...p, date_column_type: e.target.value as 'timestamp' | 'int_1yymmdd' }))
                  }
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="timestamp" className="bg-gray-800">
                    timestamp / date
                  </option>
                  <option value="int_1yymmdd" className="bg-gray-800">
                    integer 1YYMMDD (e.g. TRXMDT)
                  </option>
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="retention days (optional)"
                  value={newHkForm.retention_days}
                  onChange={(e) => setNewHkForm((p) => ({ ...p, retention_days: e.target.value }))}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                />
                <input
                  placeholder="notes (optional)"
                  value={newHkForm.notes}
                  onChange={(e) => setNewHkForm((p) => ({ ...p, notes: e.target.value }))}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm sm:col-span-2"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!newHkForm.db_name.trim() || !newHkForm.table_name.trim()) return
                  const rd = newHkForm.retention_days.trim() ? parseInt(newHkForm.retention_days, 10) : null
                  upsertHousekeepingMutation.mutate({
                    db_name: newHkForm.db_name.trim(),
                    table_name: newHkForm.table_name.trim(),
                    date_column: newHkForm.date_column.trim() === '' ? null : newHkForm.date_column.trim(),
                    date_column_type: newHkForm.date_column_type,
                    retention_days: rd !== null && !Number.isNaN(rd) && rd > 0 ? rd : null,
                    notes: newHkForm.notes.trim() === '' ? null : newHkForm.notes.trim(),
                  })
                }}
                disabled={
                  upsertHousekeepingMutation.isPending || !newHkForm.db_name.trim() || !newHkForm.table_name.trim()
                }
                className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-500 text-white rounded text-sm disabled:opacity-50"
              >
                {upsertHousekeepingMutation.isPending ? 'Saving…' : 'Save row'}
              </button>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
              {housekeepingLoading ? (
                <div className="p-8 text-center text-white/50">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Database</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Table</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">
                          Date Column
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">
                          Retention (days)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {(housekeepingData?.data ?? []).map(
                        (row: {
                          id: number
                          db_name: string
                          table_name: string
                          date_column: string | null
                          date_column_type: string | null
                          retention_days: number | null
                          notes: string | null
                        }) => {
                          const canRun = !!row.date_column && !!row.retention_days
                          const isRefNoDate =
                            !row.date_column && (row.notes?.toLowerCase().includes('reference') ?? false)
                          return (
                            <tr key={row.id} className={`hover:bg-white/5 ${!row.date_column ? 'opacity-70' : ''}`}>
                              <td className="px-4 py-3 text-sm text-white/80 font-mono">{row.db_name}</td>
                              <td className="px-4 py-3 text-sm text-white font-mono font-medium">{row.table_name}</td>

                              {/* Date column cell */}
                              <td className="px-4 py-3 text-sm">
                                {editingDateConfig?.id === row.id ? (
                                  <div className="flex flex-col gap-2 max-w-[220px]">
                                    <input
                                      value={editingDateConfig.date_column}
                                      onChange={(e) =>
                                        setEditingDateConfig((p) => (p ? { ...p, date_column: e.target.value } : null))
                                      }
                                      className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs font-mono"
                                      placeholder="column_name"
                                    />
                                    <select
                                      value={editingDateConfig.date_column_type}
                                      onChange={(e) =>
                                        setEditingDateConfig((p) =>
                                          p
                                            ? { ...p, date_column_type: e.target.value as 'timestamp' | 'int_1yymmdd' }
                                            : null,
                                        )
                                      }
                                      className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs"
                                      style={{ colorScheme: 'dark' }}
                                    >
                                      <option value="timestamp" className="bg-gray-800">
                                        timestamp / date
                                      </option>
                                      <option value="int_1yymmdd" className="bg-gray-800">
                                        integer 1YYMMDD
                                      </option>
                                    </select>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const col = editingDateConfig.date_column.trim()
                                          if (!col) return
                                          updateConfigMutation.mutate(
                                            {
                                              id: row.id,
                                              date_column: col,
                                              date_column_type: editingDateConfig.date_column_type,
                                            },
                                            { onSuccess: () => setEditingDateConfig(null) },
                                          )
                                        }}
                                        disabled={
                                          updateConfigMutation.isPending || !editingDateConfig.date_column.trim()
                                        }
                                        className="px-2 py-0.5 bg-green-600/80 text-white rounded text-xs"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingDateConfig(null)}
                                        className="px-2 py-0.5 bg-white/20 text-white rounded text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : row.date_column ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-blue-300">
                                        {row.date_column}
                                      </code>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingDateConfig({
                                            id: row.id,
                                            date_column: row.date_column ?? '',
                                            date_column_type:
                                              row.date_column_type === 'int_1yymmdd' ? 'int_1yymmdd' : 'timestamp',
                                          })
                                        }
                                        className="px-1.5 py-0.5 bg-blue-600/50 text-white rounded text-[10px]"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                    {row.date_column_type === 'int_1yymmdd' && (
                                      <p className="text-xs text-white/40">integer 1YYMMDD format</p>
                                    )}
                                  </div>
                                ) : isRefNoDate ? (
                                  <div className="space-y-0.5">
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white/60 rounded text-xs"
                                      title={row.notes ?? ''}
                                    >
                                      Not applicable
                                    </span>
                                    {row.notes && <p className="text-xs text-white/40 max-w-[200px]">{row.notes}</p>}
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-200 rounded text-xs">
                                      Pending setup
                                    </span>
                                    {row.notes && <p className="text-xs text-white/40 max-w-[200px]">{row.notes}</p>}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingDateConfig({
                                          id: row.id,
                                          date_column: '',
                                          date_column_type: 'timestamp',
                                        })
                                      }
                                      className="text-xs text-blue-300 hover:underline"
                                    >
                                      Set date column
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* Retention days cell */}
                              <td className="px-4 py-3 text-sm">
                                {editingRetention?.id === row.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="1"
                                      value={editingRetention.value}
                                      onChange={(e) =>
                                        setEditingRetention((p) => (p ? { ...p, value: e.target.value } : null))
                                      }
                                      className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                                      placeholder="days"
                                    />
                                    <button
                                      onClick={() => {
                                        const days = parseInt(editingRetention.value, 10)
                                        if (!Number.isNaN(days) && days > 0) {
                                          updateConfigMutation.mutate(
                                            { id: row.id, retention_days: days },
                                            { onSuccess: () => setEditingRetention(null) },
                                          )
                                        }
                                      }}
                                      disabled={updateConfigMutation.isPending}
                                      className="px-2 py-1 bg-green-600/80 hover:bg-green-500 text-white rounded text-xs disabled:opacity-50"
                                    >
                                      {updateConfigMutation.isPending ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => setEditingRetention(null)}
                                      className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {row.date_column || !isRefNoDate ? (
                                      <>
                                        <span className={row.retention_days ? 'text-white' : 'text-white/40 italic'}>
                                          {row.retention_days ? `${row.retention_days} days` : 'Not set'}
                                        </span>
                                        <button
                                          onClick={() =>
                                            setEditingRetention({ id: row.id, value: String(row.retention_days ?? '') })
                                          }
                                          className="px-2 py-0.5 bg-blue-600/60 hover:bg-blue-500 text-white rounded text-xs"
                                          disabled={isRefNoDate}
                                        >
                                          Edit
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-white/30 italic text-xs">N/A</span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Actions cell */}
                              <td className="px-4 py-3 text-sm">
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={async () => {
                                      setHousekeepingRunning((p) => ({ ...p, [row.id]: true }))
                                      setHousekeepingMessages((p) => {
                                        const n = { ...p }
                                        delete n[row.id]
                                        return n
                                      })
                                      try {
                                        const result = await runHousekeepingMutation.mutateAsync({ id: row.id })
                                        setHousekeepingMessages((p) => ({
                                          ...p,
                                          [row.id]: { type: 'success', text: result.message },
                                        }))
                                      } catch (e: any) {
                                        setHousekeepingMessages((p) => ({
                                          ...p,
                                          [row.id]: { type: 'error', text: e?.message ?? 'Error running housekeeping' },
                                        }))
                                      } finally {
                                        setHousekeepingRunning((p) => ({ ...p, [row.id]: false }))
                                      }
                                    }}
                                    disabled={!canRun || housekeepingRunning[row.id]}
                                    className="px-3 py-1 bg-orange-600/80 hover:bg-orange-500 text-white rounded text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                                    title={
                                      !row.date_column
                                        ? 'Configure date column and retention first'
                                        : !row.retention_days
                                          ? 'Set retention days first'
                                          : 'Run housekeeping'
                                    }
                                  >
                                    {housekeepingRunning[row.id] ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                                        Running...
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                          />
                                        </svg>
                                        Run Housekeeping
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          `Remove housekeeping config for ${row.db_name}.${row.table_name}?`,
                                        )
                                      )
                                        return
                                      deleteHousekeepingMutation.mutate({ id: row.id })
                                    }}
                                    disabled={deleteHousekeepingMutation.isPending}
                                    className="px-3 py-1 bg-red-900/50 hover:bg-red-800/60 text-red-200 rounded text-xs disabled:opacity-50"
                                  >
                                    Delete row
                                  </button>
                                  {housekeepingMessages[row.id] && (
                                    <p
                                      className={`text-xs ${housekeepingMessages[row.id].type === 'success' ? 'text-green-300' : 'text-red-300'}`}
                                    >
                                      {housekeepingMessages[row.id].text}
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        },
                      )}
                    </tbody>
                  </table>
                  {(housekeepingData?.data?.length ?? 0) === 0 && (
                    <div className="p-8 text-center text-white/50">
                      No raw tables configured. Run migration to seed from apps, or add a row above.
                    </div>
                  )}
                </div>
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
                  className="w-full px-3 py-2 bg-gray-700 border border-white/20 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="superadmin" className="bg-gray-700 text-white">
                    Superadmin
                  </option>
                  <option value="admin" className="bg-gray-700 text-white">
                    Admin
                  </option>
                  <option value="user" className="bg-gray-700 text-white">
                    User
                  </option>
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
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 bg-gray-700 border border-white/20 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="superadmin" className="bg-gray-700 text-white">
                    Superadmin
                  </option>
                  <option value="admin" className="bg-gray-700 text-white">
                    Admin
                  </option>
                  <option value="user" className="bg-gray-700 text-white">
                    User
                  </option>
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
