import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { env } from '@/env'
import type { ApiResponse, Application } from '@/types'

const isPostgres = env.DB_TYPE === 'postgresql' || env.DB_TYPE === 'postgres'

function isDuplicateError(error: any): boolean {
  return error?.code === 'ER_DUP_ENTRY' || error?.code === 1062 || error?.code === '23505'
}

// GET - Fetch all applications
export async function GET() {
  try {
    const [rows] = await pool.execute(
      'SELECT id, app_name FROM app_identifier ORDER BY app_name'
    )
    
    return NextResponse.json({
      success: true,
      data: rows,
    } as ApiResponse<Application[]>)
  } catch (error: any) {
    console.error('Error fetching applications:', error.message)
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}

// POST - Add new application
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { appName } = body

    if (!appName || !appName.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Application name is required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    const insertSql = isPostgres
      ? 'INSERT INTO app_identifier (app_name) VALUES (?) RETURNING id'
      : 'INSERT INTO app_identifier (app_name) VALUES (?)'
    const [rows] = await pool.execute(insertSql, [appName.trim()])
    const insertId = isPostgres
      ? (rows[0] as any)?.id
      : (rows[0] as any)?.insertId ?? 0

    return NextResponse.json({
      success: true,
      message: 'Application added successfully',
      data: {
        id: insertId,
        appName: appName.trim(),
      },
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error adding application:', error.message)

    if (isDuplicateError(error)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Application name already exists',
        } as ApiResponse,
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}
