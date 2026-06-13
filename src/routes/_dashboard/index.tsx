import { createFileRoute, Link } from '@tanstack/react-router'
import { BookOpen, LayoutGrid, type LucideIcon, ReceiptText, Unlink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { trpc } from '@/router'

export const Route = createFileRoute('/_dashboard/')({
  ssr: false,
  component: SummaryPage,
})

type ChartColor = 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5'

const accentIconClass: Record<ChartColor, string> = {
  'chart-1': 'text-chart-1',
  'chart-2': 'text-chart-2',
  'chart-3': 'text-chart-3',
  'chart-4': 'text-chart-4',
  'chart-5': 'text-chart-5',
}

const accentBgClass: Record<ChartColor, string> = {
  'chart-1': 'bg-chart-1/10',
  'chart-2': 'bg-chart-2/10',
  'chart-3': 'bg-chart-3/10',
  'chart-4': 'bg-chart-4/10',
  'chart-5': 'bg-chart-5/10',
}

interface StatCardProps {
  title: string
  value: number | undefined
  description: string
  to: string
  icon: LucideIcon
  attention?: boolean
  accent?: ChartColor
}

function StatCard({ title, value, description, to, icon: Icon, attention, accent = 'chart-1' }: StatCardProps) {
  return (
    <Link to={to} className="group cursor-pointer">
      <Card className="h-full group-hover:-translate-y-0.5 group-hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className={`flex size-7 items-center justify-center rounded-md ${accentBgClass[accent]}`}>
            <Icon className={`size-4 ${accentIconClass[accent]}`} />
          </div>
        </CardHeader>
        <CardContent>
          {value === undefined ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{value}</span>
              {attention && value > 0 && <Badge variant="destructive">needs review</Badge>}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case 'success':
      return (
        <Badge variant="secondary">
          <span className="size-1.5 rounded-full bg-chart-2" />
          success
        </Badge>
      )
    case 'failed':
      return <Badge variant="destructive">failed</Badge>
    case 'running':
      return <Badge variant="outline">running</Badge>
    default:
      return <Badge variant="outline">{status || '—'}</Badge>
  }
}

function SummaryPage() {
  const summaryQuery = trpc.system.summary.useQuery()
  const counts = summaryQuery.data?.data?.counts
  const recentLogs = summaryQuery.data?.data?.recentLogs ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Summary</h1>
        <p className="text-sm text-muted-foreground">Overview of success-rate data across applications.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Applications"
          value={counts?.applications}
          description="Registered applications"
          to="/application"
          icon={LayoutGrid}
          accent="chart-1"
        />
        <StatCard
          title="Dictionary entries"
          value={counts?.dictionaryEntries}
          description="Response-code mappings"
          to="/dictionary"
          icon={BookOpen}
          accent="chart-2"
        />
        <StatCard
          title="Unmapped RCs"
          value={counts?.unmappedRcs}
          description="Response codes awaiting classification"
          to="/unmapped-rc"
          icon={Unlink}
          accent="chart-5"
          attention
        />
        <StatCard
          title="No-RC transactions"
          value={counts?.noRcTransactions}
          description="Transactions without a response code"
          to="/transactions"
          icon={ReceiptText}
          accent="chart-4"
          attention
        />
      </div>

      <Card className="py-0">
        <CardHeader className="px-4 pt-4">
          <CardTitle className="text-base font-medium">Recent processing</CardTitle>
          <CardDescription>Latest recap runs across all applications.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {summaryQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentLogs.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ReceiptText />
                </EmptyMedia>
                <EmptyTitle>No processing runs yet</EmptyTitle>
                <EmptyDescription>Recap jobs will appear here once the scheduler runs.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Processing date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Processed</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Inserted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm font-medium">{log.app_name}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{String(log.processing_date ?? '—')}</TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="hidden text-right text-sm tabular-nums md:table-cell">
                      {log.records_processed ?? '—'}
                    </TableCell>
                    <TableCell className="hidden text-right text-sm tabular-nums md:table-cell">
                      {log.records_inserted ?? '—'}
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
