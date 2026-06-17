import { createFileRoute } from '@tanstack/react-router'
import { ScrollText } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDayMonth } from '@/lib/i18n-format'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'
import { type AuditLogEntry, type AuditStats, formatDate, useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/audit-logs')({
  ssr: false,
  component: AuditLogsPage,
})

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <p className="truncate text-2xl font-semibold tabular-nums" title={value}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function AuditLogsPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    username: '',
    start_date: '',
    end_date: '',
  })

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

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{m.nav_audit_logs()}</h1>
        <p className="text-sm text-muted-foreground">{m.audit_subtitle()}</p>
      </header>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={m.audit_stat_total_activities()}
            value={stats.total.toLocaleString()}
            hint={m.audit_stat_last_30_days()}
          />
          <StatCard
            label={m.audit_stat_top_action()}
            value={stats.actionCounts[0]?.action || '—'}
            hint={m.audit_stat_times({ count: stats.actionCounts[0]?.count || 0 })}
          />
          <StatCard
            label={m.audit_stat_top_resource()}
            value={stats.resourceTypeCounts[0]?.resource_type || '—'}
            hint={m.audit_stat_times({ count: stats.resourceTypeCounts[0]?.count || 0 })}
          />
          <StatCard
            label={m.audit_stat_most_active_user()}
            value={stats.topUsers[0]?.username || '—'}
            hint={m.audit_stat_activities_count({ count: stats.topUsers[0]?.count || 0 })}
          />
        </div>
      )}

      {stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">{m.audit_top_actions_title()}</CardTitle>
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
              <CardTitle className="text-base font-medium">{m.audit_daily_activity_title()}</CardTitle>
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
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                          {formatDayMonth(item.date)}
                        </p>
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
          <Label className="text-xs">{m.audit_filter_action()}</Label>
          <Input
            value={filters.action}
            onChange={(e) => setFilter('action', e.target.value)}
            placeholder={m.audit_filter_action_ph()}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{m.audit_filter_resource_type()}</Label>
          <Input
            value={filters.resource_type}
            onChange={(e) => setFilter('resource_type', e.target.value)}
            placeholder={m.audit_filter_resource_ph()}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{m.common_username()}</Label>
          <Input
            value={filters.username}
            onChange={(e) => setFilter('username', e.target.value)}
            placeholder={m.audit_filter_username_ph()}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{m.audit_filter_start_date()}</Label>
          <Input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilter('start_date', e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{m.audit_filter_end_date()}</Label>
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
                <EmptyTitle>{m.audit_empty_title()}</EmptyTitle>
                <EmptyDescription>{m.audit_empty_desc()}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.common_date()}</TableHead>
                  <TableHead>{m.audit_col_user()}</TableHead>
                  <TableHead>{m.audit_filter_action()}</TableHead>
                  <TableHead>{m.audit_col_resource()}</TableHead>
                  <TableHead className="hidden lg:table-cell">{m.audit_col_details()}</TableHead>
                  <TableHead className="hidden md:table-cell">{m.audit_col_ip()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">{log.username || m.audit_system_user()}</TableCell>
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
            {m.common_previous()}
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {m.pagination_page({ page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            {m.common_next()}
          </Button>
        </div>
      )}
    </div>
  )
}
