import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Check,
  ChevronsUpDown,
  CircleDashed,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Timer,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { CronDescription } from '@/components/cron-description'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSuperadminGuard } from '@/hooks/use-superadmin-guard'
import { formatDateTime, formatMonthName, formatMonthYear } from '@/lib/i18n-format'
import { cn } from '@/lib/utils'
import { trpc } from '@/router'

export const Route = createFileRoute('/_dashboard/superadmin/jobs')({
  ssr: false,
  component: JobsPage,
})

const subTabDescriptions: Record<string, string> = {
  overview: 'Job details, representative query, and manual trigger.',
  processing: 'View processing logs and trigger manual runs for past dates.',
  schedule: 'Manage cron schedules and view worker status.',
}

/* ───── Main page ───── */

function JobsPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const navigate = useNavigate()
  const search = Route.useSearch() as Record<string, unknown>
  const activeSubTab = (search.subTab as string) || 'overview'
  const selectedJobId = search.selectedJobId as string | undefined

  const catalogQuery = trpc.recap.listCatalog.useQuery(undefined, { enabled: isSuperadmin })
  const catalogEntries = catalogQuery.data?.data ?? []

  const selectedJob = catalogEntries.find((e) => e.id === selectedJobId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{'Jobs'}</h1>
        <p className="text-sm text-muted-foreground">{subTabDescriptions[activeSubTab]}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit self-start">
          <CardContent className="p-4">
            <JobListPanel
              catalogEntries={catalogEntries}
              selectedJobId={selectedJobId}
              isLoading={catalogQuery.isLoading}
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          {catalogQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-6">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !selectedJob ? (
            <div className="p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CircleDashed />
                  </EmptyMedia>
                  <EmptyTitle>{'Select a job'}</EmptyTitle>
                  <EmptyDescription>{'Choose a job from the list to view details.'}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <Tabs
              value={activeSubTab}
              onValueChange={(tab) =>
                navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, subTab: tab }) })
              }
            >
              <TabsList variant="line" className="w-full justify-start px-6">
                <TabsTrigger value="overview">{'Overview'}</TabsTrigger>
                <TabsTrigger value="processing">{'Processing'}</TabsTrigger>
                <TabsTrigger value="schedule">{'Schedule'}</TabsTrigger>
              </TabsList>
              <div className="p-6">
                <TabsContent value="overview" className="mt-0">
                  <OverviewTab catalogEntry={selectedJob} />
                </TabsContent>
                <TabsContent value="processing" className="mt-0">
                  <ProcessingTab
                    catalogEntryId={selectedJob.id}
                    isSuperadmin={isSuperadmin}
                    selectedJob={selectedJob}
                  />
                </TabsContent>
                <TabsContent value="schedule" className="mt-0">
                  <ScheduleTab catalogEntry={selectedJob} isSuperadmin={isSuperadmin} />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ───── Left panel: job list ───── */

