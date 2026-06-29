import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ScrollText } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSuperadminGuard } from '@/hooks/use-superadmin-guard'
import { formatDayMonth } from '@/lib/i18n-format'
import { formatDate } from '@/lib/superadmin-utils'
import { cn } from '@/lib/utils'
import { trpc } from '@/router'
import type { AuditLogEntry, AuditStats } from '@/types/superadmin'

export const Route = createFileRoute('/_dashboard/superadmin/audit-logs')({
  ssr: false,
  component: AuditLogsPage,
})

type SortDir = 'asc' | 'desc'
type SortState = { key: string; dir: SortDir } | null

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sortKey: string
  sort: SortState
  onSort: (key: string) => void
  className?: string
}) {
  const active = sort?.key === sortKey
  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:text-foreground', className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-xs">{sort?.dir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </TableHead>
  )
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <p className={cn('truncate text-2xl font-semibold tabular-nums', accent)} title={value}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function AuditLogsPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const navigate = useNavigate()
  const searchParams = Route.useSearch() as Record<string, unknown>

  const [page, setPage] = useState(Number(searchParams.page) || 1)
  const [filters, setFilters] = useState({
    action: (searchParams.action as string) || '',
    resource_type: (searchParams.resource_type as string) || '',
    username: (searchParams.username as string) || '',
    start_date: (searchParams.start_date as string) || '',
    end_date: (searchParams.end_date as string) || '',
  })
  const [sort, setSort] = useState<SortState>(null)

  // Sync state to URL
  useEffect(() => {
    const params: Record<string, unknown> = {}
    if (page !== 1) params.page = page
    if (filters.action) params.action = filters.action
    if (filters.resource_type) params.resource_type = filters.resource_type
    if (filters.username) params.username = filters.username
    if (filters.start_date) params.start_date = filters.start_date
    if (filters.end_date) params.end_date = filters.end_date
    navigate({ search: params, replace: true })
  }, [page, filters, navigate])

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const logsQuery = trpc.auditLogs.list.useQuery(
    {
      page,
      limit: 50,
      action: filters.action || undefined,
      resourceType: filters.resource_type || undefined,
      username: filters.username || undefined,
      startDate: filters.start_date || undefined,
      endDate: filters.end_date || undefined,
    },
    { enabled: isSuperadmin },
  )
  const statsQuery = trpc.auditLogs.stats.useQuery({ days: 30 }, { enabled: isSuperadmin })

  const logs = (logsQuery.data?.data?.logs ?? []) as AuditLogEntry[]
  const totalPages = logsQuery.data?.data?.totalPages ?? 1
  const stats = statsQuery.data?.data as AuditStats | undefined

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const sortedLogs = useMemo(() => {
    if (!sort) return logs
    const sorted = [...logs].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sort.key] ?? '').toLowerCase()
      const bv = String((b as Record<string, unknown>)[sort.key] ?? '').toLowerCase()
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return sorted
  }, [logs, sort])

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{'Audit logs'}</h1>
        <p className="text-sm text-muted-foreground">{'System activity across users and resources.'}</p>
      </header>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={'Total activities'}
            value={stats.total.toLocaleString()}
            hint={'Last 30 days'}
            accent="text-chart-1"
          />
          <StatCard
            label={'Top action'}
            value={stats.actionCounts[0]?.action || '—'}
            hint={`${stats.actionCounts[0]?.count || 0} times`}
            accent="text-chart-2"
          />
          <StatCard
            label={'Top resource'}
            value={stats.resourceTypeCounts[0]?.resource_type || '—'}
            hint={`${stats.resourceTypeCounts[0]?.count || 0} times`}
            accent="text-chart-3"
          />
          <StatCard
            label={'Most active user'}
            value={stats.topUsers[0]?.username || '—'}
            hint={`${stats.topUsers[0]?.count || 0} activities`}
            accent="text-chart-4"
          />
        </div>
      )}

      {stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">{'Top actions'}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {stats.actionCounts.slice(0, 5).map((item) => (
                <div key={item.action}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{item.action}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{item.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(item.count / (stats.actionCounts[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">{'Daily activity (last 7 days)'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-end justify-between gap-2">
                {stats.dailyActivity
                  .slice(0, 7)
                  .reverse()
                  .map((item) => {
                    const maxCount = Math.max(...stats.dailyActivity.map((d) => d.count), 1)
                    const height = (item.count / maxCount) * 100
                    return (
                      <div key={item.date} className="flex flex-1 flex-col items-center">
                        <div className="flex h-full w-full flex-col items-center justify-end">
                          <div
                            className="w-full rounded-t bg-primary"
                            style={{ height: `${height}%`, minHeight: '4px' }}
                          />
                        </div>
                        <p className="mt-2 text-center text-xs text-muted-foreground">{formatDayMonth(item.date)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{item.count}</p>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{'Action'}</Label>
          <Input
            value={filters.action}
            onChange={(e) => setFilter('action', e.target.value)}
            placeholder={'Filter by action'}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{'Resource type'}</Label>
          <Input
            value={filters.resource_type}
            onChange={(e) => setFilter('resource_type', e.target.value)}
            placeholder={'Filter by resource'}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{'Username'}</Label>
          <Input
            value={filters.username}
            onChange={(e) => setFilter('username', e.target.value)}
            placeholder={'Filter by username'}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{'Start date'}</Label>
          <Input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilter('start_date', e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{'End date'}</Label>
          <Input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilter('end_date', e.target.value)}
            className="h-8"
          />
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {logsQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 8 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ScrollText />
                </EmptyMedia>
                <EmptyTitle>{'No audit logs found'}</EmptyTitle>
                <EmptyDescription>{'Adjust the filters to broaden the search.'}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="Date" sortKey="created_at" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="User" sortKey="username" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Action" sortKey="action" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Resource" sortKey="resource_type" sort={sort} onSort={toggleSort} />
                  <SortableHeader
                    label="Details"
                    sortKey="details"
                    sort={sort}
                    onSort={toggleSort}
                    className="hidden lg:table-cell"
                  />
                  <SortableHeader
                    label="IP address"
                    sortKey="ip_address"
                    sort={sort}
                    onSort={toggleSort}
                    className="hidden md:table-cell"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">{log.username || 'System'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.action}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.resource_type}
                      {log.resource_id && (
                        <span className="font-mono text-xs text-muted-foreground"> #{log.resource_id}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-md truncate text-muted-foreground lg:table-cell">
                      {log.details || '—'}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {log.ip_address || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            {'Previous'}
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">{`Page ${page} of ${totalPages}`}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            {'Next'}
          </Button>
        </div>
      )}
    </div>
  )
}
