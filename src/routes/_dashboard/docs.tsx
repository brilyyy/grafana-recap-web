import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { docSections } from '@/lib/docs-manifest'

export const Route = createFileRoute('/_dashboard/docs')({
  ssr: false,
  component: DocsLayout,
})

function DocsLayout() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Docs</h1>
        <p className="text-sm text-muted-foreground">Project documentation.</p>
      </header>
      <div className="flex flex-col gap-8 lg:flex-row">
        <nav className="w-full shrink-0 lg:sticky lg:top-6 lg:w-56 lg:self-start">
          <ul className="space-y-6">
            <li>
              <Link
                to="/docs"
                activeOptions={{ exact: true }}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
                activeProps={{ className: 'text-sm font-medium text-foreground' }}
              >
                Overview
              </Link>
            </li>
            {docSections.map((section) => (
              <li key={section.section}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </div>
                <ul className="space-y-1 border-l pl-3">
                  {section.docs.map((doc) => (
                    <li key={doc.slug}>
                      <Link
                        to="/docs/$"
                        params={{ _splat: doc.slug }}
                        className="block text-sm text-muted-foreground hover:text-foreground"
                        activeProps={{ className: 'block text-sm font-medium text-foreground' }}
                      >
                        {doc.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
