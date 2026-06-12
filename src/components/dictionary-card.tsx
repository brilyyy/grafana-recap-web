import { Check, CircleCheck, Download, FileX, Loader2, Pencil, RefreshCw, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { TablePager } from '@/components/table-pager'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useApplications } from '@/hooks/useApplications'
import { cn } from '@/lib/utils'
import { trpc } from '@/router'
import type { DictionaryViewEntry } from '@/types'
import MultiSelectFilter from './multi-select-filter'

type ErrorType = 'S' | 'N' | 'Sukses'
const ERROR_TYPES: ErrorType[] = ['S', 'N', 'Sukses']

function ErrorTypeBadge({ errorType }: { errorType: string }) {
  switch (errorType) {
    case 'Sukses':
      return (
        <Badge variant="secondary">
          <span className="size-1.5 rounded-full bg-chart-2" />
          Sukses
        </Badge>
      )
    case 'S':
      return (
        <Badge variant="secondary">
          <span className="size-1.5 rounded-full bg-chart-4" />S
        </Badge>
      )
    case 'N':
      return <Badge variant="destructive">N</Badge>
    default:
      return <Badge variant="outline">{errorType || '—'}</Badge>
  }
}

export default function DictionaryCard() {
  const { applications } = useApplications()
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([])
  const [selectedErrorTypes, setSelectedErrorTypes] = useState<string[]>([])
  const [selectedJenisTransaksi, setSelectedJenisTransaksi] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingErrorType, setEditingErrorType] = useState<ErrorType | ''>('')
  const [editingDescriptionId, setEditingDescriptionId] = useState<number | null>(null)
  const [editingDescription, setEditingDescription] = useState('')
  const [bulkDescription, setBulkDescription] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
      setPage(1)
      setSelectedItems(new Set())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filterInput = useMemo(
    () => ({
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(selectedAppIds.length > 0 ? { app_ids: selectedAppIds.map(Number) } : {}),
      ...(selectedErrorTypes.length > 0 ? { error_types: selectedErrorTypes as ErrorType[] } : {}),
      ...(selectedJenisTransaksi.length > 0 ? { jenis_transaksi: selectedJenisTransaksi } : {}),
    }),
    [searchQuery, selectedAppIds, selectedErrorTypes, selectedJenisTransaksi],
  )

  const utils = trpc.useUtils()
  const listQuery = trpc.dictionary.list.useQuery({ ...filterInput, page, limit })
  const entries = (listQuery.data?.data?.entries ?? []) as DictionaryViewEntry[]
  const totalCount = listQuery.data?.data?.total ?? entries.length
  const totalPages = Math.ceil(totalCount / limit) || 1

  const jenisOptionsQuery = trpc.dictionary.jenisOptions.useQuery(
    selectedAppIds.length > 0 ? { app_ids: selectedAppIds.map(Number) } : undefined,
  )
  const uniqueJenisTransaksi = jenisOptionsQuery.data?.data?.options ?? []

  const updateErrorTypeMutation = trpc.dictionary.updateErrorType.useMutation()
  const updateDescriptionMutation = trpc.dictionary.updateDescription.useMutation()
  const updateDescriptionBatchMutation = trpc.dictionary.updateDescriptionBatch.useMutation()

  const refresh = () => utils.dictionary.list.invalidate()

  const handleUpdateErrorType = async (id: number) => {
    if (!editingErrorType) return
    try {
      const result = await updateErrorTypeMutation.mutateAsync({ id, error_type: editingErrorType })
      if (!result.success) throw new Error(result.message || 'Failed to update error type')
      toast.success(result.message || 'Error type updated')
      setEditingId(null)
      setEditingErrorType('')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update error type')
    }
  }

  const handleUpdateDescription = async (id: number) => {
    try {
      const result = await updateDescriptionMutation.mutateAsync({ id, rc_description: editingDescription })
      if (!result.success) throw new Error(result.message || 'Failed to update RC description')
      toast.success(result.message || 'RC description updated')
      setEditingDescriptionId(null)
      setEditingDescription('')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update RC description')
    }
  }

  const handleBulkUpdateDescription = async () => {
    if (selectedItems.size === 0 || !bulkDescription.trim()) {
      toast.error('Select entries and enter a description')
      return
    }
    try {
      const result = await updateDescriptionBatchMutation.mutateAsync({
        updates: [...selectedItems].map((id) => ({ id, rc_description: bulkDescription.trim() })),
      })
      if (!result.success) throw new Error(result.message || 'Failed to update RC descriptions')
      toast.success(result.message || `Updated ${selectedItems.size} RC description(s)`)
      setSelectedItems(new Set())
      setBulkDescription('')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update RC descriptions')
    }
  }

  const toggleItem = (id: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    setSelectedItems(selectedItems.size === entries.length ? new Set() : new Set(entries.map((entry) => entry.id)))
  }

  const exportToCSV = async () => {
    try {
      setExporting(true)
      const result = await utils.dictionary.list.fetch({ ...filterInput, fetch_all: true }, { staleTime: 0 })
      if (!result.success) throw new Error('Failed to load dictionary for export')

      const exportData = (result.data?.entries ?? []) as DictionaryViewEntry[]
      if (exportData.length === 0) {
        toast.error('No data to export with current filters')
        return
      }

      const headers = ['App Name', 'RC', 'RC Description', 'Error Type', 'Jenis Transaksi']
      const rows = exportData.map((entry) => [
        entry.app_name || '',
        entry.rc || '',
        entry.rc_description || '',
        entry.error_type || '',
        entry.jenis_transaksi || '',
      ])
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row
            .map((cell) => {
              const cellStr = String(cell).replace(/"/g, '""')
              return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') ? `"${cellStr}"` : cellStr
            })
            .join(','),
        ),
      ].join('\n')

      const blob = new Blob([`﻿${csvContent}`], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filterInfo = selectedAppIds.length > 0 ? `_app-${selectedAppIds.join('-')}` : ''
      link.setAttribute('href', url)
      link.setAttribute('download', `dictionary_export${filterInfo}_${timestamp}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${exportData.length} entries`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search RC, description, app…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-8 w-64 pl-8"
          />
        </div>
        <MultiSelectFilter
          label="App"
          options={applications.map((app) => ({ value: String(app.id), label: app.app_name }))}
          selectedValues={selectedAppIds}
          onChange={(values) => {
            setSelectedAppIds(values)
            setPage(1)
            setSelectedItems(new Set())
          }}
          searchPlaceholder="Search apps…"
        />
        <MultiSelectFilter
          label="Error Type"
          options={ERROR_TYPES.map((value) => ({ value, label: value }))}
          selectedValues={selectedErrorTypes}
          onChange={(values) => {
            setSelectedErrorTypes(values)
            setPage(1)
            setSelectedItems(new Set())
          }}
          searchPlaceholder="Search types…"
        />
        <MultiSelectFilter
          label="Jenis Transaksi"
          options={uniqueJenisTransaksi.map((jenis) => ({ value: jenis, label: jenis }))}
          selectedValues={selectedJenisTransaksi}
          onChange={(values) => {
            setSelectedJenisTransaksi(values)
            setPage(1)
            setSelectedItems(new Set())
          }}
          searchPlaceholder="Search jenis…"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={exporting || listQuery.isLoading}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
            <RefreshCw className={cn(listQuery.isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {selectedItems.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted px-3 py-2">
          <span className="text-sm tabular-nums">{selectedItems.size} selected</span>
          <Input
            placeholder="Description for selected entries…"
            value={bulkDescription}
            onChange={(e) => setBulkDescription(e.target.value)}
            className="h-8 max-w-md flex-1"
          />
          <Button
            size="sm"
            className="ml-auto"
            onClick={handleBulkUpdateDescription}
            disabled={updateDescriptionBatchMutation.isPending || !bulkDescription.trim()}
          >
            {updateDescriptionBatchMutation.isPending ? <Loader2 className="animate-spin" /> : <CircleCheck />}
            Update all ({selectedItems.size})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedItems(new Set())
              setBulkDescription('')
            }}
          >
            Clear
          </Button>
        </div>
      )}

      <Card className="py-0">
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 8 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : listQuery.error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Failed to load dictionary</AlertTitle>
                <AlertDescription>{listQuery.error.message}</AlertDescription>
              </Alert>
            </div>
          ) : entries.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileX />
                </EmptyMedia>
                <EmptyTitle>No dictionary entries found</EmptyTitle>
                <EmptyDescription>Adjust the filters or upload a dictionary document.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedItems.size === entries.length && entries.length > 0}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>RC</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Jenis Transaksi</TableHead>
                  <TableHead className="w-24 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} data-state={selectedItems.has(entry.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.has(entry.id)}
                        onCheckedChange={() => toggleItem(entry.id)}
                        aria-label={`Select RC ${entry.rc}`}
                      />
                    </TableCell>
                    <TableCell className="text-sm font-medium">{entry.app_name}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.rc || '—'}</TableCell>
                    <TableCell className="max-w-64">
                      {editingDescriptionId === entry.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editingDescription}
                            onChange={(e) => setEditingDescription(e.target.value)}
                            className="h-8"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateDescription(entry.id)
                              if (e.key === 'Escape') {
                                setEditingDescriptionId(null)
                                setEditingDescription('')
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => handleUpdateDescription(entry.id)}
                            disabled={updateDescriptionMutation.isPending}
                            title="Save"
                          >
                            {updateDescriptionMutation.isPending ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Check className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => {
                              setEditingDescriptionId(null)
                              setEditingDescription('')
                            }}
                            disabled={updateDescriptionMutation.isPending}
                            title="Cancel"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="group flex items-center gap-1">
                          <span className="truncate text-sm text-muted-foreground" title={entry.rc_description || ''}>
                            {entry.rc_description || '—'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 opacity-0 group-hover:opacity-100"
                            onClick={() => {
                              setEditingDescriptionId(entry.id)
                              setEditingDescription(entry.rc_description || '')
                            }}
                            disabled={editingDescriptionId !== null}
                            title="Edit description"
                          >
                            <Pencil className="size-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === entry.id ? (
                        <div className="flex gap-1">
                          {ERROR_TYPES.map((value) => (
                            <Button
                              key={value}
                              variant={editingErrorType === value ? 'default' : 'outline'}
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setEditingErrorType(value)}
                              disabled={updateErrorTypeMutation.isPending}
                            >
                              {value}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <ErrorTypeBadge errorType={entry.error_type} />
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {entry.jenis_transaksi || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === entry.id ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7"
                            onClick={() => handleUpdateErrorType(entry.id)}
                            disabled={!editingErrorType || updateErrorTypeMutation.isPending}
                          >
                            {updateErrorTypeMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => {
                              setEditingId(null)
                              setEditingErrorType('')
                            }}
                            disabled={updateErrorTypeMutation.isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => {
                            setEditingId(entry.id)
                            setEditingErrorType((entry.error_type as ErrorType) || '')
                          }}
                          disabled={editingId !== null}
                        >
                          <Pencil className="size-3" />
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TablePager
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
        onPageChange={(value) => {
          setPage(value)
          setSelectedItems(new Set())
        }}
        onLimitChange={(value) => {
          setLimit(value)
          setPage(1)
          setSelectedItems(new Set())
        }}
        disabled={listQuery.isFetching}
      />
    </div>
  )
}
