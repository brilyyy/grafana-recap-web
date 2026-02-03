'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

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

export default function UserApprovalPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [requests, setRequests] = useState<PendingUserRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PendingUserRequest | null>(null)
  const [approvedRole, setApprovedRole] = useState<string>('user')
  const [rejectionReason, setRejectionReason] = useState<string>('')

  useEffect(() => {
    let isMounted = true
    
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check')
        const data = await response.json()
        
        if (!isMounted) return
        
        if (data.success && data.data.authenticated) {
          setIsAuthenticated(true)
          // Check if user is superadmin
          if (data.data.user.role === 'superadmin') {
            setIsSuperAdmin(true)
            loadPendingRequests()
          } else {
            // Not superadmin, redirect to dashboard
            router.replace('/')
          }
        } else {
          // Not authenticated, redirect to login
          router.replace('/login')
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Auth check error:', error)
        router.replace('/login')
      }
    }
    
    checkAuth()
    
    return () => {
      isMounted = false
    }
  }, []) // Remove router from dependencies to prevent re-runs

  const loadPendingRequests = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/auth/pending-user-requests')
      const data = await response.json()

      if (data.success) {
        setRequests(data.data.requests)
      } else {
        throw new Error(data.message || 'Failed to load pending requests')
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading pending requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedRequest) return

    try {
      setApprovingId(selectedRequest.id)

      const response = await fetch(`/api/auth/approve-user-request/${selectedRequest.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approvedRole }),
      })

      const data = await response.json()

      if (data.success) {
        setShowApproveModal(false)
        setSelectedRequest(null)
        setApprovedRole('user')
        loadPendingRequests()
      } else {
        alert(data.message || 'Failed to approve request')
      }
    } catch (err: any) {
      alert('An error occurred. Please try again.')
      console.error('Error approving request:', err)
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return

    try {
      setRejectingId(selectedRequest.id)

      const response = await fetch(`/api/auth/reject-user-request/${selectedRequest.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejectionReason }),
      })

      const data = await response.json()

      if (data.success) {
        setShowRejectModal(false)
        setSelectedRequest(null)
        setRejectionReason('')
        loadPendingRequests()
      } else {
        alert(data.message || 'Failed to reject request')
      }
    } catch (err: any) {
      alert('An error occurred. Please try again.')
      console.error('Error rejecting request:', err)
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

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated or not superadmin, don't render (redirect will happen)
  if (!isAuthenticated || !isSuperAdmin) {
    return null
  }

  return (
    <main className="min-h-screen p-2 md:p-4 lg:p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-3 md:mb-4 gap-3 sm:gap-4 animate-fade-in">
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-red-200 drop-shadow-lg">
            User Approval
          </h1>
          <p className="text-white/90 text-xs md:text-sm font-medium">
            Review and approve user registration requests
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <LogoutButton />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-white/20 shadow-xl animate-fade-in">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white/80">Loading pending requests...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-300 mb-4">{error}</p>
              <button
                onClick={loadPendingRequests}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
              >
                Retry
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-white/50 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-white/80 text-lg font-medium">No pending requests</p>
              <p className="text-white/60 text-sm mt-2">All user requests have been processed</p>
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-red-500/20 flex items-center justify-center border border-white/20">
                          <span className="text-white font-bold text-lg">
                            {request.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-lg">{request.username}</h3>
                          <p className="text-white/70 text-sm">{request.email}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/30">
                          Requested: {request.requested_role}
                        </span>
                        <span className="px-3 py-1 bg-gray-500/20 text-gray-200 rounded-lg border border-gray-400/30">
                          {new Date(request.created_at).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {request.requested_by_username && (
                          <span className="px-3 py-1 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-400/30">
                            Requested by: {request.requested_by_username}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openApproveModal(request)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openRejectModal(request)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 max-w-md w-full border border-white/20 shadow-xl animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-4">Approve User Request</h2>
            <div className="mb-4">
              <p className="text-white/80 mb-2">
                <strong>Username:</strong> {selectedRequest.username}
              </p>
              <p className="text-white/80 mb-2">
                <strong>Email:</strong> {selectedRequest.email}
              </p>
              <p className="text-white/80 mb-4">
                <strong>Requested Role:</strong> {selectedRequest.requested_role}
              </p>
              <label className="block text-white/90 font-semibold mb-2">
                Assign Role:
              </label>
              <select
                value={approvedRole}
                onChange={(e) => setApprovedRole(e.target.value)}
                className="w-full px-4 py-2 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl text-white focus:outline-none focus:border-white/50"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
              <p className="text-white/60 text-xs mt-2">
                You can assign a different role than requested
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false)
                  setSelectedRequest(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approvingId === selectedRequest.id}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approvingId === selectedRequest.id ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 max-w-md w-full border border-white/20 shadow-xl animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-4">Reject User Request</h2>
            <div className="mb-4">
              <p className="text-white/80 mb-2">
                <strong>Username:</strong> {selectedRequest.username}
              </p>
              <p className="text-white/80 mb-4">
                <strong>Email:</strong> {selectedRequest.email}
              </p>
              <label className="block text-white/90 font-semibold mb-2">
                Rejection Reason (Optional):
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="w-full px-4 py-2 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:border-white/50 min-h-[100px]"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedRequest(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectingId === selectedRequest.id}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rejectingId === selectedRequest.id ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
