import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth'
import type { ApiResponse } from '@/types'

/**
 * Get all pending user requests (superadmin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Require superadmin role
    const session = requireSuperAdmin(request)

    // Get all pending requests
    const [requests]: any = await pool.execute(
      `SELECT 
        pur.id,
        pur.username,
        pur.email,
        pur.requested_role,
        pur.status,
        pur.created_at,
        pur.updated_at,
        u.username as requested_by_username
      FROM pending_user_requests pur
      LEFT JOIN users u ON pur.requested_by = u.id
      WHERE pur.status = 'pending'
      ORDER BY pur.created_at DESC`
    )

    return NextResponse.json({
      success: true,
      data: {
        requests,
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

    console.error('Get pending user requests error:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
}
