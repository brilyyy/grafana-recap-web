import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Home, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import LogoutButton from '@/components/logout-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { trpc } from '@/router'

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

export const Route = createFileRoute('/audit-logs')({
  ssr: false,
  component: AuditLogsPage,
})

function AuditLogsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    username: '',
    start_date: '',
    end_date: '',
  })

  const { data: authCheck, isLoading: authLoading } = trpc.auth.check.useQuery(undefined, { retry: false })
  const isAuthenticated = authCheck?.data?.authenticated ?? null
  const userRole = (authCheck?.data as any)?.user?.role ?? null

  const { data: logsData, isLoading: loading } = trpc.auditLogs.list.useQuery(
    {
      page,
      limit: 50,
      action: filters.action || undefined,
      startDate: filters.start_date || undefined,
      endDate: filters.end_date || undefined,
    },
    { enabled: !!isAuthenticated && userRole === 'superadmin' },
  )
  const { data: statsData } = trpc.auditLogs.stats.useQuery(
    { days: 30 },
    { enabled: !!isAuthenticated && userRole === 'superadmin' },
  )

  const auditLogs: AuditLogEntry[] = (logsData?.data?.logs ?? []) as AuditLogEntry[]
  const totalPages = Math.ceil(((logsData?.data?.total ?? 0) as number) / 50)
  const stats = (statsData?.data ?? null) as AuditStats | null

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) navigate({ to: '/login', replace: true })
      else if (userRole && userRole !== 'superadmin') navigate({ to: '/', replace: true })
    }
  }, [isAuthenticated, userRole, authLoading, navigate])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
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

  if (authLoading || isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || userRole !== 'superadmin') {
    return null
  }

  return (
    <main className="min-h-screen p-4 md:p-6 animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 animate-in fade-in duration-300">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold mb-1 bg-clip-text text-transparent bg-linear-to-r from-white via-blue-200 to-red-200">
              Audit Logs Dashboard
            </h1>
            <p className="text-white/60 text-sm">Monitor semua aktivitas sistem</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate({ to: '/' })}
              className="bg-gray-700/80 hover:bg-gray-600/80 text-white border-white/10"
            >
              <Home className="w-4 h-4" />
              Back to Dashboard
            </Button>
            <LogoutButton />
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-in fade-in duration-300">
            {[
              { label: 'Total Activities', value: stats.total.toLocaleString(), sub: 'Last 30 days' },
              {
                label: 'Top Action',
                value: stats.actionCounts[0]?.action || 'N/A',
                sub: `${stats.actionCounts[0]?.count || 0} times`,
              },
              {
                label: 'Top Resource',
                value: stats.resourceTypeCounts[0]?.resource_type || 'N/A',
                sub: `${stats.resourceTypeCounts[0]?.count || 0} times`,
              },
              {
                label: 'Most Active User',
                value: stats.topUsers[0]?.username || 'N/A',
                sub: `${stats.topUsers[0]?.count || 0} activities`,
              },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <p className="text-white/60 text-sm mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white truncate">{stat.value}</p>
                <p className="text-xs text-white/40 mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Top Actions</h3>
              <div className="space-y-3">
                {stats.actionCounts.slice(0, 5).map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white/80">{item.action}</span>
                      <span className="text-white/60">{item.count}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-linear-to-r from-blue-500 to-blue-400 h-2 rounded-full"
                        style={{ width: `${(item.count / (stats.actionCounts[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
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
                          />
                        </div>
                        <p className="text-xs text-white/60 mt-2 text-center">
                          {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-xs text-white/40">{item.count}</p>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6 border border-white/20">
          <h3 className="text-base font-semibold text-white mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { key: 'action', label: 'Action', type: 'text', placeholder: 'Filter by action' },
              { key: 'resource_type', label: 'Resource Type', type: 'text', placeholder: 'Filter by resource' },
              { key: 'username', label: 'Username', type: 'text', placeholder: 'Filter by username' },
              { key: 'start_date', label: 'Start Date', type: 'date', placeholder: '' },
              { key: 'end_date', label: 'End Date', type: 'date', placeholder: '' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label className="text-white/70 text-sm">{label}</Label>
                <Input
                  type={type}
                  value={filters[key as keyof typeof filters]}
                  onChange={(e) => handleFilterChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-blue-500/50"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
          <div className="p-4 border-b border-white/20">
            <h3 className="text-base font-semibold text-white">Audit Logs</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-2" />
              <p className="text-white/60">Loading...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-white/60">No audit logs found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/60">Date</TableHead>
                      <TableHead className="text-white/60">User</TableHead>
                      <TableHead className="text-white/60">Action</TableHead>
                      <TableHead className="text-white/60">Resource</TableHead>
                      <TableHead className="text-white/60">Details</TableHead>
                      <TableHead className="text-white/60">IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-white/80 text-sm">{formatDate(log.created_at)}</TableCell>
                        <TableCell className="text-white/80 text-sm">{log.username || 'System'}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-blue-500/20 text-blue-300 border-blue-400/20 text-xs"
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white/80 text-sm">
                          {log.resource_type}
                          {log.resource_id && ` #${log.resource_id}`}
                        </TableCell>
                        <TableCell className="text-white/60 text-sm max-w-xs truncate">{log.details || '-'}</TableCell>
                        <TableCell className="text-white/60 text-sm">{log.ip_address || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="p-4 border-t border-white/20 flex justify-between items-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="bg-white/10 hover:bg-white/20 text-white border-0 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-white/60 text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="bg-white/10 hover:bg-white/20 text-white border-0 disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
