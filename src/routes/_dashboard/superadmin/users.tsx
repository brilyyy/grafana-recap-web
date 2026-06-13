import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Search, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/router'
import { formatDate, type PendingUserRequest, RoleBadge, type User, useSuperadminGuard } from './-shared'

export const Route = createFileRoute('/_dashboard/superadmin/users')({
  ssr: false,
  component: UsersPage,
})

const ROLES = ['superadmin', 'admin', 'user'] as const

function UsersPage() {
  const { isSuperadmin } = useSuperadminGuard()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const [selectedRequest, setSelectedRequest] = useState<PendingUserRequest | null>(null)
  const [dialogMode, setDialogMode] = useState<'approve' | 'reject' | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [approvedRole, setApprovedRole] = useState<string>('user')
  const [newRole, setNewRole] = useState<string>('user')
  const [rejectionReason, setRejectionReason] = useState('')

  const utils = trpc.useUtils()
  const usersQuery = trpc.users.list.useQuery(
    { page, limit: 25, search: search || undefined, role: roleFilter || undefined },
    { enabled: isSuperadmin },
  )
  const pendingQuery = trpc.auth.pendingRequests.useQuery(undefined, { enabled: isSuperadmin })

  const users = (usersQuery.data?.data?.users ?? []) as User[]
  const usersTotalPages = usersQuery.data?.data?.totalPages ?? 1
  const pendingRequests = ((pendingQuery.data?.data as { requests?: PendingUserRequest[] } | undefined)?.requests ??
    []) as PendingUserRequest[]

  const approveRequestMutation = trpc.auth.approveRequest.useMutation()
  const rejectRequestMutation = trpc.auth.rejectRequest.useMutation()
  const updateUserMutation = trpc.users.update.useMutation()

  const closeRequestDialog = () => {
    setDialogMode(null)
    setSelectedRequest(null)
    setRejectionReason('')
    setApprovedRole('user')
  }

  const handleApprove = async () => {
    if (!selectedRequest) return
    try {
      await approveRequestMutation.mutateAsync({
        id: selectedRequest.id,
        approvedRole: approvedRole as (typeof ROLES)[number],
      })
      toast.success(`Approved ${selectedRequest.username} as ${approvedRole}`)
      closeRequestDialog()
      utils.users.list.invalidate()
      utils.auth.pendingRequests.invalidate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error approving user request')
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    try {
      await rejectRequestMutation.mutateAsync({
        id: selectedRequest.id,
        rejectionReason: rejectionReason || undefined,
      })
      toast.success(`Rejected request from ${selectedRequest.username}`)
      closeRequestDialog()
      utils.auth.pendingRequests.invalidate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error rejecting user request')
    }
  }

  const handleUpdateRole = async () => {
    if (!selectedUser) return
    try {
      await updateUserMutation.mutateAsync({ id: selectedUser.id, role: newRole as (typeof ROLES)[number] })
      toast.success(`Updated ${selectedUser.username} to ${newRole}`)
      setSelectedUser(null)
      utils.users.list.invalidate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating user role')
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Manage user accounts, roles, and registration requests.</p>
      </header>

      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Pending requests</CardTitle>
            <CardDescription>{pendingRequests.length} registration request(s) awaiting review.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Requested role</TableHead>
                  <TableHead className="hidden md:table-cell">Requested by</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.username}</TableCell>
                    <TableCell className="text-muted-foreground">{request.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={request.requested_role} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {request.requested_by_username || '—'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(request.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="h-7"
                          onClick={() => {
                            setSelectedRequest(request)
                            setApprovedRole(request.requested_role === 'admin' ? 'admin' : 'user')
                            setDialogMode('approve')
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => {
                            setSelectedRequest(request)
                            setRejectionReason('')
                            setDialogMode('reject')
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="h-8 w-64 pl-8"
          />
        </div>
        <Select
          value={roleFilter || 'all'}
          onValueChange={(value) => {
            setRoleFilter(value === 'all' ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {usersQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersRound />
                </EmptyMedia>
                <EmptyTitle>No users found</EmptyTitle>
                <EmptyDescription>Adjust the search or role filter.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => {
                          setSelectedUser(user)
                          setNewRole(user.role)
                        }}
                      >
                        Edit role
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {usersTotalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {usersTotalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(usersTotalPages, p + 1))}
            disabled={page === usersTotalPages}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog
        open={dialogMode === 'approve' && !!selectedRequest}
        onOpenChange={(open) => !open && closeRequestDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve user request</DialogTitle>
            <DialogDescription>
              Approve registration request for{' '}
              <span className="font-medium text-foreground">{selectedRequest?.username}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>Assign role</Label>
            <Select value={approvedRole} onValueChange={setApprovedRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRequestDialog}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approveRequestMutation.isPending}>
              {approveRequestMutation.isPending && <Loader2 className="animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogMode === 'reject' && !!selectedRequest}
        onOpenChange={(open) => !open && closeRequestDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject user request</DialogTitle>
            <DialogDescription>
              Reject registration request for{' '}
              <span className="font-medium text-foreground">{selectedRequest?.username}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>Rejection reason (optional)</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRequestDialog}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectRequestMutation.isPending}>
              {rejectRequestMutation.isPending && <Loader2 className="animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user role</DialogTitle>
            <DialogDescription>
              Change role for <span className="font-medium text-foreground">{selectedUser?.username}</span> (currently{' '}
              {selectedUser?.role}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>New role</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={updateUserMutation.isPending || newRole === selectedUser?.role}
            >
              {updateUserMutation.isPending && <Loader2 className="animate-spin" />}
              Update role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
