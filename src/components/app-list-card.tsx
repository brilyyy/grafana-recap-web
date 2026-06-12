import { PackageOpen, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useApplications } from '@/hooks/useApplications'

export default function AppListCard() {
  const { applications, isLoading, error, refreshApplications } = useApplications()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Applications</CardTitle>
        <CardDescription>
          {isLoading ? 'Loading…' : `${applications.length} registered`}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => refreshApplications()} disabled={isLoading}>
            <RefreshCw />
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Failed to load applications</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : applications.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageOpen />
              </EmptyMedia>
              <EmptyTitle>No applications yet</EmptyTitle>
              <EmptyDescription>Register your first application using the form.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">{app.id}</TableCell>
                  <TableCell className="font-medium">{app.app_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
