import { createFileRoute } from '@tanstack/react-router'
import DictionaryCard from '@/components/dictionary-card'
import UnmappedRcCard from '@/components/unmapped-rc-card'

export const Route = createFileRoute('/_dashboard/dictionary')({
  ssr: false,
  component: DictionaryPage,
})

function DictionaryPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Dictionary</h1>
        <p className="text-sm text-muted-foreground">
          Response-code mappings across applications, with unclassified codes for review.
        </p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DictionaryCard />
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Unmapped RC</h2>
            <p className="text-xs text-muted-foreground">
              Classify response codes that have no error-type mapping yet. Submitted codes move into the dictionary.
            </p>
          </div>
          <UnmappedRcCard />
        </section>
      </div>
    </div>
  )
}
