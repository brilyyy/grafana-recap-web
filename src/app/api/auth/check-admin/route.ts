import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import type { ApiResponse } from '@/types'

/**
 * Check if admin or superadmin user exists
 * Public endpoint for registration page
 * Used to determine if new admin requests need approval
 */
export async function GET(request: NextRequest) {
  try {
    const [admins]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin' OR role = 'superadmin'"
    )

    return NextResponse.json({
      success: true,
      data: {
        adminExists: admins[0].count > 0,
      },
    } as ApiResponse)
  } catch (error: any) {
    console.error('Check admin error:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
}
