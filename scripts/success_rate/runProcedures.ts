/**
 * Runs stored procedures for success rate processing.
 * Loads procedure SQL from scripts/success_rate/{appKey}/procedure.postgres.sql
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { type SQL, sql } from 'drizzle-orm'
import { PROCEDURE_APPS } from './registry'

/** Minimal drizzle database surface — satisfied by NodePgDatabase. */
export interface SqlExecutor {
  execute(query: SQL): Promise<unknown>
}

export async function runStoredProcedures(db: SqlExecutor): Promise<void> {
  const baseDir = path.join(process.cwd(), 'scripts', 'success_rate')

  for (const { appKey, procedureName } of PROCEDURE_APPS) {
    const filePath = path.join(baseDir, appKey, 'procedure.postgres.sql')

    if (!fs.existsSync(filePath)) {
      throw new Error(`Procedure file not found: ${filePath}`)
    }

    const content = fs.readFileSync(filePath, 'utf-8').trim()
    await db.execute(sql.raw(content))
    console.log(`  ✅ ${procedureName} created/replaced`)
  }
}
