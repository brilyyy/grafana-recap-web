import { TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface SkippedRow {
  rowNumber: number
  reason: string
}

interface SkippedRowsDialogProps {
  isOpen: boolean
  onClose: () => void
  skippedRows: SkippedRow[]
  totalSkipped: number
  totalProcessed: number
}

export function SkippedRowsDialog({
  isOpen,
  onClose,
  skippedRows,
  totalSkipped,
  totalProcessed,
}: SkippedRowsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Gagal — Row dengan Error Ditemukan</DialogTitle>
          <DialogDescription>
            {totalSkipped} row di-skip, {totalProcessed} row berhasil diproses
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <TriangleAlert />
          <AlertDescription>
            Upload dibatalkan. Silakan perbaiki error pada row berikut sebelum mengupload ulang.
          </AlertDescription>
        </Alert>

        <ScrollArea className="h-64 rounded-md border">
          <ul className="divide-y">
            {skippedRows.map((row) => (
              <li key={row.rowNumber} className="flex items-baseline gap-3 px-3 py-2">
                <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  Row {row.rowNumber}
                </span>
                <span className="text-sm break-words">{row.reason}</span>
              </li>
            ))}
          </ul>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
