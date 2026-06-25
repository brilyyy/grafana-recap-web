import { describe, expect, it } from 'vitest'
import { describeCron } from '@/lib/cron-description'

describe('describeCron', () => {
  it('describes a valid cron expression', () => {
    const result = describeCron('0 9 * * 1-5')
    expect(result.ok).toBe(true)
    expect(result.ok && result.text.length).toBeGreaterThan(0)
  })

  it('rejects an empty expression', () => {
    expect(describeCron('')).toEqual({ ok: false })
    expect(describeCron('   ')).toEqual({ ok: false })
  })

  it('rejects garbage input without throwing', () => {
    expect(() => describeCron('not a cron')).not.toThrow()
    expect(describeCron('not a cron').ok).toBe(false)
  })
})
