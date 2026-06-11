import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SkippedRow {
  rowNumber: number
  reason: string
}

interface ErrorPopupProps {
  isOpen: boolean
  onClose: () => void
  skippedRows: SkippedRow[]
  totalSkipped: number
  totalProcessed: number
}

export default function ErrorPopup({ isOpen, onClose, skippedRows, totalSkipped, totalProcessed }: ErrorPopupProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Upload Gagal - Row dengan Error Ditemukan
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {totalSkipped} row di-skip, {totalProcessed} row berhasil diproses
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-400 font-medium">
              ⚠️ Upload dibatalkan. Silakan perbaiki error pada row berikut sebelum mengupload ulang.
            </p>
          </div>

          <ScrollArea className="h-64 pr-3">
            <div className="space-y-2">
              {skippedRows.map((row, index) => (
                <div
                  key={index}
                  className="p-3 bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-destructive">{row.rowNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground mb-1">Row {row.rowNumber}</p>
                      <p className="text-sm text-muted-foreground break-words">{row.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="destructive" onClick={onClose} className="w-full">
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
