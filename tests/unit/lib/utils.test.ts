import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('deduplicates conflicting tailwind classes (last wins)', () => {
    // tailwind-merge resolves px-2 + px-4 → px-4
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('handles undefined and null gracefully', () => {
    expect(() => cn('a', undefined, null as any, 'b')).not.toThrow()
    expect(cn('a', undefined, null as any, 'b')).toContain('a')
  })

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('')
  })
})
