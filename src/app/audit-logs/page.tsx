'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

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

export default function AuditLogsPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    username: '',
    start_date: '',
    end_date: '',
  })

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
      fetchAuditLogs()
      fetchStats()
    }
  }, [isAuthenticated, userRole, page, filters])

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '')),
      })

      const response = await fetch(`/api/audit-logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setAuditLogs(data.data)
        setTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLoading(false)
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

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1) // Reset to first page when filter changes
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
              Audit Logs Dashboard
            </h1>
            <p className="text-white/70 text-sm">Monitor semua aktivitas sistem</p>
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

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-white/70 text-sm mb-1">Total Activities</p>
              <p className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</p>
              <p className="text-xs text-white/50 mt-1">Last 30 days</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-white/70 text-sm mb-1">Top Action</p>
              <p className="text-xl font-bold text-white">
                {stats.actionCounts[0]?.action || 'N/A'}
              </p>
              <p className="text-xs text-white/50 mt-1">
                {stats.actionCounts[0]?.count || 0} times
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-white/70 text-sm mb-1">Top Resource</p>
              <p className="text-xl font-bold text-white">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Action Counts Chart */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Top Actions</h3>
              <div className="space-y-3">
                {stats.actionCounts.slice(0, 5).map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white/90">{item.action}</span>
                      <span className="text-white/70">{item.count}</span>
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

            {/* Daily Activity Chart */}
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
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Action</label>
              <input
                type="text"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                placeholder="Filter by action"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Resource Type</label>
              <input
                type="text"
                value={filters.resource_type}
                onChange={(e) => handleFilterChange('resource_type', e.target.value)}
                placeholder="Filter by resource"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Username</label>
              <input
                type="text"
                value={filters.username}
                onChange={(e) => handleFilterChange('username', e.target.value)}
                placeholder="Filter by username"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">End Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
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
          {loading ? (
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
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-white/20 flex justify-between items-center">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-white/70 text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
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
    </main>
  )
}
