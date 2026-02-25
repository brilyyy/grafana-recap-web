import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import type { ApiResponse } from '@/types'

// POST - Update multiple dictionary entries rc_description (bulk)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { updates } = body

    // Validate required fields
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Updates array is required and must not be empty',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate each update
    for (const update of updates) {
      if (!update.id || typeof update.id !== 'number') {
        return NextResponse.json(
          {
            success: false,
            message: 'Each update must have a valid id (number)',
          } as ApiResponse,
          { status: 400 }
        )
      }

      if (update.rc_description === undefined || update.rc_description === null) {
        return NextResponse.json(
          {
            success: false,
            message: `Each update must have rc_description for entry ID ${update.id}`,
          } as ApiResponse,
          { status: 400 }
        )
      }
    }

    const connection = await pool.getConnection()
    try {
      // Start transaction
      await connection.beginTransaction()

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      }

      // Process each update
      for (const update of updates) {
        try {
          const { id, rc_description } = update

          // Get dictionary entry details
          const [entryResult]: any = await connection.execute(
            'SELECT id_app_identifier, jenis_transaksi, rc FROM response_code_dictionary WHERE id = ?',
            [id]
          )

          if (entryResult.length === 0) {
            results.failed++
            results.errors.push(`Entry ID ${id}: Dictionary entry not found`)
            continue
          }

          // Update rc_description directly in response_code_dictionary table
          await connection.execute(
            'UPDATE response_code_dictionary SET rc_description = ? WHERE id = ?',
            [rc_description || null, id]
          )
          results.success++
        } catch (error: any) {
          results.failed++
          results.errors.push(`Entry ID ${update.id}: ${error.message}`)
        }
      }

      // Commit transaction
      await connection.commit()

      return NextResponse.json({
        success: true,
        message: `Successfully updated ${results.success} RC description(s). ${results.failed > 0 ? `Failed: ${results.failed}` : ''}`,
        data: {
          success: results.success,
          failed: results.failed,
          errors: results.errors,
        },
      } as ApiResponse & { data: { success: number; failed: number; errors: string[] } })
    } catch (error) {
      // Rollback on error
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('Error updating batch RC descriptions:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error updating batch RC descriptions: ' + error.message,
      } as ApiResponse,
      { status: 500 }
    )
  }
}

