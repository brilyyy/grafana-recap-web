import { createFileRoute } from '@tanstack/react-router'
import { DatabaseZap, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
      title={'Click to copy'}
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
          <h1 className="text-lg font-semibold tracking-tight">{'Index analyzer'}</h1>
          <p className="text-sm text-muted-foreground">
            {
              'Read-only index health from PostgreSQL runtime stats. Recommendations are copyable SQL — nothing gets executed.'
            }
            {report ? (
              <>
                {' '}
                {'Database'} <span className="font-mono text-foreground">{report.dbName}</span>.
              </>
            ) : null}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => query.refetch()}>
          {query.isFetching ? <Skeleton className="size-3 rounded-full" /> : <RefreshCw className="size-3" />}
          {'Re-run'}
        </Button>
      </header>

      {query.isLoading && <Skeleton className="h-40 w-full" />}

      {query.isError && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DatabaseZap />
            </EmptyMedia>
            <EmptyTitle>{'Analysis failed'}</EmptyTitle>
            <EmptyDescription>{query.error?.message ?? "Couldn't read index statistics."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard label={'Unused indexes'} value={String(report.summary.unused)} hint={'0 scans, droppable'} />
            <StatCard label={'Seq-scan tables'} value={String(report.summary.missing)} hint={'index candidates'} />
            <StatCard label={'Redundant'} value={String(report.summary.redundant)} hint={'prefix-covered'} />
            <StatCard
              label={'Drift: missing'}
              value={String(report.summary.driftMissing)}
              hint={'defined, not in DB'}
            />
            <StatCard label={'Drift: extra'} value={String(report.summary.driftExtra)} hint={'in DB, not in source'} />
          </div>

          <SectionCard
            title={'Unused indexes'}
            description={'idx_scan = 0 since the stats reset. Excludes primary/unique. Safe to drop.'}
          >
            {report.unused.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{'No unused indexes. 🎉'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{'Index'}</TableHead>
                    <TableHead>{'Table'}</TableHead>
                    <TableHead className="text-right">{'Size'}</TableHead>
                    <TableHead>{'Recommendation'}</TableHead>
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

          <SectionCard
            title={'Missing indexes (sequential scans)'}
            description={'Tables with seq scans ≥ index scans on > 1000 rows. Candidates for a new index.'}
          >
            {report.missing.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{'No seq-scan-heavy tables.'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{'Table'}</TableHead>
                    <TableHead className="text-right">{'Seq scans'}</TableHead>
                    <TableHead className="text-right">{'Idx scans'}</TableHead>
                    <TableHead className="text-right">{'Rows'}</TableHead>
                    <TableHead className="text-right">{'Size'}</TableHead>
                    <TableHead>{'Recommendation'}</TableHead>
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

          <SectionCard
            title={'Sizes & bloat'}
            description={"Largest relations. Dead-tuple % ≥ 20 means it's time for a VACUUM."}
          >
            {report.sizes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{'No tables.'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{'Table'}</TableHead>
                    <TableHead className="text-right">{'Total'}</TableHead>
                    <TableHead className="text-right">{'Table'}</TableHead>
                    <TableHead className="text-right">{'Indexes'}</TableHead>
                    <TableHead className="text-right">{'Rows'}</TableHead>
                    <TableHead className="text-right">{'Dead'}</TableHead>
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

          <SectionCard
            title={'Redundant indexes'}
            description={'Non-unique indexes whose columns are a leading prefix of another index on the same table.'}
          >
            {report.redundant.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{'No redundant indexes.'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{'Index'}</TableHead>
                    <TableHead>{'Columns'}</TableHead>
                    <TableHead>{'Covered by'}</TableHead>
                    <TableHead>{'Recommendation'}</TableHead>
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

          <SectionCard
            title={'Drift vs source'}
            description={
              'Indexes defined in src/db/sql/02_indexes but missing in the DB, or present in the DB but not in source.'
            }
          >
            {report.drift.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{'No drift — DB matches src/db/sql/.'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{'Index'}</TableHead>
                    <TableHead>{'Table'}</TableHead>
                    <TableHead>{'Status'}</TableHead>
                    <TableHead>{'Recommendation'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.drift.map((r) => (
                    <TableRow key={`${r.table}.${r.index}`}>
                      <TableCell className="font-mono text-xs">{r.index}</TableCell>
                      <TableCell className="text-xs">{r.table}</TableCell>
                      <TableCell>
                        {r.status === 'missing' ? (
                          <Badge variant="destructive">{'MISSING'}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                            {'EXTRA'}
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
