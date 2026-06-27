'use client'

import { sql } from '@codemirror/lang-sql'
import CodeMirror from '@uiw/react-codemirror'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const extensions = [sql()]

/**
 * Controlled CodeMirror 6 SQL editor — drop-in replacement for <Textarea>
 * in react-hook-form FormControl contexts.
 *
 * Renders client-side only to avoid SSR hydration mismatches with CodeMirror.
 */
export function SqlEditor({ value, onChange, onBlur, placeholder, className, disabled }: SqlEditorProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Render a plain textarea during SSR / before hydration so layout is stable
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flex w-full rounded-none border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          'min-h-48',
          className,
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-none border border-input bg-transparent text-xs focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      onBlur={onBlur}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        editable={!disabled}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
        }}
        style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono, monospace)', minHeight: '12rem' }}
      />
    </div>
  )
}
