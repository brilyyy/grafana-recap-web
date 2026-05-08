import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  try {
    const connection = await pool.getConnection()
    connection.release()
    return NextResponse.json({
      status: 'connected',
      message: 'Database connection successful',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'disconnected',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

