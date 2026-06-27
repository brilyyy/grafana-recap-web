/**
 * Locale-aware formatting helpers. Uses en-US as the fixed locale.
 */

const LOCALE = 'en-US'

/** Date + time, medium style (e.g. "Jun 16, 2026, 02:05 PM"). */
export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Short day + month (e.g. "Jun 16"). */
export function formatDayMonth(value: string | number | Date): string {
  return new Date(value).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
}

/** Month + year (e.g. "June 2026"). */
export function formatMonthYear(value: Date): string {
  return value.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}

/** Full month name for a 1-12 month index (e.g. "June"). */
export function formatMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString(LOCALE, { month: 'long' })
}
