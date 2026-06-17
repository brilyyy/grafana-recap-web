/**
 * Locale-aware formatting helpers. Map the active Paraglide locale to a BCP-47 tag so
 * dates/numbers follow the user's chosen language instead of a hardcoded 'id-ID'.
 */
import { getLocale } from '@/paraglide/runtime'

const BCP47: Record<string, string> = {
  id: 'id-ID',
  en: 'en-US',
}

/** Active locale as a BCP-47 tag for Intl APIs. */
export function localeTag(): string {
  return BCP47[getLocale()] ?? 'en-US'
}

/** Date + time, medium style (e.g. "16 Jun 2026, 14.05"). */
export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(localeTag(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Short day + month (e.g. "16 Jun"). */
export function formatDayMonth(value: string | number | Date): string {
  return new Date(value).toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' })
}

/** Month + year (e.g. "Juni 2026" / "June 2026"). */
export function formatMonthYear(value: Date): string {
  return value.toLocaleDateString(localeTag(), { month: 'long', year: 'numeric' })
}

/** Full month name for a 1-12 month index (e.g. "June" / "Juni"). */
export function formatMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString(localeTag(), { month: 'long' })
}
