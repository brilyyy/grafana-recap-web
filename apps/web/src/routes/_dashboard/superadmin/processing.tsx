import { createFileRoute } from '@tanstack/react-router'
import { CircleDashed, ListChecks, Loader2, RefreshCw, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMonthName, formatMonthYear, localeTag } from '@/lib/i18n-format'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'
import { useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/processing')({
  ssr: false,
  component: ProcessingPage,
})

interface ProcessingLog {
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
}

function getAllDatesInMonth(month: number, year: number): string[] {
  const dates: string[] = []
  const lastDay = new Date(year, month, 0).getDate()
  for (let day = 1; day <= lastDay; day++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  return dates
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-1 py-3">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: ProcessingLog['status'] | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {m.proc_status_not_processed_badge()}
      </Badge>
    )
  }
  return (
    <Badge variant={status === 'success' ? 'secondary' : status === 'failed' ? 'destructive' : 'outline'}>
      {status}
    </Badge>
  )
}

function ProcessingPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const now = new Date()
  const [catalogEntryId, setCatalogEntryId] = useState('')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [jobSearch, setJobSearch] = useState('')
  const [processingDates, setProcessingDates] = useState<Record<string, boolean>>({})
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const cancelBatchRef = useRef(false)

  const catalogQuery = trpc.recap.listCatalog.useQuery(undefined, { enabled: isSuperadmin })
  const catalogEntries = catalogQuery.data?.data ?? []

  useEffect(() => {
    if (!catalogEntries.length) return
    if (!catalogEntryId || !catalogEntries.some((entry) => entry.id === catalogEntryId)) {
      setCatalogEntryId(catalogEntries[0].id)
    }
  }, [catalogEntries, catalogEntryId])

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when the data scope changes
  useEffect(() => {
    setSelectedDates(new Set())
  }, [catalogEntryId, month, year])

  const logsQuery = trpc.processingLogs.byMonth.useQuery(
    { catalogEntryId, month, year },
    { enabled: isSuperadmin && !!catalogEntryId },
  )
  const processingLogs = (logsQuery.data?.data ?? []) as ProcessingLog[]
  const logsByDate = Object.fromEntries(processingLogs.map((log) => [log.processing_date, log]))

  const triggerMutation = trpc.recap.triggerManual.useMutation()

  const jobSearchTerm = jobSearch.trim().toLowerCase()
  const filteredEntries = catalogEntries.filter((entry) => {
    if (!jobSearchTerm) return true
    return (
      entry.title.toLowerCase().includes(jobSearchTerm) ||
      entry.id.toLowerCase().includes(jobSearchTerm) ||
      entry.outputTable.toLowerCase().includes(jobSearchTerm)
    )
  })
  const selectedJob = catalogEntries.find((entry) => entry.id === catalogEntryId)

  const allDates = getAllDatesInMonth(month, year)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const processableDates = allDates.filter((d) => new Date(`${d}T00:00:00`) < today)

  const isBatchRunning = batchProgress !== null
  const allSelected = processableDates.length > 0 && selectedDates.size === processableDates.length

  const toggleDate = (date: string, checked: boolean) => {
    setSelectedDates((prev) => {
      const next = new Set(prev)
      if (checked) next.add(date)
      else next.delete(date)
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelectedDates(checked ? new Set(processableDates) : new Set())
  }

  const handleDateProcessing = async (date: string) => {
    if (!catalogEntryId) {
      toast.error(m.proc_toast_select_job_first())
      return
    }
    setProcessingDates((prev) => ({ ...prev, [date]: true }))
    try {
      const res = await triggerMutation.mutateAsync({ catalogEntryId, date })
      const logEntry = res.data?.logEntry
      if (logEntry?.status === 'failed') {
        toast.error(m.proc_toast_process_failed({ date, error: logEntry.errorMessage || m.proc_unknown_error() }))
      } else if (logEntry?.status === 'success') {
        toast.success(
          m.proc_toast_process_success({
            date,
            processed: logEntry.recordsProcessed || 0,
            inserted: logEntry.recordsInserted || 0,
          }),
        )
      } else {
        toast.success(m.proc_toast_process_triggered({ date }))
      }
      // Small delay so the stored procedure finishes writing before refresh
      await new Promise((resolve) => setTimeout(resolve, 500))
      await logsQuery.refetch()
    } catch (error) {
      toast.error(m.proc_toast_process_error({ error: error instanceof Error ? error.message : String(error) }))
    } finally {
      setProcessingDates((prev) => ({ ...prev, [date]: false }))
    }
  }

  const runBatch = async (dates: string[]) => {
    if (!catalogEntryId || dates.length === 0) return
    const sorted = [...dates].sort()
    cancelBatchRef.current = false
    setBatchProgress({ current: 0, total: sorted.length })
    let succeeded = 0
    let failed = 0
    for (let i = 0; i < sorted.length; i++) {
      if (cancelBatchRef.current) break
      const date = sorted[i]
      setBatchProgress({ current: i + 1, total: sorted.length })
      setProcessingDates((prev) => ({ ...prev, [date]: true }))
      try {
        const res = await triggerMutation.mutateAsync({ catalogEntryId, date })
        if (res.data?.logEntry?.status === 'failed') failed++
        else succeeded++
      } catch {
        failed++
      } finally {
        setProcessingDates((prev) => ({ ...prev, [date]: false }))
      }
    }
    const skipped = sorted.length - succeeded - failed
    setBatchProgress(null)
    setSelectedDates(new Set())
    if (skipped > 0) {
      toast.info(m.proc_toast_batch_cancelled({ succeeded, failed, skipped }))
    } else if (failed > 0) {
      toast.error(m.proc_toast_batch_failed({ succeeded, failed }))
    } else {
      toast.success(m.proc_toast_batch_success({ succeeded }))
    }
    // Small delay so the stored procedure finishes writing before refresh
    await new Promise((resolve) => setTimeout(resolve, 500))
    await logsQuery.refetch()
  }

  const summary = {
    total: allDates.length,
    success: allDates.filter((d) => logsByDate[d]?.status === 'success').length,
    failed: allDates.filter((d) => logsByDate[d]?.status === 'failed').length,
    running: allDates.filter((d) => logsByDate[d]?.status === 'running').length,
    notProcessed: allDates.filter((d) => !logsByDate[d]).length,
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{m.proc_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.proc_subtitle()}</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{m.proc_month_label()}</Label>
          <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((monthNum) => (
                <SelectItem key={monthNum} value={String(monthNum)}>
                  {formatMonthName(monthNum)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{m.proc_year_label()}</Label>
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => now.getFullYear() - i).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <Label className="text-xs">{m.proc_search_job_label()}</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              placeholder={m.proc_search_job_ph()}
              className="h-8 pl-8"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-4">
          <Label className="text-xs">{m.proc_job_label()}</Label>
          {catalogQuery.isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <Select value={catalogEntryId} onValueChange={setCatalogEntryId} disabled={isBatchRunning}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder={m.proc_select_job_ph()} />
              </SelectTrigger>
              <SelectContent>
                {filteredEntries.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.title} ({entry.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedJob && (
            <p className="text-xs text-muted-foreground">
              {m.proc_output_label()} <span className="font-mono">{selectedJob.outputTable}</span>
              {' · '}
              {m.proc_function_label()} <span className="font-mono">{selectedJob.functionName}</span>
            </p>
          )}
        </div>
      </div>

      {!catalogEntryId ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleDashed />
            </EmptyMedia>
            <EmptyTitle>{m.proc_empty_no_job_title()}</EmptyTitle>
            <EmptyDescription>{m.proc_empty_no_job_desc()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {logsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatTile label={m.proc_stat_success()} value={summary.success} />
              <StatTile label={m.proc_stat_failed()} value={summary.failed} />
              <StatTile label={m.proc_stat_running()} value={summary.running} />
              <StatTile label={m.proc_stat_not_processed()} value={summary.notProcessed} />
              <StatTile label={m.proc_stat_total_days()} value={summary.total} />
            </div>
          )}

          <Card>
            <CardHeader className="flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-base font-medium">{formatMonthYear(new Date(year, month - 1, 1))}</p>
              <div className="flex flex-wrap items-center gap-2">
                {isBatchRunning ? (
                  <>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      {m.proc_processing_progress({ current: batchProgress.current, total: batchProgress.total })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        cancelBatchRef.current = true
                      }}
                    >
                      <X className="size-3.5" />
                      {m.common_cancel()}
                    </Button>
                  </>
                ) : (
                  <>
                    {selectedDates.size > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setSelectedDates(new Set())}
                      >
                        {m.proc_clear_selection()}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedDates.size === 0 || logsQuery.isLoading}
                      onClick={() => runBatch([...selectedDates])}
                    >
                      <ListChecks className="size-3.5" />
                      {m.proc_process_selected({ count: selectedDates.size })}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={processableDates.length === 0 || logsQuery.isLoading}
                      onClick={() => runBatch(processableDates)}
                    >
                      <RefreshCw className="size-3.5" />
                      {m.proc_process_all({ count: processableDates.length })}
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {logsQuery.isLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 8 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected ? true : selectedDates.size > 0 ? 'indeterminate' : false}
                          onCheckedChange={(checked) => toggleAll(checked === true)}
                          disabled={isBatchRunning || processableDates.length === 0}
                          aria-label={m.proc_select_all_dates()}
                        />
                      </TableHead>
                      <TableHead>{m.proc_col_date()}</TableHead>
                      <TableHead>{m.proc_col_status()}</TableHead>
                      <TableHead className="text-right">{m.proc_col_processed()}</TableHead>
                      <TableHead className="text-right">{m.proc_col_inserted()}</TableHead>
                      <TableHead>{m.proc_col_processed_at()}</TableHead>
                      <TableHead>{m.proc_col_error()}</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allDates.map((dateStr) => {
                      const log = logsByDate[dateStr]
                      const canProcess = new Date(`${dateStr}T00:00:00`) < today
                      const isToday = dateStr === todayStr
                      const isSelected = selectedDates.has(dateStr)
                      const isProcessing = !!processingDates[dateStr]
                      const processedAt = log?.end_time ?? log?.start_time ?? null
                      return (
                        <TableRow
                          key={dateStr}
                          data-state={isSelected ? 'selected' : undefined}
                          className={cn(!canProcess && 'opacity-50')}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => toggleDate(dateStr, checked === true)}
                              disabled={!canProcess || isBatchRunning}
                              aria-label={m.proc_select_date({ date: dateStr })}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="tabular-nums">
                              {new Date(`${dateStr}T00:00:00`).toLocaleDateString(localeTag(), {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            {isToday && (
                              <Badge variant="outline" className="ml-2">
                                {m.proc_today_badge()}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={log?.status ?? null} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {log ? log.records_processed || 0 : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {log ? log.records_inserted || 0 : '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {processedAt
                              ? new Date(processedAt).toLocaleString(localeTag(), {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </TableCell>
                          <TableCell className="max-w-56">
                            {log?.error_message ? (
                              <span className="block truncate text-destructive" title={log.error_message}>
                                {log.error_message}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {canProcess && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                onClick={() => handleDateProcessing(dateStr)}
                                disabled={isProcessing || isBatchRunning}
                              >
                                {isProcessing ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="size-3" />
                                )}
                                {m.proc_process_button()}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
