import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Clock, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { trpc } from '@/router'
import { useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/housekeeping')({
  ssr: false,
  component: HousekeepingPage,
})

type DateColumnType = 'timestamp' | 'int_1yymmdd'

interface HousekeepingRow {
  id: number
  db_name: string
  table_name: string
  date_column: string | null
  date_column_type: string | null
  retention_days: number | null
  notes: string | null
}

const addRowSchema = z.object({
  db_name: z.string().trim().min(1, 'db_name is required'),
  table_name: z.string().trim().min(1, 'table_name is required'),
  date_column: z.string().trim(),
  date_column_type: z.enum(['timestamp', 'int_1yymmdd']),
  retention_days: z
    .string()
    .trim()
    .refine((v) => v === '' || (Number.isInteger(Number(v)) && Number(v) > 0), 'Must be a positive integer'),
  notes: z.string().trim(),
})

type AddRowValues = z.infer<typeof addRowSchema>

function HousekeepingPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const [editingRetention, setEditingRetention] = useState<{ id: number; value: string } | null>(null)
  const [editingDateConfig, setEditingDateConfig] = useState<{
    id: number
    date_column: string
    date_column_type: DateColumnType
  } | null>(null)
  const [runningId, setRunningId] = useState<number | null>(null)

  const listQuery = trpc.housekeeping.list.useQuery(undefined, { enabled: isSuperadmin })
  const scheduleQuery = trpc.housekeeping.getSchedule.useQuery(undefined, { enabled: isSuperadmin })
  const rows = (listQuery.data?.data ?? []) as HousekeepingRow[]

  const updateConfigMutation = trpc.housekeeping.updateConfig.useMutation({
    onSuccess: () => listQuery.refetch(),
    onError: (error) => toast.error(error.message || 'Failed to update config'),
  })
  const upsertMutation = trpc.housekeeping.upsertRow.useMutation({
    onSuccess: () => {
      toast.success('Housekeeping row saved')
      form.reset()
      listQuery.refetch()
    },
    onError: (error) => toast.error(error.message || 'Failed to save row'),
  })
  const deleteMutation = trpc.housekeeping.deleteRow.useMutation({
    onSuccess: () => {
      toast.success('Housekeeping row removed')
      listQuery.refetch()
    },
    onError: (error) => toast.error(error.message || 'Failed to delete row'),
  })
  const runMutation = trpc.housekeeping.run.useMutation()

  const form = useForm<AddRowValues>({
    resolver: zodResolver(addRowSchema),
    defaultValues: {
      db_name: '',
      table_name: '',
      date_column: '',
      date_column_type: 'timestamp',
      retention_days: '',
      notes: '',
    },
  })

  const onAddRow = (values: AddRowValues) => {
    const rd = values.retention_days ? Number.parseInt(values.retention_days, 10) : null
    upsertMutation.mutate({
      db_name: values.db_name,
      table_name: values.table_name,
      date_column: values.date_column === '' ? null : values.date_column,
      date_column_type: values.date_column_type,
      retention_days: rd !== null && !Number.isNaN(rd) && rd > 0 ? rd : null,
      notes: values.notes === '' ? null : values.notes,
    })
  }

  const handleRun = async (row: HousekeepingRow) => {
    setRunningId(row.id)
    try {
      const result = await runMutation.mutateAsync({ id: row.id })
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error running housekeeping')
    } finally {
      setRunningId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Housekeeping</h1>
        <p className="text-sm text-muted-foreground">
          Configure retention per raw table. Shared raw tables (e.g. itm_db tables used by EDC Agen, EDC Merchant, and
          EDC Merchant Ancol) appear as a single row. Running housekeeping deletes rows older than the configured
          retention period directly from the raw table.
        </p>
      </header>

      <Alert>
        <Clock />
        <AlertTitle>
          Schedule: <code className="font-mono text-xs">{scheduleQuery.data?.data?.schedule ?? '0 2 * * *'}</code>
        </AlertTitle>
        <AlertDescription>
          Housekeeping runs via node-cron on the app server. To change the schedule, set{' '}
          <code className="font-mono">HOUSEKEEPING_SCHEDULE</code> in <code className="font-mono">.env</code> and
          restart the app.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Add raw table</CardTitle>
          <CardDescription>
            Use the platform relation name (prefixed FDW foreign table when applicable, e.g.{' '}
            <code className="font-mono text-xs">bale_db_raw_bale</code>), not only the short view name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddRow)} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="db_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>db_name</FormLabel>
                      <FormControl>
                        <Input className="font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="table_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>table_name</FormLabel>
                      <FormControl>
                        <Input className="font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date_column"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>date_column (optional)</FormLabel>
                      <FormControl>
                        <Input className="font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date_column_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date column type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="timestamp">timestamp / date</SelectItem>
                          <SelectItem value="int_1yymmdd">integer 1YYMMDD (e.g. TRXMDT)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="retention_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retention days (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="self-start" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                Save row
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Trash2 />
                </EmptyMedia>
                <EmptyTitle>No raw tables configured</EmptyTitle>
                <EmptyDescription>Run migration to seed from apps, or add a row above.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Database</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Date column</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const canRun = !!row.date_column && !!row.retention_days
                  const isRefNoDate = !row.date_column && (row.notes?.toLowerCase().includes('reference') ?? false)
                  return (
                    <TableRow key={row.id} className={!row.date_column ? 'opacity-70' : undefined}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.db_name}</TableCell>
                      <TableCell className="font-mono text-xs font-medium">{row.table_name}</TableCell>

                      <TableCell>
                        {editingDateConfig?.id === row.id ? (
                          <div className="flex max-w-56 flex-col gap-2">
                            <Input
                              value={editingDateConfig.date_column}
                              onChange={(e) =>
                                setEditingDateConfig((p) => (p ? { ...p, date_column: e.target.value } : null))
                              }
                              placeholder="column_name"
                              className="h-8 font-mono text-xs"
                            />
                            <Select
                              value={editingDateConfig.date_column_type}
                              onValueChange={(value) =>
                                setEditingDateConfig((p) =>
                                  p ? { ...p, date_column_type: value as DateColumnType } : null,
                                )
                              }
                            >
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="timestamp">timestamp / date</SelectItem>
                                <SelectItem value="int_1yymmdd">integer 1YYMMDD</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex gap-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-7"
                                disabled={updateConfigMutation.isPending || !editingDateConfig.date_column.trim()}
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
                              >
                                <Check className="size-3.5" />
                                Save
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7"
                                onClick={() => setEditingDateConfig(null)}
                              >
                                <X className="size-3.5" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : row.date_column ? (
                          <div className="flex items-center gap-1">
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{row.date_column}</code>
                            {row.date_column_type === 'int_1yymmdd' && (
                              <span className="text-xs text-muted-foreground">1YYMMDD</span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              title="Edit date column"
                              onClick={() =>
                                setEditingDateConfig({
                                  id: row.id,
                                  date_column: row.date_column ?? '',
                                  date_column_type:
                                    row.date_column_type === 'int_1yymmdd' ? 'int_1yymmdd' : 'timestamp',
                                })
                              }
                            >
                              <Pencil className="size-3" />
                            </Button>
                          </div>
                        ) : isRefNoDate ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="outline" title={row.notes ?? ''}>
                              Not applicable
                            </Badge>
                            {row.notes && <p className="max-w-52 text-xs text-muted-foreground">{row.notes}</p>}
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline">
                              <Clock />
                              Pending setup
                            </Badge>
                            {row.notes && <p className="max-w-52 text-xs text-muted-foreground">{row.notes}</p>}
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() =>
                                setEditingDateConfig({ id: row.id, date_column: '', date_column_type: 'timestamp' })
                              }
                            >
                              Set date column
                            </Button>
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {editingRetention?.id === row.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={1}
                              value={editingRetention.value}
                              onChange={(e) => setEditingRetention((p) => (p ? { ...p, value: e.target.value } : null))}
                              placeholder="days"
                              className="h-8 w-24"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Save"
                              disabled={updateConfigMutation.isPending}
                              onClick={() => {
                                const days = Number.parseInt(editingRetention.value, 10)
                                if (!Number.isNaN(days) && days > 0) {
                                  updateConfigMutation.mutate(
                                    { id: row.id, retention_days: days },
                                    { onSuccess: () => setEditingRetention(null) },
                                  )
                                }
                              }}
                            >
                              {updateConfigMutation.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Cancel"
                              onClick={() => setEditingRetention(null)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : row.date_column || !isRefNoDate ? (
                          <div className="flex items-center gap-1">
                            <span
                              className={
                                row.retention_days ? 'text-sm tabular-nums' : 'text-sm text-muted-foreground italic'
                              }
                            >
                              {row.retention_days ? `${row.retention_days} days` : 'Not set'}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              title="Edit retention"
                              disabled={isRefNoDate}
                              onClick={() =>
                                setEditingRetention({ id: row.id, value: String(row.retention_days ?? '') })
                              }
                            >
                              <Pencil className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">N/A</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            disabled={!canRun || runningId === row.id}
                            title={
                              !row.date_column
                                ? 'Configure date column and retention first'
                                : !row.retention_days
                                  ? 'Set retention days first'
                                  : 'Run housekeeping'
                            }
                            onClick={() => handleRun(row)}
                          >
                            {runningId === row.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                            Run
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (!window.confirm(`Remove housekeeping config for ${row.db_name}.${row.table_name}?`))
                                return
                              deleteMutation.mutate({ id: row.id })
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
