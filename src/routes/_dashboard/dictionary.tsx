import { createFileRoute } from '@tanstack/react-router'
import DictionaryCard from '@/components/dictionary-card'

export const Route = createFileRoute('/_dashboard/dictionary')({
  ssr: false,
  component: DictionaryPage,
})

function DictionaryPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Dictionary</h1>
        <p className="text-sm text-muted-foreground">Response-code mappings across applications.</p>
      </header>
      <DictionaryCard />
    </div>
  )
}
