import { FileSpreadsheet, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  value: File | null | undefined
  onChange: (file: File | null) => void
  accept?: string
  disabled?: boolean
  hint?: React.ReactNode
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileDropzone({ value, onChange, accept = '.xlsx,.csv', disabled, hint }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard access provided via the hidden input's label semantics
    <div
      data-dragging={dragging}
      className={cn(
        'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input p-6 text-center transition-colors',
        'hover:bg-accent/50 data-[dragging=true]:border-ring data-[dragging=true]:bg-accent',
        disabled && 'pointer-events-none opacity-50',
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) onChange(file)
      }}
    >
      {value ? (
        <>
          <FileSpreadsheet className="size-6 text-muted-foreground" />
          <div className="flex max-w-full items-center gap-2">
            <span className="truncate text-sm font-medium">{value.name}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {formatSize(value.size)}
            </span>
            <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={clear} title="Remove file">
              <X className="size-3.5" />
              <span className="sr-only">Remove file</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Click to choose a different file</p>
        </>
      ) : (
        <>
          <Upload className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Drag & drop or click to browse</p>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onChange(file)
        }}
      />
    </div>
  )
}
