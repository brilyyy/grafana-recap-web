import { PlayIcon, RefreshCwIcon, StethoscopeIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { trpc } from '@/router'

// Kept local (string union) so this client component never imports the server-only engine module.
type Phase = 'schema' | 'fdw' | 'procedures' | 'seed' | 'cron' | 'all'
type DiagnoseStatus = 'ok' | 'missing' | 'drift' | 'error'
interface DiagnoseRow {
  category: string
  name: string
  status: DiagnoseStatus
  detail?: string
}

function getPhases(): { key: Phase; label: string; desc: string }[] {
  return [
    { key: 'all', label: 'Run all', desc: 'Schema, FDW, procedures, seeds, scheduler' },
    { key: 'schema', label: 'Schema', desc: 'Tables, columns, indexes, enums' },
    { key: 'fdw', label: 'FDW', desc: 'postgres_fdw foreign servers + tables' },
    { key: 'procedures', label: 'Procedures', desc: 'Stored procedures + recap models' },
    { key: 'seed', label: 'Seed', desc: 'Superadmin user(s)' },
    { key: 'cron', label: 'Scheduler', desc: 'scheduler_jobs table + seeded jobs' },
  ]
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    enum: 'Enums',
    table: 'Tables',
    column: 'Columns',
    index: 'Indexes',
    function: 'Functions',
    seed: 'Seeds',
  }
  return labels[category] ?? category
}

function StatusBadge({ status }: { status: DiagnoseStatus }) {
  switch (status) {
    case 'ok':
      return (
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
          {'OK'}
        </Badge>
      )
    case 'drift':
      return (
        <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
          {'DRIFT'}
        </Badge>
      )
    case 'missing':
      return <Badge variant="destructive">{'MISSING'}</Badge>
    default:
      return <Badge variant="destructive">{'ERROR'}</Badge>
  }
}

