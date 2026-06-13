import { createFileRoute } from '@tanstack/react-router'
import { MarkdownDoc } from '@/components/markdown-doc'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { indexDoc } from '@/lib/docs-manifest'

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
          <EmptyTitle>No documentation found</EmptyTitle>
          <EmptyDescription>The docs/ directory has no README.md.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return <MarkdownDoc slug="README" content={content} />
}
