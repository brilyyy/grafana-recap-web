import { CheckIcon, MonitorIcon, PaletteIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const FLAVORS = [
  { value: 'latte', label: 'Latte', swatch: '#8839ef', bg: '#eff1f5' },
  { value: 'frappe', label: 'Frappé', swatch: '#ca9ee6', bg: '#303446' },
  { value: 'macchiato', label: 'Macchiato', swatch: '#c6a0f6', bg: '#24273a' },
  { value: 'mocha', label: 'Mocha', swatch: '#cba6f7', bg: '#1e1e2e' },
  { value: 'kanagawa', label: 'Kanagawa', swatch: '#957FB8', bg: '#1F1F28' },
  { value: 'gruvbox', label: 'Gruvbox', swatch: '#ea6962', bg: '#1d2021' },
  { value: 'github-dark', label: 'GitHub Dark', swatch: '#58a6ff', bg: '#0d1117' },
  { value: 'github-light', label: 'GitHub Light', swatch: '#0969da', bg: '#ffffff' },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <Button variant="ghost" size="icon" className="size-8" disabled />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 cursor-pointer" title="Change theme">
          <PaletteIcon className="size-4" />
          <span className="sr-only">Change theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme('system')} className="flex cursor-pointer items-center gap-2">
          <MonitorIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span>System</span>
          {theme === 'system' && <CheckIcon className="ml-auto size-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {FLAVORS.map((f) => (
          <DropdownMenuItem
            key={f.value}
            onClick={() => setTheme(f.value)}
            className="flex cursor-pointer items-center gap-2"
          >
            {/* Swatch: outer circle = base color, inner dot = mauve accent */}
            <span
              className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-foreground/10"
              style={{ background: f.bg }}
            >
              <span className="block size-1.5 rounded-full" style={{ background: f.swatch }} />
            </span>
            <span>{f.label}</span>
            {theme === f.value && <CheckIcon className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
