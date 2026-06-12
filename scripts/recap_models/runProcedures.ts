/**
 * Load and install custom recap PostgreSQL functions from scripts/recap_models/{modelKey}/procedure.postgres.sql
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { type SQL, sql } from 'drizzle-orm'
import { RECAP_MODEL_REGISTRY } from './registry'

/** Minimal drizzle database surface — satisfied by NodePgDatabase. */
export interface SqlExecutor {
  execute(query: SQL): Promise<unknown>
}

export async function runRecapModelStoredProcedures(db: SqlExecutor): Promise<void> {
  const baseDir = path.join(process.cwd(), 'scripts', 'recap_models')

  for (const { modelKey, functionName } of RECAP_MODEL_REGISTRY) {
    const filePath = path.join(baseDir, modelKey, 'procedure.postgres.sql')
    if (!fs.existsSync(filePath)) {
      throw new Error(`Recap procedure file not found: ${filePath}`)
    }
    const content = fs.readFileSync(filePath, 'utf-8').trim()
    await db.execute(sql.raw(content))
    console.log(`  ✅ PostgreSQL ${functionName} created/replaced`)
  }
}
