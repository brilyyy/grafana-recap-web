import { createFileRoute } from '@tanstack/react-router'
import NoRcTransactionCard from '@/components/no-rc-transaction-card'
import { m } from '@/paraglide/messages'

export const Route = createFileRoute('/_dashboard/transactions')({
  ssr: false,
  component: TransactionsPage,
})

function TransactionsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{m.page_transactions_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.page_transactions_subtitle()}</p>
      </header>
      <NoRcTransactionCard />
    </div>
  )
}
