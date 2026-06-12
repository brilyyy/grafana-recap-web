import { createFileRoute } from '@tanstack/react-router'
import { Check, CircleDashed, Loader2, RefreshCw, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { trpc } from '@/router'
import { useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/processing')({
  ssr: false,
  component: ProcessingPage,
})

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

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

function ProcessingPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const now = new Date()
  const [catalogEntryId, setCatalogEntryId] = useState('')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [jobSearch, setJobSearch] = useState('')
  const [processingDates, setProcessingDates] = useState<Record<string, boolean>>({})

  const catalogQuery = trpc.recap.listCatalog.useQuery(undefined, { enabled: isSuperadmin })
  const catalogEntries = catalogQuery.data?.data ?? []

  useEffect(() => {
    if (!catalogEntries.length) return
    if (!catalogEntryId || !catalogEntries.some((entry) => entry.id === catalogEntryId)) {
      setCatalogEntryId(catalogEntries[0].id)
    }
  }, [catalogEntries, catalogEntryId])

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

  const handleDateProcessing = async (date: string) => {
    if (!catalogEntryId) {
      toast.error('Please select a job before processing data.')
      return
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const processingDate = new Date(`${date}T00:00:00`)
    processingDate.setHours(0, 0, 0, 0)
    if (processingDate >= today) {
      toast.error('Cannot process future dates. Only H-1 (yesterday) and earlier dates can be processed.')
      return
    }

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
      // Small delay so the stored procedure finishes writing before refresh
      await new Promise((resolve) => setTimeout(resolve, 500))
      await logsQuery.refetch()
    } catch (error) {
      toast.error(`Error triggering processing: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setProcessingDates((prev) => ({ ...prev, [date]: false }))
    }
  }

  const allDates = getAllDatesInMonth(month, year)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const firstDay = new Date(year, month - 1, 1).getDay()

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
        <h1 className="text-lg font-semibold tracking-tight">Application data processing</h1>
        <p className="text-sm text-muted-foreground">
          View processing logs per job and trigger manual runs for past dates.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Month</Label>
          <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((name, idx) => (
                <SelectItem key={name} value={String(idx + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Year</Label>
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
          <Label className="text-xs">Search job</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              placeholder="Search by job title, ID, or output table"
              className="h-8 pl-8"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-4">
          <Label className="text-xs">Job</Label>
          {catalogQuery.isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <Select value={catalogEntryId} onValueChange={setCatalogEntryId}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Select job" />
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
              Output: <span className="font-mono">{selectedJob.outputTable}</span>
              {' · '}
              Function: <span className="font-mono">{selectedJob.functionName}</span>
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
            <EmptyTitle>No job selected</EmptyTitle>
            <EmptyDescription>Select a job to view processing logs.</EmptyDescription>
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
              <StatTile label="Success" value={summary.success} />
              <StatTile label="Failed" value={summary.failed} />
              <StatTile label="Running" value={summary.running} />
              <StatTile label="Not processed" value={summary.notProcessed} />
              <StatTile label="Total days" value={summary.total} />
            </div>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <p className="text-base font-medium">
                {new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-chart-2" /> Success
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-destructive" /> Failed
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-muted-foreground/40" /> Not processed
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2 grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-1 text-center text-xs font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {[...Array(firstDay).fill(null), ...allDates].map((dateStr, idx) =>
                  dateStr === null ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: leading empty calendar cells
                    <div key={`empty-${idx}`} className="aspect-square" />
                  ) : logsQuery.isLoading ? (
                    <Skeleton key={dateStr} className="aspect-square rounded-lg" />
                  ) : (
                    (() => {
                      const log = logsByDate[dateStr]
                      const status = log?.status ?? null
                      const date = new Date(`${dateStr}T00:00:00`)
                      date.setHours(0, 0, 0, 0)
                      const canProcess = date < today
                      const isToday = dateStr === todayStr
                      const isProcessing = !!processingDates[dateStr]
                      return (
                        <div
                          key={dateStr}
                          className={cn(
                            'flex aspect-square flex-col rounded-lg border p-1.5',
                            isToday && 'border-ring',
                            !canProcess && 'opacity-50',
                          )}
                          title={isToday ? 'Today' : dateStr}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium tabular-nums">{new Date(dateStr).getDate()}</span>
                            {status === 'success' && <Check className="size-3.5 text-chart-2" />}
                            {status === 'failed' && <X className="size-3.5 text-destructive" />}
                            {status === 'running' && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                          </div>
                          {log && log.records_processed !== null && (
                            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground tabular-nums">
                              {log.records_processed || 0} rec
                            </p>
                          )}
                          {canProcess && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-auto h-6 w-full px-1 text-[10px]"
                              onClick={() => handleDateProcessing(dateStr)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                              Process
                            </Button>
                          )}
                        </div>
                      )
                    })()
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          {!logsQuery.isLoading && processingLogs.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                View detailed information
              </summary>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {allDates.map((dateStr) => {
                  const log = logsByDate[dateStr]
                  if (!log) return null
                  return (
                    <Card key={dateStr} className="gap-2 py-3">
                      <CardHeader className="flex-row items-center justify-between px-4">
                        <p className="text-sm font-medium">
                          {new Date(dateStr).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <Badge
                          variant={
                            log.status === 'success' ? 'secondary' : log.status === 'failed' ? 'destructive' : 'outline'
                          }
                        >
                          {log.status}
                        </Badge>
                      </CardHeader>
                      <CardContent className="px-4 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Records processed</span>
                          <span className="text-foreground tabular-nums">{log.records_processed || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Records inserted</span>
                          <span className="text-foreground tabular-nums">{log.records_inserted || 0}</span>
                        </div>
                        {log.start_time && (
                          <div className="flex justify-between">
                            <span>Start</span>
                            <span className="text-foreground">
                              {new Date(log.start_time).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        {log.end_time && (
                          <div className="flex justify-between">
                            <span>End</span>
                            <span className="text-foreground">
                              {new Date(log.end_time).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        {log.error_message && (
                          <p className="mt-2 break-words rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                            {log.error_message}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
