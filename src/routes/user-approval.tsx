import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CheckCircle, Home, Loader2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import LogoutButton from '@/components/logout-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { trpc } from '@/router'

interface PendingUserRequest {
  id: number
  username: string
  email: string
  requested_role: string
  status: string
  created_at: string
  updated_at: string
  requested_by_username: string | null
}

export const Route = createFileRoute('/user-approval')({
  ssr: false,
  component: UserApprovalPage,
})

function UserApprovalPage() {
  const navigate = useNavigate()
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PendingUserRequest | null>(null)
  const [approvedRole, setApprovedRole] = useState<string>('user')
  const [rejectionReason, setRejectionReason] = useState<string>('')

  const { data: authCheck, isLoading: authLoading } = trpc.auth.check.useQuery(undefined, { retry: false })
  const isAuthenticated = authCheck?.data?.authenticated ?? null
  const isSuperAdmin = (authCheck?.data as any)?.user?.role === 'superadmin'

  const {
    data: pendingData,
    isLoading: loading,
    error: pendingError,
    refetch,
  } = trpc.auth.pendingRequests.useQuery(undefined, { enabled: !!isAuthenticated && isSuperAdmin })
  const requests: PendingUserRequest[] = (pendingData?.data?.requests ?? []) as PendingUserRequest[]
  const error = pendingError?.message ?? null

  const approveMutation = trpc.auth.approveRequest.useMutation({ onSuccess: () => refetch() })
  const rejectMutation = trpc.auth.rejectRequest.useMutation({ onSuccess: () => refetch() })

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) navigate({ to: '/login', replace: true })
      else if (!isSuperAdmin) navigate({ to: '/', replace: true })
    }
  }, [isAuthenticated, isSuperAdmin, authLoading, navigate])

  const handleApprove = async () => {
    if (!selectedRequest) return
    try {
      setApprovingId(selectedRequest.id)
      await approveMutation.mutateAsync({
        id: selectedRequest.id,
        approvedRole: approvedRole as 'superadmin' | 'admin' | 'user',
      })
      setShowApproveModal(false)
      setSelectedRequest(null)
      setApprovedRole('user')
    } catch (err: any) {
      alert(err?.message || 'Failed to approve request')
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    try {
      setRejectingId(selectedRequest.id)
      await rejectMutation.mutateAsync({ id: selectedRequest.id, rejectionReason: rejectionReason || undefined })
      setShowRejectModal(false)
      setSelectedRequest(null)
      setRejectionReason('')
    } catch (err: any) {
      alert(err?.message || 'Failed to reject request')
    } finally {
      setRejectingId(null)
    }
  }

  const openApproveModal = (request: PendingUserRequest) => {
    setSelectedRequest(request)
    setApprovedRole(request.requested_role || 'user')
    setShowApproveModal(true)
  }

  const openRejectModal = (request: PendingUserRequest) => {
    setSelectedRequest(request)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  if (authLoading || isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !isSuperAdmin) return null

  return (
    <main className="min-h-screen p-2 md:p-4 lg:p-5">
      <div className="flex flex-col items-center justify-center mb-3 md:mb-4 gap-3 md:gap-4 animate-in fade-in duration-300">
        <div className="flex-1 text-center">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold mb-1 bg-clip-text text-transparent bg-linear-to-r from-white via-blue-200 to-red-200 drop-shadow-lg">
            User Approval
          </h1>
          <p className="text-white/70 text-xs md:text-sm">Review and approve user registration requests</p>
        </div>
        <div className="w-full flex justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate({ to: '/' })}
            className="bg-blue-600/80 hover:bg-blue-500/80 text-white border-blue-400/30"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Button>
          <LogoutButton />
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-white/20 shadow-xl animate-in fade-in duration-300">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
              <p className="text-white/70">Loading pending requests...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-300 mb-4">{error}</p>
              <Button variant="secondary" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <p className="text-white/80 text-lg font-medium">No pending requests</p>
              <p className="text-white/50 text-sm mt-2">All user requests have been processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500/30 to-red-500/30 flex items-center justify-center border border-white/20">
                          <span className="text-white font-bold text-lg">
                            {request.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-lg">{request.username}</h3>
                          <p className="text-white/60 text-sm">{request.email}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-200 border-blue-400/30">
                          Requested: {request.requested_role}
                        </Badge>
                        <Badge variant="secondary" className="bg-gray-500/20 text-gray-200 border-gray-400/30">
                          {new Date(request.created_at).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Badge>
                        {request.requested_by_username && (
                          <Badge variant="secondary" className="bg-purple-500/20 text-purple-200 border-purple-400/30">
                            Requested by: {request.requested_by_username}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => openApproveModal(request)}
                        className="bg-green-600 hover:bg-green-500 text-white border-0"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openRejectModal(request)}>
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      <Dialog
        open={showApproveModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowApproveModal(false)
            setSelectedRequest(null)
          }
        }}
      >
        <DialogContent className="bg-gray-900/95 border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Approve User Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-white/70 text-sm">
                  <span className="font-semibold text-white">Username:</span> {selectedRequest.username}
                </p>
                <p className="text-white/70 text-sm">
                  <span className="font-semibold text-white">Email:</span> {selectedRequest.email}
                </p>
                <p className="text-white/70 text-sm">
                  <span className="font-semibold text-white">Requested Role:</span> {selectedRequest.requested_role}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-white/90 font-semibold">Assign Role:</Label>
                <select
                  value={approvedRole}
                  onChange={(e) => setApprovedRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user" className="bg-gray-800">
                    User
                  </option>
                  <option value="admin" className="bg-gray-800">
                    Admin
                  </option>
                  <option value="superadmin" className="bg-gray-800">
                    Superadmin
                  </option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowApproveModal(false)
                setSelectedRequest(null)
              }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white border-0"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approvingId === selectedRequest?.id}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white border-0"
            >
              {approvingId === selectedRequest?.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog
        open={showRejectModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowRejectModal(false)
            setSelectedRequest(null)
          }
        }}
      >
        <DialogContent className="bg-gray-900/95 border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Reject User Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-white/70 text-sm">
                  <span className="font-semibold text-white">Username:</span> {selectedRequest.username}
                </p>
                <p className="text-white/70 text-sm">
                  <span className="font-semibold text-white">Email:</span> {selectedRequest.email}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-white/90 font-semibold">Rejection Reason (Optional):</Label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-red-500 min-h-[100px] resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowRejectModal(false)
                setSelectedRequest(null)
              }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white border-0"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectingId === selectedRequest?.id}
              className="flex-1"
            >
              {rejectingId === selectedRequest?.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
