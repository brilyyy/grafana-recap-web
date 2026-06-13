import { describe, expect, it } from 'vitest'
import { parseCsvRows } from '@/lib/csv'

describe('parseCsvRows', () => {
  it('parses a simple single-row CSV', () => {
    expect(parseCsvRows('a,b,c')).toEqual([['a', 'b', 'c']])
  })

  it('parses multiple rows', () => {
    expect(parseCsvRows('h1,h2\nv1,v2')).toEqual([
      ['h1', 'h2'],
      ['v1', 'v2'],
    ])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsvRows('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('handles quoted fields containing commas', () => {
    expect(parseCsvRows('"a,b",c')).toEqual([['a,b', 'c']])
  })

  it('handles escaped double quotes (RFC-4180 "")', () => {
    expect(parseCsvRows('"a""b",c')).toEqual([['a"b', 'c']])
  })

  it('handles quoted fields with embedded newlines', () => {
    const input = '"line1\nline2",end'
    const result = parseCsvRows(input)
    expect(result).toHaveLength(1)
    expect(result[0][0]).toBe('line1\nline2')
    expect(result[0][1]).toBe('end')
  })

  it('trims unquoted field whitespace', () => {
    expect(parseCsvRows('  a  ,  b  ')).toEqual([['a', 'b']])
  })

  it('skips blank lines', () => {
    expect(parseCsvRows('a,b\n\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('returns empty array for empty string', () => {
    expect(parseCsvRows('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(parseCsvRows('   \n  ')).toEqual([])
  })

  it('handles a single field (no commas)', () => {
    expect(parseCsvRows('onlyfield')).toEqual([['onlyfield']])
  })

  it('handles trailing comma as an empty last field', () => {
    const result = parseCsvRows('a,b,')
    expect(result[0]).toHaveLength(3)
    expect(result[0][2]).toBe('')
  })
})
