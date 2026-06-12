import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TablePagerProps {
  page: number
  totalPages: number
  totalCount: number
  limit: number
  limitOptions?: number[]
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  disabled?: boolean
}

export function TablePager({
  page,
  totalPages,
  totalCount,
  limit,
  limitOptions = [25, 50, 100],
  onPageChange,
  onLimitChange,
  disabled,
}: TablePagerProps) {
  const lastPage = Math.max(totalPages, 1)

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <span className="text-sm text-muted-foreground tabular-nums">{totalCount} total</span>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page</span>
        <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))} disabled={disabled}>
          <SelectTrigger size="sm" className="w-18">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {limitOptions.map((opt) => (
              <SelectItem key={opt} value={String(opt)}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-2 text-sm text-muted-foreground tabular-nums">
          Page {page} of {lastPage}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(1)}
          disabled={disabled || page <= 1}
        >
          <ChevronsLeft />
          <span className="sr-only">First page</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
        >
          <ChevronLeft />
          <span className="sr-only">Previous page</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= lastPage}
        >
          <ChevronRight />
          <span className="sr-only">Next page</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(lastPage)}
          disabled={disabled || page >= lastPage}
        >
          <ChevronsRight />
          <span className="sr-only">Last page</span>
        </Button>
      </div>
    </div>
  )
}
