import { describe, expect, it } from 'vitest'
import { buildColumnIndex, getRowValue, parseDateValue, validateHeaders } from '@/lib/file-parser'

describe('parseDateValue', () => {
  it('returns null for null/undefined', () => {
    expect(parseDateValue(null)).toBeNull()
    expect(parseDateValue(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseDateValue('')).toBeNull()
  })

  it('parses DD/MM/YYYY string', () => {
    const d = parseDateValue('15/06/2025')!
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(15)
  })

  it('parses YYYY-MM-DD string', () => {
    const d = parseDateValue('2025-06-15')!
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(15)
  })

  it('rejects rollover date like 31/02/2025', () => {
    expect(parseDateValue('31/02/2025')).toBeNull()
  })

  it('rejects rollover date 29/02/2023 (non-leap year)', () => {
    expect(parseDateValue('29/02/2023')).toBeNull()
  })

  it('accepts leap year 29/02/2024', () => {
    const d = parseDateValue('29/02/2024')!
    expect(d).not.toBeNull()
    expect(d.getDate()).toBe(29)
    expect(d.getMonth()).toBe(1)
  })

  it('converts Excel serial number to Date', () => {
    // Excel serial 45458 = 2024-06-15 in the 1900 date system
    const d = parseDateValue(45458)!
    expect(d).not.toBeNull()
    expect(d instanceof Date).toBe(true)
  })

  it('passes through an already-valid Date', () => {
    const input = new Date(2025, 5, 15)
    expect(parseDateValue(input)).toBe(input)
  })

  it('returns null for an invalid Date object', () => {
    expect(parseDateValue(new Date('not-a-date'))).toBeNull()
  })
})

describe('validateHeaders', () => {
  const required = ['date', 'amount']
  const optional = ['notes']

  it('passes when headers match required exactly', () => {
    expect(validateHeaders(['date', 'amount'], required, optional)).toEqual({ valid: true })
  })

  it('passes when headers include an optional column', () => {
    expect(validateHeaders(['date', 'amount', 'notes'], required, optional)).toEqual({ valid: true })
  })

  it('fails when fewer columns than required', () => {
    const r = validateHeaders(['date'], required, optional)
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/Expected/)
  })

  it('fails when more columns than required+optional', () => {
    const r = validateHeaders(['date', 'amount', 'notes', 'extra'], required, optional)
    expect(r.valid).toBe(false)
  })

  it('fails when a required column is missing', () => {
    const r = validateHeaders(['date', 'total'], required, optional)
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/amount/)
  })

  it('is case-insensitive for header matching', () => {
    expect(validateHeaders(['DATE', 'AMOUNT'], required, optional)).toEqual({ valid: true })
  })
})

describe('buildColumnIndex', () => {
  it('maps column names to their zero-based index', () => {
    const idx = buildColumnIndex(['date', 'amount', 'notes'], ['amount', 'notes'])
    expect(idx['amount']).toBe(1)
    expect(idx['notes']).toBe(2)
  })

  it('is case-insensitive', () => {
    const idx = buildColumnIndex(['Date', 'Amount'], ['date', 'amount'])
    expect(idx['date']).toBe(0)
    expect(idx['amount']).toBe(1)
  })

  it('returns empty object when no columns match', () => {
    expect(buildColumnIndex(['x', 'y'], ['z'])).toEqual({})
  })
})

describe('getRowValue', () => {
  it('returns the value at the column index', () => {
    const headers = ['date', 'amount']
    const row = { date: '2025-01-01', amount: '100' }
    const idx = buildColumnIndex(headers, ['amount'])
    expect(getRowValue(row, headers, 'amount', idx)).toBe('100')
  })

  it('returns empty string for unknown column', () => {
    const headers = ['date']
    const row = { date: '2025-01-01' }
    expect(getRowValue(row, headers, 'missing', {})).toBe('')
  })
})
