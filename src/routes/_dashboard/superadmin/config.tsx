import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { Database, Loader2, Plus, Trash2 } from 'lucide-react'
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
import { trpc } from '@/router'
import { useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/config')({
  ssr: false,
  component: ConfigPage,
})

const fdwSchema = z.object({
  source_db_name: z.string().trim().min(1, 'Source DB is required'),
  table_name: z.string().trim().min(1, 'Table name is required'),
  schema_name: z.string().trim().min(1, 'Schema is required'),
})

type FdwFormValues = z.infer<typeof fdwSchema>

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

  const form = useForm<FdwFormValues>({
    resolver: zodResolver(fdwSchema),
    defaultValues: { source_db_name: '', table_name: '', schema_name: 'public' },
  })

  const addMutation = trpc.fdw.add.useMutation({
    onSuccess: (_res, vars) => {
      toast.success(`Added FDW source ${vars.source_db_name}.${vars.table_name}`)
      form.reset()
      fdwQuery.refetch()
    },
    onError: (error) => toast.error(error.message || 'Failed to add FDW source'),
  })
  const removeMutation = trpc.fdw.remove.useMutation({
    onSuccess: () => {
      toast.success('FDW source removed')
      fdwQuery.refetch()
    },
    onError: (error) => toast.error(error.message || 'Failed to remove FDW source'),
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">FDW configuration</h1>
        <p className="text-sm text-muted-foreground">
          Manage Foreign Data Wrapper source tables imported from external databases (e.g. itm_db) used by apps like
          EDC Agen and EDC Merchant. After changes, run migration to apply:{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">DB_NAME=platform_db npm run db:migrate</code>
        </p>
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
                  <EmptyTitle>No FDW sources configured</EmptyTitle>
                  <EmptyDescription>Add a source table using the form.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source DB</TableHead>
                    <TableHead>Table name</TableHead>
                    <TableHead>Schema</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
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
                          Remove
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
            <CardTitle className="text-base font-medium">Add FDW source</CardTitle>
            <CardDescription>Import a source table via postgres_fdw.</CardDescription>
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
                      <FormLabel>Source DB</FormLabel>
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
                      <FormLabel>Table name</FormLabel>
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
                      <FormLabel>Schema</FormLabel>
                      <FormControl>
                        <Input className="font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  Add FDW source
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
