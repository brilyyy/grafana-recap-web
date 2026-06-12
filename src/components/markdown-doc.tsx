import { Link } from '@tanstack/react-router'
import type { ComponentProps, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveDocLink } from '@/lib/docs-manifest'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function DocLink({
  currentSlug,
  href,
  children,
}: {
  currentSlug: string
  href?: string
  children?: ReactNode
}) {
  if (!href) return <span>{children}</span>
  if (/^https?:/i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary underline underline-offset-4"
      >
        {children}
      </a>
    )
  }
  const slug = resolveDocLink(currentSlug, href)
  if (slug !== null) {
    return (
      <Link
        to="/docs/$"
        params={{ _splat: slug }}
        className="font-medium text-primary underline underline-offset-4"
      >
        {children}
      </Link>
    )
  }
  if (href.startsWith('#')) {
    return (
      <a href={href} className="font-medium text-primary underline underline-offset-4">
        {children}
      </a>
    )
  }
  // Relative link to a repo file outside docs/ — not navigable in-app.
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
}

export function MarkdownDoc({ slug, content }: { slug: string; content: string }) {
  return (
    <div className="max-w-3xl text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1 className="mb-4 mt-2 text-2xl font-semibold tracking-tight" {...props} />
          ),
          h2: (props) => (
            <h2
              className="mb-3 mt-8 border-b pb-2 text-lg font-semibold tracking-tight"
              {...props}
            />
          ),
          h3: (props) => <h3 className="mb-2 mt-6 text-base font-semibold" {...props} />,
          h4: (props) => <h4 className="mb-2 mt-4 text-sm font-semibold" {...props} />,
          p: (props) => <p className="mb-4 text-foreground/90" {...props} />,
          ul: (props) => <ul className="mb-4 ml-6 list-disc space-y-1" {...props} />,
          ol: (props) => <ol className="mb-4 ml-6 list-decimal space-y-1" {...props} />,
          li: (props) => <li className="text-foreground/90" {...props} />,
          blockquote: (props) => (
            <blockquote
              className="mb-4 border-l-2 border-border pl-4 text-muted-foreground"
              {...props}
            />
          ),
          hr: () => <hr className="my-6 border-border" />,
          a: ({ href, children }) => (
            <DocLink currentSlug={slug} href={href}>
              {children}
            </DocLink>
          ),
          code: ({ className, children, ...props }: ComponentProps<'code'>) => {
            const isBlock = className?.includes('language-')
            if (isBlock) {
              return (
                <code className={`font-mono text-xs ${className ?? ''}`} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props}>
                {children}
              </code>
            )
          },
          pre: (props) => (
            <pre
              className="mb-4 overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-xs leading-normal"
              {...props}
            />
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto rounded-lg border">
              <Table>{children}</Table>
            </div>
          ),
          thead: ({ children }) => <TableHeader>{children}</TableHeader>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => <TableHead className="font-semibold">{children}</TableHead>,
          td: ({ children }) => <TableCell>{children}</TableCell>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
