import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Play, Presentation, Settings2, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
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
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { m } from '@/paraglide/messages'
import { trpc } from '@/router'

export const Route = createFileRoute('/_dashboard/generator')({
  ssr: false,
  component: GeneratorPage,
})

type MappingFormValues = {
  generate_from: 'db' | 'excel'
  fields: Record<string, string>
  success_type_format: string[]
  error_type_format: Record<string, string[]>
  ignore_errors: string[]
  ignore_features: string[]
}

const DB_DEFAULTS: Record<string, string> = {
  date: 'tanggal_transaksi',
  response_code: 'rc',
  response_code_desc: 'rc_description',
  error_type: 'error_type',
  trx_count: 'total_transaksi',
  trx_feature: 'jenis_transaksi',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function GeneratorPage() {
  const utils = trpc.useUtils()

  // Health
  const healthQuery = trpc.generator.health.useQuery()
  const isHealthy = healthQuery.data?.status === 'ok'

  // Apps
  const appsQuery = trpc.generator.listApps.useQuery()
  const apps = appsQuery.data ?? []

  // Selected app
  const [selectedAppId, setSelectedAppId] = useState<string>('')
  const selectedApp = useMemo(() => apps.find((app) => app.app_id === selectedAppId), [apps, selectedAppId])

  // Mapping status
  const mappingsQuery = trpc.generator.listMappings.useQuery()
  const mappings = mappingsQuery.data ?? []
  const currentMapping = useMemo(
    () => mappings.find((mapping) => mapping.app_id === selectedAppId),
    [mappings, selectedAppId],
  )

  // Date range
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))

  // Generate
  const [isGenerating, setIsGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Reports
  const reportsQuery = trpc.generator.listReports.useQuery()
  const reports = reportsQuery.data ?? []

  // Delete report
  const deleteReportMutation = trpc.generator.deleteReport.useMutation({
    onSuccess: () => {
      toast.success('Report deleted')
      utils.generator.listReports.invalidate()
    },
    onError: (e) => toast.error(e.message || 'Failed to delete report'),
  })

  // Generate DB
  const generateDbMutation = trpc.generator.generateDb.useMutation({
    onSuccess: (data) => {
      toast.success(data.message)
      utils.generator.listReports.invalidate()
    },
    onError: (e) => toast.error(e.message || 'Generation failed'),
    onSettled: () => setIsGenerating(false),
  })

  // Mapping config dialog
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [ignoreErrorsInput, setIgnoreErrorsInput] = useState('')
  const [ignoreFeaturesInput, setIgnoreFeaturesInput] = useState('')
  const [successTypeInput, setSuccessTypeInput] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const existingMapping = useMemo(
    () => mappings.find((mapping) => mapping.app_id === selectedAppId),
    [mappings, selectedAppId],
  )

  const mappingValues: MappingFormValues = useMemo(
    () => ({
      generate_from: (existingMapping?.generate_from as 'db' | 'excel') ?? 'db',
      fields: (existingMapping as any)?.fields ?? { ...DB_DEFAULTS },
      success_type_format: (existingMapping as any)?.success_type_format ?? ['Sukses'],
      error_type_format: (existingMapping as any)?.error_type_format ?? {
        system_error: ['S', '#N/A'],
        business_error: ['N', 'B'],
      },
      ignore_errors: (existingMapping as any)?.ignore_errors ?? [],
      ignore_features: (existingMapping as any)?.ignore_features ?? [],
    }),
    [existingMapping],
  )

  const [mappingFormValues, setMappingFormValues] = useState<MappingFormValues>(mappingValues)

  // Reset form when dialog opens with new app
  function openMappingDialog() {
    setMappingFormValues({ ...mappingValues })
    setMappingDialogOpen(true)
  }

  const upsertMappingMutation = trpc.appMappings.upsert.useMutation({
    onSuccess: () => {
      toast.success('Mapping saved')
      setMappingDialogOpen(false)
      utils.generator.listMappings.invalidate()
    },
    onError: (e) => toast.error(e.message || 'Failed to save mapping'),
  })

  function handleSaveMapping() {
    if (!selectedAppId) return
    upsertMappingMutation.mutate({
      id_app_identifier: Number(selectedAppId),
      generate_from: mappingFormValues.generate_from,
      fields: mappingFormValues.fields,
      success_type_format: mappingFormValues.success_type_format,
      error_type_format: mappingFormValues.error_type_format,
      ignore_errors: mappingFormValues.ignore_errors,
      ignore_features: mappingFormValues.ignore_features,
    })
  }

  function addToList(
    key: 'ignore_errors' | 'ignore_features' | 'success_type_format',
    value: string,
    setter: (v: string) => void,
  ) {
    const v = value.trim()
    if (!v) return
    const current = mappingFormValues[key]
    if (!current.includes(v)) {
      setMappingFormValues({ ...mappingFormValues, [key]: [...current, v] })
    }
    setter('')
  }

  function removeFromList(key: 'ignore_errors' | 'ignore_features' | 'success_type_format', value: string) {
    setMappingFormValues({
      ...mappingFormValues,
      [key]: mappingFormValues[key].filter((x) => x !== value),
    })
  }

  async function handleGenerateDb() {
    if (!selectedApp || !selectedAppId) return
    setIsGenerating(true)
    generateDbMutation.mutate({
      app_name: selectedApp.app_name,
      app_id: selectedAppId,
      master_date_from: dateFrom,
      master_date_to: dateTo,
    })
  }

  async function handleGenerateExcel() {
    if (!selectedApp || !selectedAppId || !selectedFile) return
    setIsGenerating(true)
    try {
      const form = new FormData()
      form.append('app_name', selectedApp.app_name)
      form.append('app_id', selectedAppId)
      form.append('file', selectedFile)
      const data = await utils.client.generator.generateExcel.mutate(form)
      toast.success(data.message)
      utils.generator.listReports.invalidate()
    } catch (e: any) {
      toast.error(e.message || 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <div className="flex items-center gap-2">
          <Presentation className="size-5" />
          <h1 className="text-lg font-semibold tracking-tight">{m.gen_title()}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{m.gen_subtitle()}</p>
      </header>

      {/* Health status */}
      {healthQuery.isLoading ? (
        <Skeleton className="h-9 w-48" />
      ) : (
        <Badge variant={isHealthy ? 'secondary' : 'destructive'}>
          {isHealthy ? m.gen_health_ok() : m.gen_health_offline()}
        </Badge>
      )}

      {/* Generate section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{m.gen_title()}</CardTitle>
          <CardDescription>{m.gen_subtitle()}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* App selector */}
          <div className="flex flex-col gap-2">
            <FormLabel>{m.gen_select_app()}</FormLabel>
            <Select value={selectedAppId} onValueChange={setSelectedAppId}>
              <SelectTrigger>
                <SelectValue placeholder={m.gen_select_app()} />
              </SelectTrigger>
              <SelectContent>
                {apps.map((appItem) => (
                  <SelectItem key={appItem.app_id} value={appItem.app_id}>
                    {appItem.app_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mapping status */}
          {selectedAppId && (
            <div className="flex items-center gap-2">
              <Badge variant={currentMapping ? 'secondary' : 'outline'}>
                {currentMapping ? m.gen_mapping_configured() : m.gen_mapping_not_configured()}
              </Badge>
              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={openMappingDialog}>
                <Settings2 className="size-3" />
                {m.gen_configure_mapping()}
              </Button>
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <FormLabel className="text-xs">{m.gen_date_from()}</FormLabel>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <FormLabel className="text-xs">{m.gen_date_to()}</FormLabel>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          {/* Generate buttons */}
          <div className="flex gap-2">
            <Button onClick={handleGenerateDb} disabled={!selectedAppId || isGenerating} className="gap-1.5">
              {isGenerating ? <Loader2 className="animate-spin" /> : <Play className="size-3.5" />}
              {m.gen_generate_db()}
            </Button>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedAppId}
                className="gap-1.5"
              >
                <Upload className="size-3.5" />
                {m.gen_upload_excel()}
              </Button>
              {selectedFile && <span className="text-xs text-muted-foreground">{selectedFile.name}</span>}
            </div>
            {selectedFile && (
              <Button onClick={handleGenerateExcel} disabled={!selectedAppId || isGenerating} className="gap-1.5">
                {isGenerating ? <Loader2 className="animate-spin" /> : <Play className="size-3.5" />}
                {m.gen_generate_excel()}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reports list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{m.gen_reports_title()}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reportsQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 3 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Presentation />
                </EmptyMedia>
                <EmptyTitle>{m.gen_reports_empty()}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.gen_col_filename()}</TableHead>
                  <TableHead>{m.gen_col_generated()}</TableHead>
                  <TableHead>{m.gen_col_size()}</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((reportItem) => (
                  <TableRow key={reportItem.filename}>
                    <TableCell className="font-mono text-xs">{reportItem.filename}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{String(reportItem.created_at)}</TableCell>
                    <TableCell className="text-xs tabular-nums">{formatSize(reportItem.size_bytes)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive"
                        onClick={() => deleteReportMutation.mutate({ filename: reportItem.filename })}
                        disabled={deleteReportMutation.isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mapping config dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{m.gen_configure_mapping()}</DialogTitle>
            <DialogDescription>
              Configure how sr-generator reads data for {selectedApp?.app_name ?? 'this app'}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
            {/* generate_from */}
            <div className="flex flex-col gap-1">
              <FormLabel>{m.appcfg_generate_from_label()}</FormLabel>
              <Select
                value={mappingFormValues.generate_from}
                onValueChange={(v) => {
                  const newValues = { ...mappingFormValues, generate_from: v as 'db' | 'excel' }
                  if (v === 'db') newValues.fields = { ...DB_DEFAULTS }
                  setMappingFormValues(newValues)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="db">Database</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-2">
              <FormLabel>{m.appcfg_fields_title()}</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {(
                  ['date', 'response_code', 'response_code_desc', 'error_type', 'trx_count', 'trx_feature'] as const
                ).map((key) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">{key}</span>
                    <Input
                      className="font-mono text-xs"
                      value={mappingFormValues.fields[key] ?? ''}
                      onChange={(e) =>
                        setMappingFormValues({
                          ...mappingFormValues,
                          fields: { ...mappingFormValues.fields, [key]: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Success type format */}
            <div className="flex flex-col gap-1">
              <FormLabel>{m.appcfg_success_type_label()}</FormLabel>
              <div className="flex flex-wrap gap-1">
                {mappingFormValues.success_type_format.map((val) => (
                  <Badge key={val} variant="secondary" className="gap-1">
                    {val}
                    <button
                      type="button"
                      onClick={() => removeFromList('success_type_format', val)}
                      className="ml-0.5 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={successTypeInput}
                  onChange={(e) => setSuccessTypeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToList('success_type_format', successTypeInput, setSuccessTypeInput)
                    }
                  }}
                  placeholder="e.g. Sukses, A"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addToList('success_type_format', successTypeInput, setSuccessTypeInput)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Ignore errors */}
            <div className="flex flex-col gap-1">
              <FormLabel>{m.appcfg_ignore_errors_label()}</FormLabel>
              <div className="flex flex-wrap gap-1">
                {mappingFormValues.ignore_errors.map((val) => (
                  <Badge key={val} variant="secondary" className="gap-1">
                    {val}
                    <button
                      type="button"
                      onClick={() => removeFromList('ignore_errors', val)}
                      className="ml-0.5 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={ignoreErrorsInput}
                  onChange={(e) => setIgnoreErrorsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToList('ignore_errors', ignoreErrorsInput, setIgnoreErrorsInput)
                    }
                  }}
                  placeholder="RC to ignore"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addToList('ignore_errors', ignoreErrorsInput, setIgnoreErrorsInput)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Ignore features */}
            <div className="flex flex-col gap-1">
              <FormLabel>{m.appcfg_ignore_features_label()}</FormLabel>
              <div className="flex flex-wrap gap-1">
                {mappingFormValues.ignore_features.map((val) => (
                  <Badge key={val} variant="secondary" className="gap-1">
                    {val}
                    <button
                      type="button"
                      onClick={() => removeFromList('ignore_features', val)}
                      className="ml-0.5 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={ignoreFeaturesInput}
                  onChange={(e) => setIgnoreFeaturesInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToList('ignore_features', ignoreFeaturesInput, setIgnoreFeaturesInput)
                    }
                  }}
                  placeholder="Feature to ignore"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addToList('ignore_features', ignoreFeaturesInput, setIgnoreFeaturesInput)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Advanced: error_type_format */}
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? '▾ Hide' : '▸ Show'} advanced
              </Button>
              {showAdvanced && (
                <div className="mt-2 flex flex-col gap-2 rounded border p-3">
                  <FormLabel>{m.appcfg_error_type_label()}</FormLabel>
                  {Object.entries(mappingFormValues.error_type_format).map(([key, values]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-32 text-xs text-muted-foreground">{key}</span>
                      <Input
                        className="font-mono text-xs"
                        value={values.join(', ')}
                        onChange={(e) => {
                          const parsed = e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                          setMappingFormValues({
                            ...mappingFormValues,
                            error_type_format: { ...mappingFormValues.error_type_format, [key]: parsed },
                          })
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              {m.common_cancel()}
            </Button>
            <Button onClick={handleSaveMapping} disabled={upsertMappingMutation.isPending}>
              {upsertMappingMutation.isPending && <Loader2 className="animate-spin" />}
              {m.common_save()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
