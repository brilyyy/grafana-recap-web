/**
 * Load and install custom recap PostgreSQL functions from scripts/recap_models/{modelKey}/procedure.postgres.sql
 */
import * as fs from 'fs'
import * as path from 'path'
import { RECAP_MODEL_REGISTRY } from './registry'

export type ExecFn = (sql: string, params?: unknown[]) => Promise<unknown[]>

export async function runRecapModelStoredProcedures(exec: ExecFn): Promise<void> {
  const baseDir = path.join(process.cwd(), 'scripts', 'recap_models')

  for (const { modelKey, functionName } of RECAP_MODEL_REGISTRY) {
    const filePath = path.join(baseDir, modelKey, 'procedure.postgres.sql')
    if (!fs.existsSync(filePath)) {
      throw new Error(`Recap procedure file not found: ${filePath}`)
    }
    const sql = fs.readFileSync(filePath, 'utf-8').trim()
    await exec(sql)
    console.log(`  ✅ PostgreSQL ${functionName} created/replaced`)
  }
}
