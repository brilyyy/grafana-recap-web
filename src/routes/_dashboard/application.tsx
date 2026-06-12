import { createFileRoute } from '@tanstack/react-router'
import AddAppCard from '@/components/add-app-card'
import AppListCard from '@/components/app-list-card'

export const Route = createFileRoute('/_dashboard/application')({
  ssr: false,
  component: ApplicationsPage,
})

function ApplicationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-muted-foreground">Register and manage applications tracked by Grafana Recap.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <AppListCard />
        <AddAppCard />
      </div>
    </div>
  )
}