function JobListPanel({
  catalogEntries,
  selectedJobId,
  isLoading,
}: {
  catalogEntries: Array<{ id: string; title: string; recapKind: string; outputTable: string; existsInDb: boolean }>
  selectedJobId: string | undefined
  isLoading: boolean
}) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  const term = searchTerm.trim().toLowerCase()
  const filtered = catalogEntries.filter((e) => {
    if (!term) return true
    return (
      e.title.toLowerCase().includes(term) ||
      e.id.toLowerCase().includes(term) ||
      e.outputTable.toLowerCase().includes(term)
    )
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() =>
          navigate({
            search: (prev: Record<string, unknown>) => ({ ...prev, subTab: 'schedule', showAddForm: '1' }),
          })
        }
      >
        <Plus />
        {'Add job'}
      </Button>

      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={'Search jobs...'}
          className="h-8 pl-8"
        />
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{'No matching jobs'}</p>
        ) : (
          filtered.map((entry, idx) => {
            const chartBorders = [
              'border-l-chart-1',
              'border-l-chart-2',
              'border-l-chart-3',
              'border-l-chart-4',
              'border-l-chart-5',
            ]
            const isSelected = entry.id === selectedJobId
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() =>
                  navigate({
                    search: (prev: Record<string, unknown>) => ({
                      ...prev,
                      selectedJobId: entry.id,
                      subTab: 'overview',
                    }),
                  })
                }
                className={cn(
                  'flex w-full items-start gap-2 rounded-lg border p-3 text-left transition-colors border-l-2',
                  isSelected && 'border-primary bg-accent ring-1 ring-primary/20',
                  !isSelected && `${chartBorders[idx % 5]} border-transparent hover:bg-muted`,
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{entry.title}</span>
                    {entry.existsInDb === false && (
                      <Badge variant="destructive" className="shrink-0 text-[10px]">
                        {'Not deployed'}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entry.recapKind}
                    {' · '}
                    <span className="font-mono">{entry.outputTable}</span>
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

/* ───── Overview tab ───── */

function OverviewTab({
  catalogEntry,
}: {
  catalogEntry: {
    id: string
    title: string
    description: string
    briefProcessSummary: string
    functionName: string
    rawSqlRepoPath: string
    briefQuery: string
  }
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm">{catalogEntry.description}</p>
        {catalogEntry.briefProcessSummary && (
          <p className="mt-2 text-xs text-muted-foreground">{catalogEntry.briefProcessSummary}</p>
        )}
      </div>

      <div className="space-y-1 rounded-lg border border-primary/20 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{'Function:'}</span>{' '}
          <code className="font-mono text-xs">{catalogEntry.functionName}</code>
        </p>
        <p>
          <span className="text-muted-foreground">{'Doc:'}</span>{' '}
          <code className="font-mono text-xs">{catalogEntry.rawSqlRepoPath}</code>
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">{'Representative query'}</p>
        <pre className="overflow-x-auto rounded-md border bg-background p-3 font-mono text-xs whitespace-pre-wrap">
          {catalogEntry.briefQuery}
        </pre>
      </div>
    </div>
  )
}

/* ───── Processing tab ───── */

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

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card className="gap-1 py-3">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <p className={cn('text-xl font-semibold tabular-nums', accent)}>{value}</p>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: ProcessingLog['status'] | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {'not processed'}
      </Badge>
    )
  }
  switch (status) {
    case 'success':
      return (
        <Badge variant="outline" className="border-chart-2/40 bg-chart-2/10 text-chart-2">
          success
        </Badge>
      )
    case 'running':
      return (
        <Badge variant="outline" className="border-chart-1/40 bg-chart-1/10 text-chart-1">
          running
        </Badge>
      )
    case 'failed':
      return <Badge variant="destructive">failed</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function ProcessingTab({
  catalogEntryId,
  isSuperadmin,
  selectedJob,
}: {
  catalogEntryId: string
  isSuperadmin: boolean
  selectedJob: { outputTable: string; functionName: string }
}) {
  const navigate = useNavigate()
  const search = Route.useSearch() as Record<string, unknown>
  const now = new Date()
  const month = Number(search.month) || now.getMonth() + 1
  const year = Number(search.year) || now.getFullYear()

  const [processingDates, setProcessingDates] = useState<Record<string, boolean>>({})
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const cancelBatchRef = useRef(false)

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
    if (!catalogEntryId) return
    setProcessingDates((prev) => ({ ...prev, [date]: true }))
    try {
      const res = await triggerMutation.mutateAsync({ catalogEntryId, date })
      const logEntry = res.data?.logEntry
      if (logEntry?.status === 'failed') {
        toast.error(`Processing failed for ${date}: ${logEntry.errorMessage || 'Unknown error'}`)
      } else if (logEntry?.status === 'success') {
        toast.success(
          `Processed ${date}: ${logEntry.recordsProcessed || 0} records (${logEntry.recordsInserted || 0} inserted)`,
        )
      } else {
        toast.success(`Processing triggered for ${date}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      await logsQuery.refetch()
    } catch (error) {
      toast.error(`Error triggering processing: ${error instanceof Error ? error.message : String(error)}`)
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
      toast.info(`Batch cancelled: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`)
    } else if (failed > 0) {
      toast.error(`Batch finished: ${succeeded} succeeded, ${failed} failed`)
    } else {
      toast.success(`Batch finished: ${succeeded} succeeded`)
    }
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs">{'Month'}</Label>
          <Select
            value={String(month)}
            onValueChange={(v) =>
              navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, month: Number(v) }) })
            }
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {formatMonthName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">{'Year'}</Label>
          <Select
            value={String(year)}
            onValueChange={(v) =>
              navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, year: Number(v) }) })
            }
          >
            <SelectTrigger size="sm" className="w-24">
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
        <p className="text-xs text-muted-foreground">
          {'Output:'} <span className="font-mono">{selectedJob.outputTable}</span>
          {' · '}
          {'Function:'} <span className="font-mono">{selectedJob.functionName}</span>
        </p>
      </div>

      {logsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label={'Success'} value={summary.success} accent="text-chart-2" />
          <StatTile label={'Failed'} value={summary.failed} accent="text-destructive" />
          <StatTile label={'Running'} value={summary.running} accent="text-chart-1" />
          <StatTile label={'Not processed'} value={summary.notProcessed} accent="text-chart-3" />
          <StatTile label={'Total days'} value={summary.total} accent="text-chart-4" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{formatMonthYear(new Date(year, month - 1, 1))}</p>
        <div className="flex items-center gap-2">
          {isBatchRunning ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {`Processing ${batchProgress.current}/${batchProgress.total}…`}
              </span>
              <Button variant="outline" size="sm" onClick={() => (cancelBatchRef.current = true)}>
                <X className="size-3.5" />
                {'Cancel'}
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
                  {'Clear selection'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={selectedDates.size === 0 || logsQuery.isLoading}
                onClick={() => runBatch([...selectedDates])}
              >
                <ListChecks className="size-3.5" />
                {`Process selected (${selectedDates.size})`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={processableDates.length === 0 || logsQuery.isLoading}
                onClick={() => runBatch(processableDates)}
              >
                <RefreshCw className="size-3.5" />
                {`Process all (${processableDates.length})`}
              </Button>
            </>
          )}
        </div>
      </div>

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
                  aria-label={'Select all processable dates'}
                />
              </TableHead>
              <TableHead>{'Date'}</TableHead>
              <TableHead>{'Status'}</TableHead>
              <TableHead className="text-right">{'Processed'}</TableHead>
              <TableHead className="text-right">{'Inserted'}</TableHead>
              <TableHead>{'Processed at'}</TableHead>
              <TableHead>{'Error'}</TableHead>
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
                      aria-label={`Select ${dateStr}`}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="tabular-nums">
                      {new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    {isToday && (
                      <Badge variant="outline" className="ml-2">
                        {'today'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={log?.status ?? null} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{log ? log.records_processed || 0 : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{log ? log.records_inserted || 0 : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {processedAt
                      ? new Date(processedAt).toLocaleString('en-US', {
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
                        {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                        {'Process'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

/* ───── Schedule tab ───── */

type JobFormValues = { name: string; procedure: string; schedule: string; timezone: string }

interface SchedulerJobRow {
  id: number
  name: string
  procedure: string
  schedule: string
  timezone: string | null
  enabled: boolean
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

function ScheduleTab({
  catalogEntry,
  isSuperadmin,
}: {
  catalogEntry: { id: string; functionName: string }
  isSuperadmin: boolean
}) {
  const navigate = useNavigate()
  const scheduleSearch = Route.useSearch() as Record<string, unknown>
  const [showAddForm, setShowAddForm] = useState(scheduleSearch.showAddForm === '1')

  useEffect(() => {
    if (scheduleSearch.showAddForm === '1') {
      navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, showAddForm: undefined }) })
    }
  }, [])

  const jobsQuery = trpc.scheduler.listJobs.useQuery(undefined, { enabled: isSuperadmin })
  const rows = (jobsQuery.data?.data ?? []) as SchedulerJobRow[]

  const procQuery = trpc.appProcedures.listAll.useQuery(undefined, { enabled: isSuperadmin })
  const registeredProcedures = (procQuery.data?.data?.procedures ?? []) as {
    function_name: string
    app_name: string
  }[]
  const unregQuery = trpc.appProcedures.listUnregistered.useQuery(undefined, { enabled: isSuperadmin })
  const unregisteredProcedures = (unregQuery.data?.data?.procedures ?? []) as { function_name: string }[]
  const [procedurePickerOpen, setProcedurePickerOpen] = useState(false)

  const statusQuery = trpc.scheduler.workerStatus.useQuery(undefined, {
    enabled: isSuperadmin,
    refetchInterval: 10000,
  })
  const workerData = statusQuery.data?.data

  const matchedJob = rows.find((j) => j.procedure === catalogEntry.functionName)

  const jobSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, 'Name is required'),
        procedure: z.string().trim().min(1, 'Procedure is required'),
        schedule: z.string().trim().min(1, 'Schedule is required'),
        timezone: z.string().trim().min(1, 'Timezone is required'),
      }),
    [],
  )

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: { name: '', procedure: catalogEntry.functionName, schedule: '1 0 * * *', timezone: 'Asia/Jakarta' },
  })

  const createMutation = trpc.scheduler.createJob.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || 'Job created')
      form.reset()
      setShowAddForm(false)
      jobsQuery.refetch()
    },
    onError: (error) => toast.error(error.message || "Couldn't create the job"),
  })

  const updateMutation = trpc.scheduler.updateJob.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || 'Job updated')
      jobsQuery.refetch()
    },
    onError: (error) => toast.error(error.message || "Couldn't update the job"),
  })

  const deleteMutation = trpc.scheduler.deleteJob.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || 'Job deleted')
      jobsQuery.refetch()
    },
    onError: (error) => toast.error(error.message || "Couldn't delete the job"),
  })

  const restartMutation = trpc.scheduler.restartWorker.useMutation({
    onSuccess: (res) => toast.success(res.message || 'Worker restart signal sent'),
    onError: (error) => toast.error(error.message || "Couldn't restart the worker"),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{'Worker:'}</span>
          {workerData?.connected ? (
            <Badge variant="default" className="bg-chart-2 hover:bg-chart-2">
              {`PID ${workerData.pid}`}
            </Badge>
          ) : (
            <Badge variant="destructive">{'Disconnected'}</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            disabled={restartMutation.isPending}
            onClick={() => restartMutation.mutate()}
          >
            {restartMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            {'Restart'}
          </Button>
        </div>
      </div>

      {matchedJob ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between py-3">
            <div>
              <CardTitle className="text-sm font-medium">{'Schedule for this job'}</CardTitle>
              <CardDescription className="text-xs">{matchedJob.name}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={matchedJob.enabled ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => updateMutation.mutate({ id: matchedJob.id, enabled: !matchedJob.enabled })}
              >
                {matchedJob.enabled ? 'ON' : 'OFF'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate({ id: matchedJob.id })}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">{'Schedule'}</span>
                <p className="font-mono text-xs">{matchedJob.schedule}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{'Timezone'}</span>
                <p className="text-xs">{matchedJob.timezone ?? 'Asia/Jakarta'}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{'Last run'}</span>
                <p className="text-xs">{matchedJob.lastRunAt ? formatDateTime(matchedJob.lastRunAt) : '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-l-2 border-l-chart-3">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">{'Not scheduled'}</CardTitle>
                <CardDescription className="text-xs">
                  {'This job has no cron schedule. Create one below.'}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="h-7" onClick={() => setShowAddForm(true)}>
                <Plus />
                {'Schedule'}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{`${rows.length} job(s) configured`}</p>
        <Button variant="outline" size="sm" className="h-7" onClick={() => setShowAddForm((v) => !v)}>
          <Plus />
          {'Add job'}
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{'Add scheduler job'}</CardTitle>
            <CardDescription>{'Create a new scheduled job.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
                className="flex flex-col gap-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{'Name'}</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. BALE processing" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="procedure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{'Procedure'}</FormLabel>
                        <Popover open={procedurePickerOpen} onOpenChange={setProcedurePickerOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={procedurePickerOpen}
                                className="w-full justify-between font-mono"
                              >
                                <span className={cn('truncate', !field.value && 'text-muted-foreground')}>
                                  {field.value || 'Select a procedure...'}
                                </span>
                                <ChevronsUpDown className="opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                            <Command>
                              <CommandInput placeholder={'Select a procedure...'} />
                              <CommandList>
                                <CommandEmpty>
                                  {'No procedures found. Register one from the Application page first.'}
                                </CommandEmpty>
                                <CommandGroup heading={'Registered'}>
                                  {registeredProcedures.map((proc) => (
                                    <CommandItem
                                      key={proc.function_name}
                                      value={proc.function_name}
                                      onSelect={(value) => {
                                        form.setValue('procedure', value, { shouldValidate: true })
                                        setProcedurePickerOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(field.value === proc.function_name ? 'opacity-100' : 'opacity-0')}
                                      />
                                      <span className="flex-1 truncate font-mono text-xs">{proc.function_name}</span>
                                      <span className="text-xs text-muted-foreground">{proc.app_name}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                {unregisteredProcedures.length > 0 && (
                                  <CommandGroup heading={'Not yet registered'}>
                                    {unregisteredProcedures.map((proc) => (
                                      <CommandItem
                                        key={proc.function_name}
                                        value={proc.function_name}
                                        onSelect={(value) => {
                                          form.setValue('procedure', value, { shouldValidate: true })
                                          setProcedurePickerOpen(false)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            field.value === proc.function_name ? 'opacity-100' : 'opacity-0',
                                          )}
                                        />
                                        <span className="flex-1 truncate font-mono text-xs">{proc.function_name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {'unregistered'}
                                        </Badge>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="schedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{'Cron schedule'}</FormLabel>
                        <FormControl>
                          <Input placeholder="1 0 * * *" className="font-mono" {...field} />
                        </FormControl>
                        <CronDescription value={field.value} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{'Timezone'}</FormLabel>
                        <FormControl>
                          <Input placeholder="Asia/Jakarta" className="font-mono" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                    {'Create job'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                    {'Cancel'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {jobsQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Timer />
                </EmptyMedia>
                <EmptyTitle>{'No scheduler jobs yet'}</EmptyTitle>
                <EmptyDescription>{'Add a job using the form above.'}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{'Name'}</TableHead>
              <TableHead className="font-mono">{'Procedure'}</TableHead>
              <TableHead className="font-mono">{'Schedule'}</TableHead>
              <TableHead className="hidden lg:table-cell">{'Timezone'}</TableHead>
              <TableHead>{'Enabled'}</TableHead>
              <TableHead className="hidden md:table-cell">{'Last run'}</TableHead>
              <TableHead className="hidden md:table-cell">{'Status'}</TableHead>
              <TableHead className="text-right">{'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isMatched = matchedJob?.id === row.id
              return (
                <TableRow key={row.id} className={cn(isMatched && 'bg-accent/50')}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.procedure}</TableCell>
                  <TableCell>
                    <Input
                      className="h-7 w-32 font-mono text-xs"
                      defaultValue={row.schedule}
                      onBlur={(e) => {
                        const val = e.target.value.trim()
                        if (val && val !== row.schedule) {
                          updateMutation.mutate({ id: row.id, schedule: val })
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    {row.timezone ?? 'Asia/Jakarta'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={row.enabled ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 w-16 text-xs"
                      onClick={() => updateMutation.mutate({ id: row.id, enabled: !row.enabled })}
                    >
                      {row.enabled ? 'ON' : 'OFF'}
                    </Button>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {row.lastRunAt ? formatDateTime(row.lastRunAt) : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {row.lastStatus === 'success' && (
                      <Badge variant="default" className="bg-chart-2 hover:bg-chart-2">
                        success
                      </Badge>
                    )}
                    {row.lastStatus === 'running' && (
                      <Badge variant="secondary">
                        <Loader2 className="mr-1 size-3 animate-spin" />
                        running
                      </Badge>
                    )}
                    {row.lastStatus === 'error' && <Badge variant="destructive">error</Badge>}
                    {!row.lastStatus && <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: row.id })}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
