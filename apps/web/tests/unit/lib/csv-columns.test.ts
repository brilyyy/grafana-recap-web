// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { validateCsvColumns } from '@/lib/csv-columns'

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/plain' })
}

describe('validateCsvColumns', () => {
  it('passes non-csv files without reading them', async () => {
    const file = makeFile('data.xlsx', 'binary content')
    const r = await validateCsvColumns(file, ['date', 'amount'])
    expect(r.isValid).toBe(true)
  })

  it('rejects an empty csv', async () => {
    const r = await validateCsvColumns(makeFile('data.csv', ''), ['date'])
    expect(r.isValid).toBe(false)
    expect(r.error).toMatch(/empty/i)
  })

  it('passes a csv with exactly the required columns', async () => {
    const csv = 'date,amount\n2025-01-01,100'
    const r = await validateCsvColumns(makeFile('data.csv', csv), ['date', 'amount'])
    expect(r.isValid).toBe(true)
  })

  it('passes when an optional column is present', async () => {
    const csv = 'date,amount,notes\n2025-01-01,100,ok'
    const r = await validateCsvColumns(makeFile('data.csv', csv), ['date', 'amount'], ['notes'])
    expect(r.isValid).toBe(true)
  })

  it('rejects fewer columns than required', async () => {
    const csv = 'date\n2025-01-01'
    const r = await validateCsvColumns(makeFile('data.csv', csv), ['date', 'amount'])
    expect(r.isValid).toBe(false)
    expect(r.error).toMatch(/Expected/)
  })

  it('rejects more columns than required+optional', async () => {
    const csv = 'date,amount,extra\n2025-01-01,100,x'
    const r = await validateCsvColumns(makeFile('data.csv', csv), ['date', 'amount'])
    expect(r.isValid).toBe(false)
  })

  it('rejects when a required column is missing by name', async () => {
    const csv = 'date,total\n2025-01-01,100'
    const r = await validateCsvColumns(makeFile('data.csv', csv), ['date', 'amount'])
    expect(r.isValid).toBe(false)
    expect(r.error).toMatch(/amount/)
  })

  it('is case-insensitive for required column matching', async () => {
    const csv = 'DATE,AMOUNT\n2025-01-01,100'
    const r = await validateCsvColumns(makeFile('data.csv', csv), ['date', 'amount'])
    expect(r.isValid).toBe(true)
  })
})
