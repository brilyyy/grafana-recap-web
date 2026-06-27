import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadProcedureMetas } from '../src/db/sql-loader.ts'

const metas = [...loadProcedureMetas('success_rate'), ...loadProcedureMetas('recap_models')]

const entries = metas.map((m) => {
  const meta = m.meta
  const scope =
    meta.scope_type === 'fixed_app'
      ? { type: 'fixed_app', appKey: meta.app_key }
      : { type: 'per_app', appKey: meta.app_key }
  return {
    id: meta.id,
    recapKind: meta.recap_kind,
    title: meta.title,
    description: meta.description,
    briefProcessSummary: meta.brief_process_summary,
    briefQuery: meta.brief_query,
    outputTable: meta.output_table,
    functionName: meta.function_name || m.functionName,
    rawSqlRepoPath: meta.raw_sql_repo_path ?? '',
    scope,
  }
})

const outPath = resolve(import.meta.dirname, '..', 'src', 'lib', 'domain', 'recap', 'catalog-data.json')
writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n')
console.log(`Generated ${outPath} (${entries.length} entries)`)
