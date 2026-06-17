import { createFileRoute } from '@tanstack/react-router'
import { MarkdownDoc } from '@/components/markdown-doc'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { indexDoc } from '@/lib/docs-manifest'
import { m } from '@/paraglide/messages'

export const Route = createFileRoute('/_dashboard/docs/')({
  ssr: false,
  loader: async () => (indexDoc ? await indexDoc.load() : null),
  component: DocsIndexPage,
})

function DocsIndexPage() {
  const content = Route.useLoaderData()

  if (content === null) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{m.docs_no_readme_title()}</EmptyTitle>
          <EmptyDescription>{m.docs_no_readme_desc()}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return <MarkdownDoc slug="README" content={content} />
}
