import { CircleCheck, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { TablePager } from '@/components/table-pager'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useApplications } from '@/hooks/useApplications'
import { cn } from '@/lib/utils'
import { trpc } from '@/router'
import type { SuccessRateEntry } from '@/types'

export default function NoRcTransactionCard() {
  const { applications } = useApplications()
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [editingRc, setEditingRc] = useState<Record<number, string>>({})
  const [editingRcDescription, setEditingRcDescription] = useState<Record<number, string>>({})
  const [bulkRc, setBulkRc] = useState('')
  const [bulkRcDescription, setBulkRcDescription] = useState('')
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  const utils = trpc.useUtils()
  const listQuery = trpc.noRcTransaction.list.useQuery({
    page,
    limit,
    ...(selectedAppId ? { app_id: selectedAppId } : {}),
  })
  const transactions = (listQuery.data?.data?.entries ?? []) as SuccessRateEntry[]
  const totalCount = listQuery.data?.data?.total ?? 0
  const totalPages = Math.ceil(totalCount / limit) || 1

  const submitMutation = trpc.noRcTransaction.submit.useMutation()
  const submitBatchMutation = trpc.noRcTransaction.submitBatch.useMutation()

  const resetSelections = () => {
    setSelectedItems(new Set())
    setBulkRc('')
    setBulkRcDescription('')
  }

  const afterSubmit = () => {
    utils.noRcTransaction.list.invalidate()
    utils.unmappedRc.list.invalidate()
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
    setSelectedItems(
      selectedItems.size === transactions.length
        ? new Set()
        : new Set(transactions.map((t) => t.id).filter((id): id is number => id !== undefined)),
    )
  }

  const handleSubmit = async (transaction: SuccessRateEntry) => {
    const id = transaction.id
    if (id === undefined) return
    const rc = editingRc[id]?.trim() || ''
    if (!rc) {
      toast.error('RC is required')
      return
    }
    try {
      setSubmittingId(id)
      const result = await submitMutation.mutateAsync({
        id,
        rc,
        rc_description: editingRcDescription[id]?.trim() || null,
      })
      if (!result.success) throw new Error(result.message || 'Failed to assign RC')
      toast.success(result.message || 'RC assigned')
      setEditingRc((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setEditingRcDescription((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      afterSubmit()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign RC')
    } finally {
      setSubmittingId(null)
    }
  }

  const handleSubmitAll = async () => {
    if (selectedItems.size === 0 || !bulkRc.trim()) {
      toast.error('Select at least one transaction and provide an RC')
      return
    }
    try {
      const result = await submitBatchMutation.mutateAsync({
        items: [...selectedItems].map((id) => ({
          id,
          rc: bulkRc.trim(),
          rc_description: bulkRcDescription.trim() || null,
        })),
      })
      if (!result.success) throw new Error(result.message || 'Failed to assign RCs')
      toast.success(result.message || `Assigned RC to ${selectedItems.size} transaction(s)`)
      resetSelections()
      afterSubmit()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign RCs')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedAppId === null ? 'all' : String(selectedAppId)}
          onValueChange={(value) => {
            setSelectedAppId(value === 'all' ? null : Number(value))
            setPage(1)
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted px-3 py-2">
          <span className="text-sm tabular-nums">{selectedItems.size} selected</span>
          <Input
            placeholder="RC (required)"
            value={bulkRc}
            onChange={(e) => setBulkRc(e.target.value)}
            className="h-8 w-40"
          />
          <Input
            placeholder="RC description (optional)"
            value={bulkRcDescription}
            onChange={(e) => setBulkRcDescription(e.target.value)}
            className="h-8 w-56"
          />
          <Button
            size="sm"
            className="ml-auto"
            onClick={handleSubmitAll}
            disabled={submitBatchMutation.isPending || !bulkRc.trim()}
          >
            {submitBatchMutation.isPending ? <Loader2 className="animate-spin" /> : <CircleCheck />}
            Update all ({selectedItems.size})
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
                <AlertTitle>Failed to load transactions</AlertTitle>
                <AlertDescription>{listQuery.error.message}</AlertDescription>
              </Alert>
            </div>
          ) : transactions.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CircleCheck />
                </EmptyMedia>
                <EmptyTitle>No transactions without RC</EmptyTitle>
                <EmptyDescription>Every transaction currently has a response code assigned.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedItems.size === transactions.length && transactions.length > 0}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Jenis Transaksi</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Total</TableHead>
                  <TableHead>RC</TableHead>
                  <TableHead className="hidden lg:table-cell">RC description</TableHead>
                  <TableHead className="w-28 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => {
                  const id = transaction.id
                  if (id === undefined) return null
                  const rcValue = editingRc[id] ?? ''
                  return (
                    <TableRow key={id} data-state={selectedItems.has(id) ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.has(id)}
                          onCheckedChange={() => toggleItem(id)}
                          aria-label="Select transaction"
                        />
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{String(transaction.tanggal_transaksi ?? '—')}</TableCell>
                      <TableCell className="max-w-48 truncate text-sm">{transaction.jenis_transaksi}</TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {transaction.status_transaksi || '—'}
                      </TableCell>
                      <TableCell className="hidden text-right text-sm tabular-nums md:table-cell">
                        {transaction.total_transaksi || 0}
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="RC"
                          value={rcValue}
                          onChange={(e) => setEditingRc((prev) => ({ ...prev, [id]: e.target.value }))}
                          className="h-8 w-24 font-mono text-xs"
                        />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Input
                          placeholder="Description (optional)"
                          value={editingRcDescription[id] ?? ''}
                          onChange={(e) => setEditingRcDescription((prev) => ({ ...prev, [id]: e.target.value }))}
                          className="h-8 w-full min-w-40"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7"
                          onClick={() => handleSubmit(transaction)}
                          disabled={!rcValue.trim() || submittingId === id || submitBatchMutation.isPending}
                        >
                          {submittingId === id ? <Loader2 className="animate-spin" /> : null}
                          Update
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
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
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value)
          setPage(1)
        }}
        disabled={listQuery.isFetching}
      />
    </div>
  )
}
