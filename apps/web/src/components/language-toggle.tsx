import { CheckIcon, LanguagesIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages'
import { getLocale, locales, setLocale } from '@/paraglide/runtime'

type Locale = (typeof locales)[number]

const LOCALE_LABEL: Record<string, () => string> = {
  id: () => m.lang_id(),
  en: () => m.lang_en(),
}

/** Mounted-gated current locale (mirrors theme-toggle to avoid hydration mismatch). */
function useCurrentLocale() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return { mounted, locale: mounted ? getLocale() : null }
}

/** Dropdown entries for the nav-user menu. setLocale persists the cookie + reloads. */
export function LanguageMenuItems() {
  const { mounted, locale } = useCurrentLocale()
  return (
    <>
      <DropdownMenuLabel>{m.common_language()}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {locales.map((l) => (
        <DropdownMenuItem
          key={l}
          onSelect={() => setLocale(l as Locale)}
          className="flex cursor-pointer items-center gap-2"
        >
          <LanguagesIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span>{LOCALE_LABEL[l]?.() ?? l}</span>
          {mounted && locale === l && <CheckIcon className="ml-auto size-3.5" />}
        </DropdownMenuItem>
      ))}
    </>
  )
}

/** Settings-page radio list, styled like the theme picker. */
export function LanguageRadioGroup() {
  const { mounted, locale } = useCurrentLocale()
  const active = mounted ? locale : null
  return (
    <RadioGroup value={active ?? undefined} onValueChange={(v) => setLocale(v as Locale)} className="grid gap-2">
      {locales.map((l) => (
        <button
          type="button"
          key={l}
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors',
            active === l ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50',
          )}
          onClick={() => setLocale(l as Locale)}
        >
          <RadioGroupItem value={l} id={`locale-${l}`} />
          <Label htmlFor={`locale-${l}`} className="cursor-pointer text-sm font-medium">
            {LOCALE_LABEL[l]?.() ?? l}
          </Label>
        </button>
      ))}
    </RadioGroup>
  )
}
