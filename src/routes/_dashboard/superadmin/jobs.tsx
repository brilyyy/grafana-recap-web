import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Loader2, Play } from 'lucide-react'
import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { trpc } from '@/router'
import { useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/jobs')({
  ssr: false,
  component: JobsPage,
})

function JobsPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [manualDates, setManualDates] = useState<Record<string, string>>({})

  const catalogQuery = trpc.recap.listCatalog.useQuery(undefined, { enabled: isSuperadmin })
  const rows = catalogQuery.data?.data ?? []

  const triggerMutation = trpc.recap.triggerManual.useMutation({
    onSuccess: (res) => {
      catalogQuery.refetch()
      const message = res.data?.message ?? 'Job triggered'
      const status = res.data?.logEntry?.status
      toast.success(status ? `${message} — status: ${status}` : message)
    },
    onError: (error) => toast.error(error.message || 'Trigger failed'),
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Job list</h1>
        <p className="text-sm text-muted-foreground">
          All schedulable recap jobs (success rate per app and custom models). Expand a row for the summary and
          representative query. Use Processing with the same job to inspect calendar logs.
        </p>
      </header>

      <Card className="py-0">
        <CardContent className="p-0">
          {catalogQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 8 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">ID</TableHead>
                  <TableHead className="hidden lg:table-cell">Kind</TableHead>
                  <TableHead className="hidden lg:table-cell">Output table</TableHead>
                  <TableHead className="hidden md:table-cell">Schedule (env)</TableHead>
                  <TableHead className="text-right">Run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId((id) => (id === row.id ? null : row.id))}
                    >
                      <TableCell>
                        {expandedId === row.id ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                        {row.id}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {row.recapKind}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                        {row.outputTable}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {row.scheduleEnvVar ?? '—'}
                        {(row as { scheduleCronResolved?: string }).scheduleCronResolved && (
                          <span className="block font-mono">
                            {(row as { scheduleCronResolved?: string }).scheduleCronResolved}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops row-expand toggle only */}
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="date"
                            className="h-8 w-36"
                            value={manualDates[row.id] ?? ''}
                            onChange={(e) => setManualDates((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={triggerMutation.isPending}
                            title="Run now (empty date = H-1)"
                            onClick={() => {
                              const d = manualDates[row.id]?.trim()
                              triggerMutation.mutate({ catalogEntryId: row.id, date: d || undefined })
                            }}
                          >
                            {triggerMutation.isPending ? <Loader2 className="animate-spin" /> : <Play />}
                            Run
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === row.id && (
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={7} className="px-6 py-4">
                          <p className="mb-2 text-sm">{row.description}</p>
                          <p className="mb-2 text-xs text-muted-foreground">{row.briefProcessSummary}</p>
                          <p className="mb-2 text-xs text-muted-foreground">
                            Function: <code className="font-mono text-foreground">{row.functionName}</code> · Doc:{' '}
                            <code className="font-mono text-foreground">{row.rawSqlRepoPath}</code>
                          </p>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Representative query (brief)</p>
                          <pre className="overflow-x-auto rounded-md border bg-background p-3 font-mono text-xs whitespace-pre-wrap">
                            {row.briefQuery}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
