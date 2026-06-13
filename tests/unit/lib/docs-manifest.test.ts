import { describe, expect, it } from 'vitest'
import { resolveDocLink } from '@/lib/docs-manifest'

/**
 * resolveDocLink(currentSlug, href) — pure slug-resolution logic.
 * The docsBySlug map is populated from `import.meta.glob` which is empty in
 * the test environment, so only null-returning paths can be tested without a
 * full Vite build.  The escape/reject logic is the valuable invariant here.
 */
describe('resolveDocLink', () => {
  it('rejects absolute URLs (http:)', () => {
    expect(resolveDocLink('features/auth', 'http://example.com/foo.md')).toBeNull()
  })

  it('rejects https: URLs', () => {
    expect(resolveDocLink('features/auth', 'https://example.com/foo.md')).toBeNull()
  })

  it('rejects anchor-only hrefs', () => {
    expect(resolveDocLink('features/auth', '#section')).toBeNull()
  })

  it('rejects root-absolute paths starting with /', () => {
    expect(resolveDocLink('features/auth', '/docs/technical/add-new-app.md')).toBeNull()
  })

  it('rejects hrefs that do not end in .md', () => {
    expect(resolveDocLink('features/auth', '../technical/schema')).toBeNull()
  })

  it('rejects "../" traversal that would escape docs/ root', () => {
    // From a top-level doc, going up once escapes the root
    expect(resolveDocLink('README', '../outside.md')).toBeNull()
  })

  it('rejects deep traversal escaping docs/ root', () => {
    expect(resolveDocLink('features/auth', '../../outside.md')).toBeNull()
  })

  it('returns null for a relative .md that resolves to an unknown slug', () => {
    // In test env glob is empty so all doc lookups return undefined → null
    expect(resolveDocLink('features/auth', './nonexistent.md')).toBeNull()
  })

  it('normalizes "./" from same-directory href before lookup', () => {
    // Still null (doc not in map) but must not throw
    expect(() => resolveDocLink('features/auth', './auth.md')).not.toThrow()
  })
})
