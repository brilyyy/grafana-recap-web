import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { Database, Loader2, Plus, RefreshCw, Server, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'
import { useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/databases')({
  ssr: false,
  component: DatabasesPage,
})

type FdwFormValues = { source_db_name: string; table_name: string; schema_name: string; host: string }

interface DatabaseRow {
  datname: string
  isCurrent: boolean
  hasForeignServer: boolean
  sourceTableCount: number
  isFdwed: boolean
}

interface FdwSource {
  id: number
  source_db_name: string
  table_name: string
  schema_name?: string
  host?: string
}

const fdwSchema = z.object({
  source_db_name: z.string().trim().min(1, m.validation_source_db_required()),
  table_name: z.string().trim().min(1, m.validation_table_name_required()),
  schema_name: z.string().trim().min(1, m.validation_schema_required()),
  host: z.string(),
})

function RegisterFdwDialog({
  open,
  onOpenChange,
  initialDbName,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialDbName: string
}) {
  const utils = trpc.useUtils()
  const form = useForm<FdwFormValues>({
    resolver: zodResolver(fdwSchema),
    values: { source_db_name: initialDbName, table_name: '', schema_name: 'public', host: '' },
  })

  const addMutation = trpc.fdw.add.useMutation({
    onSuccess: (_res, vars) => {
      toast.success(m.db_toast_fdw_added({ sourceDbName: vars.source_db_name, tableName: vars.table_name }))
      form.reset({ source_db_name: initialDbName, table_name: '', schema_name: 'public', host: '' })
      onOpenChange(false)
      utils.databases.list.invalidate()
      utils.fdw.list.invalidate()
    },
    onError: (error) => toast.error(error.message || m.db_toast_fdw_add_err()),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{m.db_register_fdw()}</DialogTitle>
          <DialogDescription>
            {m.db_register_fdw_desc_part1()} <span className="font-mono font-medium">{initialDbName}</span>{' '}
            {m.db_register_fdw_desc_part2()} <code className="rounded bg-muted px-1 py-0.5 text-xs">postgres_fdw</code>
            {m.db_register_fdw_desc_part3()}{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">DB_NAME=platform_db npm run db:migrate</code>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => addMutation.mutate(values))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="source_db_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.db_source_db_label()}</FormLabel>
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
                  <FormLabel>{m.db_table_name_label()}</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. raw_bale" className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="schema_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.db_schema_label()}</FormLabel>
                  <FormControl>
                    <Input className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.db_host_label()}</FormLabel>
                  <FormControl>
                    <Input placeholder={m.db_host_placeholder()} className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {m.common_cancel()}
              </Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                {m.db_add_fdw_source()}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DatabasesPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const dbQuery = trpc.databases.list.useQuery(undefined, { enabled: isSuperadmin })
  const databases = (dbQuery.data?.data?.databases ?? []) as DatabaseRow[]

  const fdwQuery = trpc.fdw.list.useQuery(undefined, { enabled: isSuperadmin })
  const fdwSources = (fdwQuery.data?.data?.fdwSources ?? []) as FdwSource[]

  const [dialogDb, setDialogDb] = useState<string | null>(null)

  const form = useForm<FdwFormValues>({
    resolver: zodResolver(fdwSchema),
    defaultValues: { source_db_name: '', table_name: '', schema_name: 'public', host: '' },
  })

  const addMutation = trpc.fdw.add.useMutation({
    onSuccess: (_res, vars) => {
      toast.success(m.db_toast_fdw_added({ sourceDbName: vars.source_db_name, tableName: vars.table_name }))
      form.reset()
      fdwQuery.refetch()
      dbQuery.refetch()
    },
    onError: (error) => toast.error(error.message || m.db_toast_fdw_add_err()),
  })
  const removeMutation = trpc.fdw.remove.useMutation({
    onSuccess: () => {
      toast.success(m.config_toast_fdw_removed())
      fdwQuery.refetch()
      dbQuery.refetch()
    },
    onError: (error) => toast.error(error.message || m.config_toast_fdw_remove_err()),
  })

  const applyMutation = trpc.fdw.applyFdw.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || m.config_toast_fdw_reapplied())
      fdwQuery.refetch()
      dbQuery.refetch()
    },
    onError: (error) => toast.error(error.message || m.config_toast_fdw_reapply_err()),
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{m.nav_databases()}</h1>
            <p className="text-sm text-muted-foreground">
              {m.db_subtitle_part1()} <code className="rounded bg-muted px-1 py-0.5 text-xs">&lt;db&gt;_server</code>{' '}
              {m.db_subtitle_part2()} <code className="rounded bg-muted px-1 py-0.5 text-xs">fdw_source_table</code>.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={applyMutation.isPending} onClick={() => applyMutation.mutate()}>
            {applyMutation.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {m.config_reapply_fdw()}
          </Button>
        </div>
      </header>

      {/* Section 1: Databases overview */}
      <Card className="py-0">
        <CardContent className="p-0">
          {dbQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : databases.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Server />
                </EmptyMedia>
                <EmptyTitle>{m.db_empty_title()}</EmptyTitle>
                <EmptyDescription>{m.db_empty_desc()}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.db_col_database()}</TableHead>
                  <TableHead>{m.db_col_fdw_status()}</TableHead>
                  <TableHead className="w-44 text-right">{m.common_actions()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {databases.map((row) => (
                  <TableRow key={row.datname}>
                    <TableCell>
                      <span className="font-mono text-sm">{row.datname}</span>
                      {row.isCurrent && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {m.db_badge_current()}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.isFdwed ? (
                        <Badge className="gap-1">
                          <Database className="size-3" />
                          {m.db_badge_fdwed()}
                          {row.sourceTableCount > 0 && (
                            <span className="opacity-75">· {m.db_tables_count({ count: row.sourceTableCount })}</span>
                          )}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          {m.db_badge_not_fdwed()}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setDialogDb(row.datname)}
                      >
                        <Plus className="size-3" />
                        {m.db_register_fdw()}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section 2: FDW Sources management */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="py-0">
          <CardContent className="p-0">
            {fdwQuery.isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 5 }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : fdwSources.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Database />
                  </EmptyMedia>
                  <EmptyTitle>{m.config_empty_title()}</EmptyTitle>
                  <EmptyDescription>{m.config_empty_desc()}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.db_source_db_label()}</TableHead>
                    <TableHead>{m.db_table_name_label()}</TableHead>
                    <TableHead>{m.db_schema_label()}</TableHead>
                    <TableHead>{m.db_host_label()}</TableHead>
                    <TableHead className="w-24 text-right">{m.common_actions()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fdwSources.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.source_db_name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.table_name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.schema_name || 'public'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.host || m.db_host_default()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive hover:text-destructive"
                          onClick={() => removeMutation.mutate({ id: row.id })}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="size-3.5" />
                          {m.config_remove()}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">{m.db_add_fdw_source()}</CardTitle>
            <CardDescription>{m.config_add_card_desc()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}
                className="flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="source_db_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{m.db_source_db_label()}</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. itm_db" className="font-mono" {...field} />
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
                      <FormLabel>{m.db_table_name_label()}</FormLabel>
                      <FormControl>
                        <Input className="font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="schema_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{m.db_schema_label()}</FormLabel>
                      <FormControl>
                        <Input className="font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{m.db_host_label()}</FormLabel>
                      <FormControl>
                        <Input placeholder={m.db_host_placeholder()} className="font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  {m.db_add_fdw_source()}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {dialogDb !== null && (
        <RegisterFdwDialog
          open={dialogDb !== null}
          onOpenChange={(open) => {
            if (!open) setDialogDb(null)
          }}
          initialDbName={dialogDb}
        />
      )}
    </div>
  )
}
