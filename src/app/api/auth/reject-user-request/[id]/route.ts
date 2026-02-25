import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth'
import { logAuditEvent, getClientIp, getUserAgent } from '@/lib/audit'
import type { ApiResponse } from '@/types'

/**
 * Reject a pending user request (superadmin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require superadmin role
    const session = await requireSuperAdmin(request)

    const { id } = await params
    const requestId = parseInt(id)
    if (isNaN(requestId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request ID',
        } as ApiResponse,
        { status: 400 }
      )
    }

    const body = await request.json()
    const { rejectionReason } = body

    // Get the pending request
    const [requests]: any = await pool.execute(
      'SELECT * FROM pending_user_requests WHERE id = ? AND status = ?',
      [requestId, 'pending']
    )

    if (requests.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Pending request not found or already processed',
        } as ApiResponse,
        { status: 404 }
      )
    }

    const pendingRequest = requests[0]

    // Update pending request status
    await pool.execute(
      `UPDATE pending_user_requests 
       SET status = 'rejected', 
           rejected_by = ?,
           rejection_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [session.userId, rejectionReason || null, requestId]
    )

    // Log the action
    await logAuditEvent(
      session.userId,
      session.username,
      'USER_REQUEST_REJECTED',
      'pending_user_request',
      requestId.toString(),
      `Rejected user request: ${pendingRequest.username}. Reason: ${rejectionReason || 'No reason provided'}`,
      getClientIp(request),
      getUserAgent(request)
    )

    return NextResponse.json({
      success: true,
      message: `User request rejected`,
      data: {
        requestId,
        username: pendingRequest.username,
      },
    } as ApiResponse)
  } catch (error: any) {
    // Handle authentication errors
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        } as ApiResponse,
        { status: 403 }
      )
    }

    console.error('Reject user request error:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
}
