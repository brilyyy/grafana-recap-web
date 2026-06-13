import { createFileRoute } from '@tanstack/react-router'
import NoRcTransactionCard from '@/components/no-rc-transaction-card'

export const Route = createFileRoute('/_dashboard/transactions')({
  ssr: false,
  component: TransactionsPage,
})

function TransactionsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Transactions missing a response code, ready for manual completion.
        </p>
      </header>
      <NoRcTransactionCard />
    </div>
  )
}
