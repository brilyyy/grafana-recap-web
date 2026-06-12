import { createFileRoute } from '@tanstack/react-router'
import UnmappedRcCard from '@/components/unmapped-rc-card'

export const Route = createFileRoute('/_dashboard/unmapped-rc')({
  ssr: false,
  component: UnmappedRcPage,
})

function UnmappedRcPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Unmapped RC</h1>
        <p className="text-sm text-muted-foreground">Classify response codes that have no error-type mapping yet.</p>
      </header>
      <UnmappedRcCard />
    </div>
  )
}
