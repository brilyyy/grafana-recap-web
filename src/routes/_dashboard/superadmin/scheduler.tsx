import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { Check, ChevronsUpDown, Loader2, Plus, RotateCcw, Timer, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { CronDescription } from '@/components/cron-description'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/i18n-format'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'
import { useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/scheduler')({
  ssr: false,
  component: SchedulerPage,
})

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

function SchedulerPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const [showAddForm, setShowAddForm] = useState(false)

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

  const jobSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, m.validation_name_required()),
        procedure: z.string().trim().min(1, m.validation_procedure_required()),
        schedule: z.string().trim().min(1, m.validation_schedule_required()),
        timezone: z.string().trim().min(1, m.validation_timezone_required()),
      }),
    [],
  )

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: { name: '', procedure: '', schedule: '1 0 * * *', timezone: 'Asia/Jakarta' },
  })

  const createMutation = trpc.scheduler.createJob.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || m.scheduler_toast_job_created())
      form.reset()
      setShowAddForm(false)
      jobsQuery.refetch()
    },
    onError: (error) => toast.error(error.message || m.scheduler_toast_create_err()),
  })

  const updateMutation = trpc.scheduler.updateJob.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || m.scheduler_toast_job_updated())
      jobsQuery.refetch()
    },
    onError: (error) => toast.error(error.message || m.scheduler_toast_update_err()),
  })

  const deleteMutation = trpc.scheduler.deleteJob.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || m.scheduler_toast_job_deleted())
      jobsQuery.refetch()
    },
    onError: (error) => toast.error(error.message || m.scheduler_toast_delete_err()),
  })

  const restartMutation = trpc.scheduler.restartWorker.useMutation({
    onSuccess: (res) => toast.success(res.message || m.scheduler_toast_restart_sent()),
    onError: (error) => toast.error(error.message || m.scheduler_toast_restart_err()),
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{m.nav_scheduler()}</h1>
            <p className="text-sm text-muted-foreground">{m.scheduler_subtitle()}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{m.scheduler_worker_label()}</span>
              {workerData?.connected ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                  {m.scheduler_worker_pid({ pid: workerData.pid })}
                </Badge>
              ) : (
                <Badge variant="destructive">{m.scheduler_worker_disconnected()}</Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={restartMutation.isPending}
              onClick={() => restartMutation.mutate()}
            >
              {restartMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              {m.scheduler_restart_worker()}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{m.scheduler_jobs_configured({ count: rows.length })}</div>
        <Button variant="outline" size="sm" onClick={() => setShowAddForm((v) => !v)}>
          <Plus />
          {m.scheduler_add_job()}
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">{m.scheduler_add_job_title()}</CardTitle>
            <CardDescription>{m.scheduler_add_job_desc()}</CardDescription>
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
                        <FormLabel>{m.scheduler_name_label()}</FormLabel>
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
                        <FormLabel>{m.scheduler_procedure_label()}</FormLabel>
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
                                  {field.value || m.scheduler_procedure_placeholder()}
                                </span>
                                <ChevronsUpDown className="opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                            <Command>
                              <CommandInput placeholder={m.scheduler_procedure_placeholder()} />
                              <CommandList>
                                <CommandEmpty>{m.scheduler_procedure_empty()}</CommandEmpty>
                                <CommandGroup heading={m.scheduler_procedure_group_registered()}>
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
                                  <CommandGroup heading={m.scheduler_procedure_group_unregistered()}>
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
                                          {m.scheduler_procedure_unregistered_badge()}
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
                        <FormLabel>{m.scheduler_cron_label()}</FormLabel>
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
                        <FormLabel>{m.scheduler_timezone_label()}</FormLabel>
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
                    {m.scheduler_create_job()}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                    {m.common_cancel()}
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
                <EmptyTitle>{m.scheduler_empty_title()}</EmptyTitle>
                <EmptyDescription>{m.scheduler_empty_desc()}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.scheduler_col_name()}</TableHead>
                  <TableHead className="font-mono">{m.scheduler_col_procedure()}</TableHead>
                  <TableHead className="font-mono">{m.scheduler_col_schedule()}</TableHead>
                  <TableHead className="hidden lg:table-cell">{m.scheduler_col_timezone()}</TableHead>
                  <TableHead>{m.scheduler_col_enabled()}</TableHead>
                  <TableHead className="hidden md:table-cell">{m.scheduler_col_last_run()}</TableHead>
                  <TableHead className="hidden md:table-cell">{m.scheduler_col_status()}</TableHead>
                  <TableHead className="text-right">{m.common_actions()}</TableHead>
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
                        {row.enabled ? m.scheduler_on() : m.scheduler_off()}
                      </Button>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {row.lastRunAt ? formatDateTime(row.lastRunAt) : '—'}
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
