import { createFileRoute } from '@tanstack/react-router'
import AddSuccessRateCard from '@/components/add-success-rate-card'
import DictionaryUploadCard from '@/components/dictionary-upload-card'

export const Route = createFileRoute('/_dashboard/uploads')({
  ssr: false,
  component: UploadsPage,
})

function UploadsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Uploads</h1>
        <p className="text-sm text-muted-foreground">Import dictionary mappings and success-rate data from Excel or CSV files.</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <DictionaryUploadCard />
        <AddSuccessRateCard />
      </div>
    </div>
  )
}
