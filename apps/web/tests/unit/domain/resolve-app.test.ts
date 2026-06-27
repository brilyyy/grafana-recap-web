import { describe, expect, it } from 'vitest'
import { normalizeAppNameToKey } from '@/lib/domain/recap/resolve-app'

describe('normalizeAppNameToKey', () => {
  it('lowercases and trims input', () => {
    expect(normalizeAppNameToKey('  BALE  ')).toBe('bale')
  })

  it('replaces spaces with underscores', () => {
    expect(normalizeAppNameToKey('Bale Bisnis')).toBe('bale_bisnis')
  })

  it('replaces hyphens with underscores', () => {
    expect(normalizeAppNameToKey('edc-agen')).toBe('edc_agen')
  })

  it('replaces dots with underscores', () => {
    expect(normalizeAppNameToKey('edc.merchant')).toBe('edc_merchant')
  })

  it('collapses multiple separators into one underscore', () => {
    expect(normalizeAppNameToKey('bale  --  bisnis')).toBe('bale_bisnis')
  })

  it('strips non-alphanumeric characters (except underscore)', () => {
    expect(normalizeAppNameToKey('cms@corp!')).toBe('cmscorp')
  })

  it('returns "unknown" for an empty string', () => {
    expect(normalizeAppNameToKey('')).toBe('unknown')
  })

  it('returns "unknown" for a string of only special chars', () => {
    expect(normalizeAppNameToKey('@#$')).toBe('unknown')
  })

  it('handles already-normalized keys unchanged', () => {
    expect(normalizeAppNameToKey('bale_korpora')).toBe('bale_korpora')
  })

  it('handles mixed case with numbers', () => {
    expect(normalizeAppNameToKey('App2Name')).toBe('app2name')
  })
})
