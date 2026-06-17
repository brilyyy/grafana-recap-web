import { createFileRoute } from '@tanstack/react-router'
import { MarkdownDoc } from '@/components/markdown-doc'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { getDoc } from '@/lib/docs-manifest'
import { m } from '@/paraglide/messages'

export const Route = createFileRoute('/_dashboard/docs/$')({
  ssr: false,
  loader: async ({ params }) => {
    const doc = getDoc(params._splat ?? '')
    if (!doc) return null
    return { slug: doc.slug, content: await doc.load() }
  },
  component: DocPage,
})

function DocPage() {
  const data = Route.useLoaderData()

  if (data === null) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{m.docs_not_found_title()}</EmptyTitle>
          <EmptyDescription>{m.docs_not_found_desc()}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return <MarkdownDoc slug={data.slug} content={data.content} />
}
