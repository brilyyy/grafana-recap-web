import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { Database, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'
import { useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/config')({
  ssr: false,
  component: ConfigPage,
})

type FdwFormValues = { source_db_name: string; table_name: string; schema_name: string }

interface FdwSource {
  id: number
  source_db_name: string
  table_name: string
  schema_name?: string
}

function ConfigPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const fdwQuery = trpc.fdw.list.useQuery(undefined, { enabled: isSuperadmin })
  const fdwSources = (fdwQuery.data?.data?.fdwSources ?? []) as FdwSource[]

  const fdwSchema = useMemo(
    () =>
      z.object({
        source_db_name: z.string().trim().min(1, m.validation_source_db_required()),
        table_name: z.string().trim().min(1, m.validation_table_name_required()),
        schema_name: z.string().trim().min(1, m.validation_schema_required()),
      }),
    [],
  )

  const form = useForm<FdwFormValues>({
    resolver: zodResolver(fdwSchema),
    defaultValues: { source_db_name: '', table_name: '', schema_name: 'public' },
  })

  const addMutation = trpc.fdw.add.useMutation({
    onSuccess: (_res, vars) => {
      toast.success(m.db_toast_fdw_added({ sourceDbName: vars.source_db_name, tableName: vars.table_name }))
      form.reset()
      fdwQuery.refetch()
    },
    onError: (error) => toast.error(error.message || m.db_toast_fdw_add_err()),
  })
  const removeMutation = trpc.fdw.remove.useMutation({
    onSuccess: () => {
      toast.success(m.config_toast_fdw_removed())
      fdwQuery.refetch()
    },
    onError: (error) => toast.error(error.message || m.config_toast_fdw_remove_err()),
  })

  const applyMutation = trpc.fdw.applyFdw.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || m.config_toast_fdw_reapplied())
      fdwQuery.refetch()
    },
    onError: (error) => toast.error(error.message || m.config_toast_fdw_reapply_err()),
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{m.config_title()}</h1>
            <p className="text-sm text-muted-foreground">{m.config_subtitle()}</p>
          </div>
          <Button variant="outline" size="sm" disabled={applyMutation.isPending} onClick={() => applyMutation.mutate()}>
            {applyMutation.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {m.config_reapply_fdw()}
          </Button>
        </div>
      </header>

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
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  {m.db_add_fdw_source()}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
