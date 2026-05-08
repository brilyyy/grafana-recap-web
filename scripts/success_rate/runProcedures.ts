/**
 * Runs stored procedures for success rate processing.
 * Loads procedure SQL from scripts/success_rate/{appKey}/procedure.{mysql|postgres}.sql
 */
import * as fs from 'fs'
import * as path from 'path'

export type ExecFn = (sql: string, params?: unknown[]) => Promise<unknown[]>

export async function runStoredProcedures(exec: ExecFn, isPg: boolean): Promise<void> {
  const { PROCEDURE_APPS } = await import('./registry')
  const baseDir = path.join(process.cwd(), 'scripts', 'success_rate')

  for (const { appKey, procedureName } of PROCEDURE_APPS) {
    const ext = isPg ? 'postgres' : 'mysql'
    const fileName = `procedure.${ext}.sql`
    const filePath = path.join(baseDir, appKey, fileName)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Procedure file not found: ${filePath}`)
    }

    const sql = fs.readFileSync(filePath, 'utf-8').trim()

    if (isPg) {
      await exec(sql)
      console.log(`  ✅ PostgreSQL ${procedureName} created/replaced`)
    } else {
      // MySQL: DROP first, then CREATE (procedure body contains semicolons, cannot split)
      await exec(`DROP PROCEDURE IF EXISTS ${procedureName}`)
      await exec(sql)
      console.log(`  ✅ MySQL ${procedureName} created/replaced`)
    }
  }
}
