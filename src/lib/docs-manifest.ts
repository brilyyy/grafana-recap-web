const modules = import.meta.glob('/docs/**/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

export interface DocEntry {
  slug: string
  title: string
  section: string
  load: () => Promise<string>
}

export interface DocSection {
  section: string
  label: string
  docs: DocEntry[]
}

const WORD_OVERRIDES: Record<string, string> = {
  rc: 'RC',
  sql: 'SQL',
  api: 'API',
}

function titleFromSlug(name: string): string {
  if (name.toLowerCase() === 'readme') return 'Overview'
  return name
    .split('-')
    .map((w) => WORD_OVERRIDES[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const SECTION_LABELS: Record<string, string> = {
  features: 'Features',
  technical: 'Technical',
  operations: 'Operations',
}

const entries: DocEntry[] = Object.entries(modules).map(([path, load]) => {
  const slug = path.replace(/^\/docs\//, '').replace(/\.md$/, '')
  const segments = slug.split('/')
  const section = segments.length > 1 ? segments[0] : ''
  return { slug, title: titleFromSlug(segments[segments.length - 1]), section, load }
})

const docsBySlug = new Map(entries.map((e) => [e.slug, e]))

export const docSections: DocSection[] = Object.keys(SECTION_LABELS)
  .map((section) => ({
    section,
    label: SECTION_LABELS[section],
    docs: entries
      .filter((e) => e.section === section)
      .sort((a, b) => {
        if (a.title === 'Overview') return -1
        if (b.title === 'Overview') return 1
        return a.title.localeCompare(b.title)
      }),
  }))
  .filter((s) => s.docs.length > 0)

export function getDoc(slug: string): DocEntry | undefined {
  return docsBySlug.get(slug)
}

export const indexDoc = getDoc('README')

/**
 * Resolve a markdown-relative href against the current doc slug.
 * Returns the target slug if it points to a doc inside docs/, else null.
 */
export function resolveDocLink(currentSlug: string, href: string): string | null {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return null
  const [pathPart] = href.split('#')
  if (!pathPart.endsWith('.md')) return null
  const baseDir = currentSlug.includes('/')
    ? currentSlug.slice(0, currentSlug.lastIndexOf('/'))
    : ''
  const parts = [...(baseDir ? baseDir.split('/') : []), ...pathPart.split('/')]
  const out: string[] = []
  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') {
      if (out.length === 0) return null // escapes docs/ root
      out.pop()
    } else {
      out.push(part)
    }
  }
  const slug = out.join('/').replace(/\.md$/, '')
  return docsBySlug.has(slug) ? slug : null
}
