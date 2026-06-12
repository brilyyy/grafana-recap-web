import { CircleCheck, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useApplications } from '@/hooks/useApplications'
import { cn } from '@/lib/utils'
import { trpc } from '@/router'
import type { UnmappedRC } from '@/types'

type ErrorType = 'S' | 'N' | 'Sukses'
const ERROR_TYPES: ErrorType[] = ['S', 'N', 'Sukses']

export default function UnmappedRcCard() {
  const { applications } = useApplications()
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null)
  const [selectedErrorTypes, setSelectedErrorTypes] = useState<Record<number, ErrorType>>({})
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  const utils = trpc.useUtils()
  const listQuery = trpc.unmappedRc.list.useQuery({
    fetch_all: true,
    ...(selectedAppId ? { app_id: selectedAppId } : {}),
  })
  const unmappedRcs = (listQuery.data?.data?.entries ?? []) as UnmappedRC[]

  const submitMutation = trpc.unmappedRc.submit.useMutation()
  const submitBatchMutation = trpc.unmappedRc.submitBatch.useMutation()

  const resetSelections = () => {
    setSelectedItems(new Set())
    setSelectedErrorTypes({})
  }

  const handleErrorTypeChange = (id: number, value: ErrorType) => {
    setSelectedErrorTypes((prev) => ({ ...prev, [id]: value }))
    setSelectedItems((prev) => new Set(prev).add(id))
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
    setSelectedItems(selectedItems.size === unmappedRcs.length ? new Set() : new Set(unmappedRcs.map((rc) => rc.id)))
  }

  const afterSubmit = () => {
    utils.unmappedRc.list.invalidate()
    utils.dictionary.invalidate()
  }

  const readyCount = unmappedRcs.filter((rc) => selectedItems.has(rc.id) && selectedErrorTypes[rc.id]).length

  const handleSubmitAll = async () => {
    const items = unmappedRcs.filter((rc) => selectedItems.has(rc.id) && selectedErrorTypes[rc.id])
    if (items.length === 0) {
      toast.error('Select at least one RC with an error type')
      return
    }
    try {
      const result = await submitBatchMutation.mutateAsync({
        items: items.map((rc) => ({
          id: rc.id,
          id_app_identifier: rc.id_app_identifier,
          jenis_transaksi: rc.jenis_transaksi,
          rc: rc.rc ?? '',
          error_type: selectedErrorTypes[rc.id],
        })),
      })
      if (!result.success) throw new Error(result.message || 'Failed to submit mappings')
      toast.success(result.message || `Mapped ${items.length} RC(s)`)
      resetSelections()
      afterSubmit()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit mappings')
    }
  }

  const handleSubmit = async (rc: UnmappedRC) => {
    const errorType = selectedErrorTypes[rc.id]
    if (!errorType) {
      toast.error('Select an error type (S/N/Sukses) first')
      return
    }
    try {
      setSubmittingId(rc.id)
      const result = await submitMutation.mutateAsync({
        id: rc.id,
        id_app_identifier: rc.id_app_identifier,
        jenis_transaksi: rc.jenis_transaksi,
        rc: rc.rc ?? '',
        error_type: errorType,
      })
      if (!result.success) throw new Error(result.message || 'Failed to submit mapping')
      toast.success(result.message)
      setSelectedErrorTypes((prev) => {
        const next = { ...prev }
        delete next[rc.id]
        return next
      })
      setSelectedItems((prev) => {
        const next = new Set(prev)
        next.delete(rc.id)
        return next
      })
      afterSubmit()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit mapping')
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedAppId === null ? 'all' : String(selectedAppId)}
          onValueChange={(value) => {
            setSelectedAppId(value === 'all' ? null : Number(value))
            resetSelections()
          }}
        >
          <SelectTrigger size="sm" className="w-56">
            <SelectValue placeholder="All applications" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All applications</SelectItem>
            {applications.map((app) => (
              <SelectItem key={app.id} value={String(app.id)}>
                {app.app_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground tabular-nums">
          {listQuery.isLoading ? 'Loading…' : `${unmappedRcs.length} unmapped`}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => listQuery.refetch()}
          disabled={listQuery.isFetching}
        >
          <RefreshCw className={cn(listQuery.isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {selectedItems.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted px-3 py-2">
          <span className="text-sm tabular-nums">
            {selectedItems.size} selected, {readyCount} ready to submit
          </span>
          <Button
            size="sm"
            className="ml-auto"
            onClick={handleSubmitAll}
            disabled={submitBatchMutation.isPending || readyCount === 0}
          >
            {submitBatchMutation.isPending ? <Loader2 className="animate-spin" /> : <CircleCheck />}
            Submit {readyCount > 0 ? `(${readyCount})` : ''}
          </Button>
          <Button variant="ghost" size="sm" onClick={resetSelections}>
            Clear
          </Button>
        </div>
      )}

      <Card className="py-0">
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : listQuery.error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Failed to load unmapped RCs</AlertTitle>
                <AlertDescription>{listQuery.error.message}</AlertDescription>
              </Alert>
            </div>
          ) : unmappedRcs.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CircleCheck />
                </EmptyMedia>
                <EmptyTitle>Semua RC sudah dimapping</EmptyTitle>
                <EmptyDescription>New unmapped response codes will appear here after uploads.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedItems.size === unmappedRcs.length && unmappedRcs.length > 0}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>RC</TableHead>
                  <TableHead>Jenis Transaksi</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead className="w-28 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmappedRcs.map((rc) => (
                  <TableRow key={rc.id} data-state={selectedItems.has(rc.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.has(rc.id)}
                        onCheckedChange={() => toggleItem(rc.id)}
                        aria-label={`Select RC ${rc.rc}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rc.app_name}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{rc.rc}</TableCell>
                    <TableCell className="text-sm">{rc.jenis_transaksi || '—'}</TableCell>
                    <TableCell className="hidden max-w-64 truncate text-sm text-muted-foreground md:table-cell">
                      {rc.rc_description || 'No description'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {ERROR_TYPES.map((value) => (
                          <Button
                            key={value}
                            variant={selectedErrorTypes[rc.id] === value ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleErrorTypeChange(rc.id, value)}
                          >
                            {value}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7"
                        onClick={() => handleSubmit(rc)}
                        disabled={!selectedErrorTypes[rc.id] || submittingId === rc.id || submitBatchMutation.isPending}
                      >
                        {submittingId === rc.id ? <Loader2 className="animate-spin" /> : null}
                        Submit
                      </Button>
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
