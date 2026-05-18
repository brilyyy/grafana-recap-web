/**
 * Runs stored procedures for success rate processing.
 * Loads procedure SQL from scripts/success_rate/{appKey}/procedure.postgres.sql
 */
import * as fs from 'fs'
import * as path from 'path'

export type ExecFn = (sql: string, params?: unknown[]) => Promise<unknown[]>

export async function runStoredProcedures(exec: ExecFn): Promise<void> {
  const { PROCEDURE_APPS } = await import('./registry')
  const baseDir = path.join(process.cwd(), 'scripts', 'success_rate')

  for (const { appKey, procedureName } of PROCEDURE_APPS) {
    const fileName = 'procedure.postgres.sql'
    const filePath = path.join(baseDir, appKey, fileName)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Procedure file not found: ${filePath}`)
    }

    const sql = fs.readFileSync(filePath, 'utf-8').trim()
    await exec(sql)
    console.log(`  ✅ ${procedureName} created/replaced`)
  }
}
