import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Plus, RotateCcw, Timer, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { trpc } from '@/router'
import { useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/scheduler')({
  ssr: false,
  component: SchedulerPage,
})

const jobSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  procedure: z.string().trim().min(1, 'Procedure is required'),
  schedule: z.string().trim().min(1, 'Schedule is required'),
  timezone: z.string().trim().min(1, 'Timezone is required'),
})

type JobFormValues = z.infer<typeof jobSchema>

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

function SchedulerPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const [showAddForm, setShowAddForm] = useState(false)

  const jobsQuery = trpc.scheduler.listJobs.useQuery(undefined, { enabled: isSuperadmin })
  const rows = (jobsQuery.data?.data ?? []) as SchedulerJobRow[]

  const statusQuery = trpc.scheduler.workerStatus.useQuery(undefined, {
    enabled: isSuperadmin,
    refetchInterval: 10000,
  })
  const workerData = statusQuery.data?.data

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: { name: '', procedure: '', schedule: '1 0 * * *', timezone: 'Asia/Jakarta' },
  })

  const createMutation = trpc.scheduler.createJob.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || 'Job created')
      form.reset()
      setShowAddForm(false)
      jobsQuery.refetch()
    },
    onError: (error) => toast.error(error.message || 'Failed to create job'),
  })

  const updateMutation = trpc.scheduler.updateJob.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || 'Job updated')
      jobsQuery.refetch()
    },
    onError: (error) => toast.error(error.message || 'Failed to update job'),
  })

  const deleteMutation = trpc.scheduler.deleteJob.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || 'Job deleted')
      jobsQuery.refetch()
    },
    onError: (error) => toast.error(error.message || 'Failed to delete job'),
  })

  const restartMutation = trpc.scheduler.restartWorker.useMutation({
    onSuccess: (res) => toast.success(res.message || 'Worker restart signal sent'),
    onError: (error) => toast.error(error.message || 'Failed to restart worker'),
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Scheduler</h1>
            <p className="text-sm text-muted-foreground">
              Manage database-driven cron jobs. Jobs are fetched by the isolated scheduler worker on restart.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Worker:</span>
              {workerData?.connected ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                  PID {workerData.pid}
                </Badge>
              ) : (
                <Badge variant="destructive">Disconnected</Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={restartMutation.isPending}
              onClick={() => restartMutation.mutate()}
            >
              {restartMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Restart Worker
            </Button>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {rows.length} job{rows.length !== 1 ? 's' : ''} configured
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAddForm((v) => !v)}>
          <Plus />
          Add Job
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Add scheduler job</CardTitle>
            <CardDescription>Create a new scheduled job. The worker will pick it up on restart.</CardDescription>
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
                        <FormLabel>Name</FormLabel>
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
                        <FormLabel>Procedure</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. sp_process_bale_daily" className="font-mono" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="schedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cron schedule</FormLabel>
                        <FormControl>
                          <Input placeholder="1 0 * * *" className="font-mono" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
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
                    Create Job
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card className="py-0">
        <CardContent className="p-0">
          {jobsQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 8 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Timer />
                </EmptyMedia>
                <EmptyTitle>No scheduler jobs</EmptyTitle>
                <EmptyDescription>Add a job using the form above.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="font-mono">Procedure</TableHead>
                  <TableHead className="font-mono">Schedule</TableHead>
                  <TableHead className="hidden lg:table-cell">Timezone</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="hidden md:table-cell">Last Run</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
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
                      {row.lastRunAt ? new Date(row.lastRunAt).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {row.lastStatus === 'success' && (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-600">
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