function DiagnoseTab() {
  const query = trpc.setup.diagnose.useQuery()
  const report = query.data?.data

  const grouped = (report?.rows ?? []).reduce<Record<string, DiagnoseRow[]>>((acc, row) => {
    ;(acc[row.category] ??= []).push(row)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {report ? (
            <span>
              {'Database'} <span className="font-mono font-medium text-foreground">{report.dbName}</span> ·{' '}
              <span className="text-emerald-600 dark:text-emerald-400">{`${report.summary.ok} OK`}</span> ·{' '}
              <span className="text-amber-600 dark:text-amber-400">{`${report.summary.drift} drift`}</span> ·{' '}
              <span className="text-destructive">
                {`${report.summary.missing + report.summary.error} missing/error`}
              </span>
            </span>
          ) : (
            'Read-only health check — executes no DDL.'
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? <Spinner className="size-3" /> : <RefreshCwIcon className="size-3" />}
          {'Re-run'}
        </Button>
      </div>

      {query.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
          <Spinner className="size-4" /> {'Running diagnostics…'}
        </div>
      ) : query.isError ? (
        <p className="py-4 text-xs text-destructive">{query.error.message}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([category, rows]) => (
            <div key={category} className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">{getCategoryLabel(category)}</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {rows.map((row) => (
                  <div
                    key={`${row.category}:${row.name}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5"
                  >
                    <span
                      className="truncate font-mono text-xs"
                      title={row.detail ? `${row.name} — ${row.detail}` : row.name}
                    >
                      {row.name}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface ConflictRow {
  key: string
  table: string
  column: string
  type: string
  rowCount: number
}

function MigrateTab() {
  const utils = trpc.useUtils()
  const [confirmPhase, setConfirmPhase] = useState<Phase | null>(null)
  const [steps, setSteps] = useState<string[]>([])
  const [resolutions, setResolutions] = useState<Record<string, 'null' | 'random'>>({})

  const preflight = trpc.setup.preflight.useQuery()
  const conflicts = (preflight.data?.data.conflicts ?? []) as ConflictRow[]

  const apply = trpc.setup.migrate.useMutation({
    onSuccess: (res) => {
      setSteps(res.data.steps)
      toast.success(res.message)
      utils.setup.diagnose.invalidate()
      utils.setup.preflight.invalidate()
    },
    onError: (err) => {
      toast.error(err.message || 'Migration failed')
      setSteps((prev) => [...prev, `Error: ${err.message}`])
    },
  })

  const dbName = utils.setup.diagnose.getData()?.data.dbName ?? 'the connected database'
  const runningPhase = apply.isPending ? (apply.variables?.phase as Phase | undefined) : undefined

  // Conflicts only matter for the schema-touching phases.
  const showConflicts = (confirmPhase === 'schema' || confirmPhase === 'all') && conflicts.length > 0
  const resolutionFor = (key: string): 'null' | 'random' => resolutions[key] ?? 'null'

  const runConfirmed = () => {
    if (!confirmPhase) return
    setSteps([])
    if (showConflicts) {
      const map: Record<string, 'null' | 'random'> = {}
      for (const c of conflicts) map[c.key] = resolutionFor(c.key)
      apply.mutate({ phase: confirmPhase, resolutions: map })
    } else {
      apply.mutate({ phase: confirmPhase })
    }
    setConfirmPhase(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        {
          'Each action runs the matching idempotent setup phase on the connected DB. Safe to re-run — existing objects get skipped.'
        }
      </p>

      {conflicts.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
          {`${conflicts.length} conflicts found. Choose`} <span className="font-medium">Null</span> {'or'}{' '}
          <span className="font-medium">Random</span> {'for each.'}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {getPhases().map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium">{p.label}</p>
              <p className="truncate text-xs text-muted-foreground">{p.desc}</p>
            </div>
            <Button
              variant={p.key === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-7 shrink-0 text-xs"
              disabled={apply.isPending}
              onClick={() => setConfirmPhase(p.key)}
            >
              {runningPhase === p.key ? <Spinner className="size-3" /> : <PlayIcon className="size-3" />}
              {'Run'}
            </Button>
          </div>
        ))}
      </div>

      {steps.length > 0 && (
        <ScrollArea className="h-56 rounded-md border bg-muted/30">
          <pre className="p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">{steps.join('\n')}</pre>
        </ScrollArea>
      )}

      <Dialog open={confirmPhase !== null} onOpenChange={(open) => !open && setConfirmPhase(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`Run "${confirmPhase ?? ''}" phase`}</DialogTitle>
            <DialogDescription>
              {'This executes DDL on'} <span className="font-mono font-medium text-foreground">{dbName}</span>
              {'. The phase is idempotent, but it does write to the database.'}
            </DialogDescription>
          </DialogHeader>

          {showConflicts && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium">{`${conflicts.length} conflicts require a resolution value`}</p>
              <ScrollArea className="max-h-56">
                <div className="flex flex-col gap-2 pr-3">
                  {conflicts.map((c) => (
                    <div key={c.key} className="rounded-md border border-border/60 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs">{c.key}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {`${c.rowCount.toLocaleString()} ${c.type} rows`}
                        </span>
                      </div>
                      <RadioGroup
                        value={resolutionFor(c.key)}
                        onValueChange={(v) => setResolutions((prev) => ({ ...prev, [c.key]: v as 'null' | 'random' }))}
                        className="mt-2 flex flex-row gap-4"
                      >
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="null" id={`${c.key}-null`} />
                          <Label htmlFor={`${c.key}-null`} className="text-xs font-normal">
                            Null
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="random" id={`${c.key}-random`} />
                          <Label htmlFor={`${c.key}-random`} className="text-xs font-normal">
                            Random
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPhase(null)}>
              {'Cancel'}
            </Button>
            <Button onClick={runConfirmed}>{'Run migration'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AppSetupPanel({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StethoscopeIcon className="size-4" />
          {'App Setup'}
        </CardTitle>
        <CardDescription>
          {'Diagnose schema/config drift and run idempotent database migrations. Superadmin only.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="diagnose">
          <TabsList>
            <TabsTrigger value="diagnose">{'Diagnose'}</TabsTrigger>
            <TabsTrigger value="migrate">{'Migrate'}</TabsTrigger>
          </TabsList>
          <TabsContent value="diagnose" className="pt-4">
            <DiagnoseTab />
          </TabsContent>
          <TabsContent value="migrate" className="pt-4">
            <MigrateTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
