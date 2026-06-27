import cronstrue from 'cronstrue'

export function describeCron(expr: string): { ok: true; text: string } | { ok: false } {
  const trimmed = expr.trim()
  if (!trimmed) return { ok: false }
  try {
    return { ok: true, text: cronstrue.toString(trimmed, { use24HourTimeFormat: true }) }
  } catch {
    return { ok: false }
  }
}
