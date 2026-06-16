import { createFileRoute } from '@tanstack/react-router'
import { MonitorIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useAuthSession } from '@/hooks/use-auth-session'
import { useBackgroundMode } from '@/hooks/use-background-mode'
import { cn } from '@/lib/utils'
import { AppSetupPanel } from './-components/app-setup-panel'

export const Route = createFileRoute('/_dashboard/settings')({
  ssr: false,
  component: SettingsPage,
})

const FLAVORS = [
  {
    value: 'latte',
    label: 'Latte',
    description: 'Light, warm pastels',
    swatch: '#8839ef',
    bg: '#eff1f5',
    accent: '#ccd0da',
  },
  {
    value: 'frappe',
    label: 'Frappé',
    description: 'Muted dark with cool tones',
    swatch: '#ca9ee6',
    bg: '#303446',
    accent: '#414559',
  },
  {
    value: 'macchiato',
    label: 'Macchiato',
    description: 'Deeper dark, vivid accents',
    swatch: '#c6a0f6',
    bg: '#24273a',
    accent: '#363a4f',
  },
  {
    value: 'mocha',
    label: 'Mocha',
    description: 'Darkest, richest contrast',
    swatch: '#cba6f7',
    bg: '#1e1e2e',
    accent: '#313244',
  },
] as const

function ThemeSwatch({ bg, accent, swatch }: { bg: string; accent: string; swatch: string }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-foreground/10"
      style={{ background: bg }}
    >
      <span
        className="flex size-4 items-center justify-center rounded-sm"
        style={{ background: accent }}
      >
        <span className="block size-2 rounded-full" style={{ background: swatch }} />
      </span>
    </span>
  )
}

function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { bgMode, setBgMode } = useBackgroundMode()
  const { user } = useAuthSession()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted ? (theme ?? 'system') : 'system'

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Customize your workspace appearance
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your color theme and background style</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* ── Theme flavor ──────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Theme</p>
            <RadioGroup
              value={activeTheme}
              onValueChange={setTheme}
              className="grid gap-2"
            >
              {/* System */}
              <div
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                  activeTheme === 'system'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent/50',
                )}
                onClick={() => setTheme('system')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTheme('system')}
              >
                <RadioGroupItem value="system" id="theme-system" />
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border"
                >
                  <MonitorIcon className="size-4 text-muted-foreground" />
                </span>
                <Label htmlFor="theme-system" className="cursor-pointer flex-col items-start gap-0">
                  <span className="text-sm font-medium">System</span>
                  <span className="text-xs text-muted-foreground">Follow OS preference — Latte / Mocha</span>
                </Label>
              </div>

              {/* Flavors */}
              {FLAVORS.map((f) => (
                <div
                  key={f.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                    activeTheme === f.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/50',
                  )}
                  onClick={() => setTheme(f.value)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTheme(f.value)}
                >
                  <RadioGroupItem value={f.value} id={`theme-${f.value}`} />
                  <ThemeSwatch bg={f.bg} accent={f.accent} swatch={f.swatch} />
                  <Label
                    htmlFor={`theme-${f.value}`}
                    className="cursor-pointer flex-col items-start gap-0"
                  >
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* ── Background ────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Animated background</p>
              <p className="text-xs text-muted-foreground">
                Show a space-star field behind the dashboard.
                Disabled automatically when OS requests reduced motion.
              </p>
            </div>
            <Switch
              checked={bgMode === 'animated'}
              onCheckedChange={(checked) => setBgMode(checked ? 'animated' : 'solid')}
              aria-label="Toggle animated background"
            />
          </div>
        </CardContent>
      </Card>

      {user?.role === 'superadmin' && <AppSetupPanel />}
    </div>
  )
}
