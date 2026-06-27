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
  source_db_name: z.string().trim().min(1, 'Source DB is required'),
  table_name: z.string().trim().min(1, 'Table name is required'),
  schema_name: z.string().trim().min(1, 'Schema is required'),
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
      toast.success(`FDW source added from ${vars.source_db_name} → ${vars.table_name}`)
      form.reset({ source_db_name: initialDbName, table_name: '', schema_name: 'public', host: '' })
      onOpenChange(false)
      utils.databases.list.invalidate()
      utils.fdw.list.invalidate()
    },
    onError: (error) => toast.error(error.message || "Couldn't add the FDW source"),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{'Register FDW source'}</DialogTitle>
          <DialogDescription>
            {'Add a foreign table from'} <span className="font-mono font-medium">{initialDbName}</span> {'via'}{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">postgres_fdw</code>
            {'. Run migration after to provision:'}{' '}
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
                  <FormLabel>{'Source DB'}</FormLabel>
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
                  <FormLabel>{'Table name'}</FormLabel>
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
                  <FormLabel>{'Schema'}</FormLabel>
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
                  <FormLabel>{'Host IP'}</FormLabel>
                  <FormControl>
                    <Input placeholder={'e.g. 192.168.1.100 (empty = DB_HOST)'} className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {'Cancel'}
              </Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                {'Add FDW source'}
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
      toast.success(`FDW source added from ${vars.source_db_name} → ${vars.table_name}`)
      form.reset()
      fdwQuery.refetch()
      dbQuery.refetch()
    },
    onError: (error) => toast.error(error.message || "Couldn't add the FDW source"),
  })
  const removeMutation = trpc.fdw.remove.useMutation({
    onSuccess: () => {
      toast.success('FDW source removed')
      fdwQuery.refetch()
      dbQuery.refetch()
    },
    onError: (error) => toast.error(error.message || "Couldn't remove the FDW source"),
  })

  const applyMutation = trpc.fdw.applyFdw.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || 'FDW re-applied ✅')
      fdwQuery.refetch()
      dbQuery.refetch()
    },
    onError: (error) => toast.error(error.message || "Couldn't re-apply FDW"),
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{'Databases'}</h1>
            <p className="text-sm text-muted-foreground">
              {'All databases on this PostgreSQL server. A database is FDW-ed when a foreign server'}{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">&lt;db&gt;_server</code>{' '}
              {'is provisioned or source tables are registered in'}{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">fdw_source_table</code>.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={applyMutation.isPending} onClick={() => applyMutation.mutate()}>
            {applyMutation.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {'Re-apply FDW'}
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
                <EmptyTitle>{'No databases found'}</EmptyTitle>
                <EmptyDescription>{"Couldn't query pg_database. Check the connection."}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{'Database'}</TableHead>
                  <TableHead>{'FDW status'}</TableHead>
                  <TableHead className="w-44 text-right">{'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {databases.map((row) => (
                  <TableRow key={row.datname}>
                    <TableCell>
                      <span className="font-mono text-sm">{row.datname}</span>
                      {row.isCurrent && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {'current'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.isFdwed ? (
                        <Badge className="gap-1">
                          <Database className="size-3" />
                          {'FDW-ed'}
                          {row.sourceTableCount > 0 && (
                            <span className="opacity-75">· {`${row.sourceTableCount} tables`}</span>
                          )}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          {'Not FDW-ed'}
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
                        {'Register FDW source'}
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
                  <EmptyTitle>{'No FDW sources configured'}</EmptyTitle>
                  <EmptyDescription>{'Add a source table using the form.'}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{'Source DB'}</TableHead>
                    <TableHead>{'Table name'}</TableHead>
                    <TableHead>{'Schema'}</TableHead>
                    <TableHead>{'Host IP'}</TableHead>
                    <TableHead className="w-24 text-right">{'Actions'}</TableHead>
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
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.host || 'DB_HOST'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive hover:text-destructive"
                          onClick={() => removeMutation.mutate({ id: row.id })}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="size-3.5" />
                          {'Remove'}
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
            <CardTitle className="text-base font-medium">{'Add FDW source'}</CardTitle>
            <CardDescription>{'Import a source table via postgres_fdw.'}</CardDescription>
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
                      <FormLabel>{'Source DB'}</FormLabel>
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
                      <FormLabel>{'Table name'}</FormLabel>
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
                      <FormLabel>{'Schema'}</FormLabel>
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
                      <FormLabel>{'Host IP'}</FormLabel>
                      <FormControl>
                        <Input placeholder={'e.g. 192.168.1.100 (empty = DB_HOST)'} className="font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  {'Add FDW source'}
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
