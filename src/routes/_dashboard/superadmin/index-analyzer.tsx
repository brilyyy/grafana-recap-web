import { createFileRoute } from '@tanstack/react-router'
import { DatabaseZap, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'
import type { IndexAnalyzerReport } from '@/server/trpc/routers/indexAnalyzer'
import { useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/index-analyzer')({
  ssr: false,
  component: IndexAnalyzerPage,
})

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <p className="truncate text-2xl font-semibold tabular-nums" title={value}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

/** Monospace, click-to-copy SQL recommendation cell. */
function Reco({ sql }: { sql: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(sql)}
      title={m.analyzer_copy_hint()}
      className="w-full truncate text-left font-mono text-xs text-muted-foreground hover:text-foreground"
    >
      {sql}
    </button>
  )
}

function SectionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="py-0">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  )
}

function IndexAnalyzerPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const query = trpc.indexAnalyzer.analyze.useQuery(undefined, { enabled: isSuperadmin })
  const report = query.data?.data as IndexAnalyzerReport | undefined

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{m.analyzer_title()}</h1>
          <p className="text-sm text-muted-foreground">
            {m.analyzer_subtitle()}
            {report ? (
              <>
                {' '}
                {m.analyzer_subtitle_db_label()} <span className="font-mono text-foreground">{report.dbName}</span>.
              </>
            ) : null}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => query.refetch()}>
          {query.isFetching ? <Skeleton className="size-3 rounded-full" /> : <RefreshCw className="size-3" />}
          {m.analyzer_rerun()}
        </Button>
      </header>

      {query.isLoading && <Skeleton className="h-40 w-full" />}

      {query.isError && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DatabaseZap />
            </EmptyMedia>
            <EmptyTitle>{m.analyzer_fail_title()}</EmptyTitle>
            <EmptyDescription>{query.error?.message ?? m.analyzer_fail_desc_fallback()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label={m.analyzer_stat_unused_label()}
              value={String(report.summary.unused)}
              hint={m.analyzer_stat_unused_hint()}
            />
            <StatCard
              label={m.analyzer_stat_missing_label()}
              value={String(report.summary.missing)}
              hint={m.analyzer_stat_missing_hint()}
            />
            <StatCard
              label={m.analyzer_stat_redundant_label()}
              value={String(report.summary.redundant)}
              hint={m.analyzer_stat_redundant_hint()}
            />
            <StatCard
              label={m.analyzer_stat_drift_missing_label()}
              value={String(report.summary.driftMissing)}
              hint={m.analyzer_stat_drift_missing_hint()}
            />
            <StatCard
              label={m.analyzer_stat_drift_extra_label()}
              value={String(report.summary.driftExtra)}
              hint={m.analyzer_stat_drift_extra_hint()}
            />
          </div>

          <SectionCard title={m.analyzer_unused_title()} description={m.analyzer_unused_desc()}>
            {report.unused.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{m.analyzer_unused_empty()}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.analyzer_col_index()}</TableHead>
                    <TableHead>{m.analyzer_col_table()}</TableHead>
                    <TableHead className="text-right">{m.analyzer_col_size()}</TableHead>
                    <TableHead>{m.analyzer_col_recommendation()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.unused.map((r) => (
                    <TableRow key={r.index}>
                      <TableCell className="font-mono text-xs">{r.index}</TableCell>
                      <TableCell className="text-xs">{r.table}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.size}</TableCell>
                      <TableCell className="max-w-md">
                        <Reco sql={r.recommendation} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard title={m.analyzer_missing_title()} description={m.analyzer_missing_desc()}>
            {report.missing.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{m.analyzer_missing_empty()}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.analyzer_col_table()}</TableHead>
                    <TableHead className="text-right">{m.analyzer_col_seq_scans()}</TableHead>
                    <TableHead className="text-right">{m.analyzer_col_idx_scans()}</TableHead>
                    <TableHead className="text-right">{m.analyzer_col_rows()}</TableHead>
                    <TableHead className="text-right">{m.analyzer_col_size()}</TableHead>
                    <TableHead>{m.analyzer_col_recommendation()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.missing.map((r) => (
                    <TableRow key={r.table}>
                      <TableCell className="text-xs">{r.table}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.seqScan.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.idxScan.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.liveTuples.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.size}</TableCell>
                      <TableCell className="max-w-md">
                        <Reco sql={r.recommendation} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard title={m.analyzer_sizes_title()} description={m.analyzer_sizes_desc()}>
            {report.sizes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{m.analyzer_sizes_empty()}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.analyzer_col_table()}</TableHead>
                    <TableHead className="text-right">{m.analyzer_col_total()}</TableHead>
                    <TableHead className="text-right">{m.analyzer_col_table()}</TableHead>
                    <TableHead className="text-right">{m.analyzer_col_indexes()}</TableHead>
                    <TableHead className="text-right">{m.analyzer_col_rows()}</TableHead>
                    <TableHead className="text-right">{m.analyzer_col_dead()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.sizes.map((r) => (
                    <TableRow key={r.table}>
                      <TableCell className="text-xs">{r.table}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.totalSize}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.tableSize}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.indexesSize}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.liveTuples.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.deadPct >= 20 ? (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                            {r.deadPct}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{r.deadPct}%</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard title={m.analyzer_redundant_title()} description={m.analyzer_redundant_desc()}>
            {report.redundant.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{m.analyzer_redundant_empty()}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.analyzer_col_index()}</TableHead>
                    <TableHead>{m.analyzer_col_columns()}</TableHead>
                    <TableHead>{m.analyzer_col_covered_by()}</TableHead>
                    <TableHead>{m.analyzer_col_recommendation()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.redundant.map((r) => (
                    <TableRow key={r.index}>
                      <TableCell className="font-mono text-xs">{r.index}</TableCell>
                      <TableCell className="text-xs">{r.columns}</TableCell>
                      <TableCell className="font-mono text-xs">{r.coveredBy}</TableCell>
                      <TableCell className="max-w-md">
                        <Reco sql={r.recommendation} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard title={m.analyzer_drift_title()} description={m.analyzer_drift_desc()}>
            {report.drift.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{m.analyzer_drift_empty()}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.analyzer_col_index()}</TableHead>
                    <TableHead>{m.analyzer_col_table()}</TableHead>
                    <TableHead>{m.analyzer_col_status()}</TableHead>
                    <TableHead>{m.analyzer_col_recommendation()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.drift.map((r) => (
                    <TableRow key={`${r.table}.${r.index}`}>
                      <TableCell className="font-mono text-xs">{r.index}</TableCell>
                      <TableCell className="text-xs">{r.table}</TableCell>
                      <TableCell>
                        {r.status === 'missing' ? (
                          <Badge variant="destructive">{m.analyzer_badge_missing()}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                            {m.analyzer_badge_extra()}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <Reco sql={r.recommendation} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
