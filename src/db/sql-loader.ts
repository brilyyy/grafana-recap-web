/**
 * SQL loader — the single mechanism that turns the `src/db/sql/` tree into
 * executable statements and into metadata for the migration engine, the diagnose
 * doctor, the recap catalog, and the index analyzer.
 *
 * Layout (numeric-prefixed phase dirs run in lexicographic order):
 *   src/db/sql/01_schema/     CREATE TABLE / TYPE / TRIGGER (idempotent)
 *   src/db/sql/02_indexes/    CREATE INDEX (idempotent)
 *   src/db/sql/03_procedures/ CREATE OR REPLACE FUNCTION (+ @meta frontmatter)
 *   src/db/sql/06_cron/       scheduler_jobs DDL
 *   src/db/sql/reference/     NOT auto-run (raw table creation, grafana exports)
 *
 * Procedure files carry a structured frontmatter block consumed by the recap
 * catalog so a single .sql file is the only place a procedure is defined:
 *
 *   /* @meta
 *   id: sr:bale
 *   recap_kind: success_rate_daily
 *   title: Bale — success rate (daily)
 *   ...
 *   @endmeta *\/
 *   CREATE OR REPLACE FUNCTION public.sp_process_bale_daily(...) ...
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

/** Repo-root-relative SQL home. Resolved from cwd to match the deploy layout (repo root is the runtime cwd). */
export const SQL_ROOT = path.join(process.cwd(), 'src', 'db', 'sql')

/** Phase directories the engine executes, in order. `reference/` is intentionally excluded. */
export const SCHEMA_DIR = '01_schema'
export const INDEXES_DIR = '02_indexes'
export const PROCEDURES_DIR = '03_procedures'
export const CRON_DIR = '06_cron'

// ─── Statement splitting (dollar-quote / string / comment aware) ───────────────

/**
 * Split a SQL string into individual statements on top-level `;`, correctly
 * skipping semicolons inside single/double quotes, line/block comments, and
 * `$tag$ … $tag$` dollar-quoted bodies (so PL/pgSQL function bodies stay intact).
 */
export function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = []
  let buf = ''
  let i = 0
  const n = sqlText.length
  let inLineComment = false
  let inBlockComment = false
  let inSingle = false
  let inDouble = false
  let dollarTag: string | null = null

  while (i < n) {
    const ch = sqlText[i]

    if (inLineComment) {
      buf += ch
      if (ch === '\n') inLineComment = false
      i++
      continue
    }
    if (inBlockComment) {
      if (sqlText.startsWith('*/', i)) {
        buf += '*/'
        i += 2
        inBlockComment = false
        continue
      }
      buf += ch
      i++
      continue
    }
    if (dollarTag) {
      if (sqlText.startsWith(dollarTag, i)) {
        buf += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      buf += ch
      i++
      continue
    }
    if (inSingle) {
      buf += ch
      if (ch === "'") {
        if (sqlText[i + 1] === "'") {
          buf += "'"
          i += 2
          continue
        }
        inSingle = false
      }
      i++
      continue
    }
    if (inDouble) {
      buf += ch
      if (ch === '"') inDouble = false
      i++
      continue
    }

    // Not inside any quoted/comment state.
    if (sqlText.startsWith('--', i)) {
      inLineComment = true
      buf += '--'
      i += 2
      continue
    }
    if (sqlText.startsWith('/*', i)) {
      inBlockComment = true
      buf += '/*'
      i += 2
      continue
    }
    if (ch === "'") {
      inSingle = true
      buf += ch
      i++
      continue
    }
    if (ch === '"') {
      inDouble = true
      buf += ch
      i++
      continue
    }
    if (ch === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(sqlText.slice(i))
      if (m) {
        dollarTag = m[0]
        buf += dollarTag
        i += dollarTag.length
        continue
      }
    }
    if (ch === ';') {
      const stmt = buf.trim()
      if (stmt) statements.push(stmt)
      buf = ''
      i++
      continue
    }
    buf += ch
    i++
  }
  const tail = buf.trim()
  if (tail) statements.push(tail)
  return statements
}

// ─── File discovery ───────────────────────────────────────────────────────────

/** Recursively list `*.sql` files under a phase dir, sorted by full path (deterministic order). */
export function listSqlFiles(phaseDir: string): string[] {
  const root = path.join(SQL_ROOT, phaseDir)
  if (!fs.existsSync(root)) return []
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith('.sql')) out.push(full)
    }
  }
  walk(root)
  return out.sort((a, b) => a.localeCompare(b))
}

export interface LoadedStatement {
  file: string // path relative to SQL_ROOT
  sql: string
}

/** Load every statement from a phase dir, in file then statement order. */
export function loadPhaseStatements(phaseDir: string): LoadedStatement[] {
  const out: LoadedStatement[] = []
  for (const file of listSqlFiles(phaseDir)) {
    const rel = path.relative(SQL_ROOT, file)
    const text = fs.readFileSync(file, 'utf-8')
    for (const stmt of splitSqlStatements(text)) out.push({ file: rel, sql: stmt })
  }
  return out
}

/** Load each procedure file as a single raw blob (function bodies execute whole, frontmatter included). */
export function loadProcedureFiles(subdir?: string): { file: string; sql: string }[] {
  const dir = subdir ? path.join(PROCEDURES_DIR, subdir) : PROCEDURES_DIR
  return listSqlFiles(dir).map((file) => ({
    file: path.relative(SQL_ROOT, file),
    sql: fs.readFileSync(file, 'utf-8').trim(),
  }))
}

// ─── Frontmatter parsing ───────────────────────────────────────────────────────

/** Parse the `/* @meta … @endmeta *\/` block into a flat key→value map (multi-line values joined with \n). */
export function parseSqlMeta(text: string): Record<string, string> {
  const m = /\/\*\s*@meta\b([\s\S]*?)@endmeta\s*\*\//.exec(text)
  if (!m) return {}
  const out: Record<string, string> = {}
  let key: string | null = null
  for (const raw of m[1].split('\n')) {
    const line = raw.replace(/\s+$/, '')
    const field = /^\s*([a-z_]+):\s?(.*)$/.exec(line)
    if (field) {
      key = field[1]
      out[key] = field[2]
    } else if (key && line.trim() !== '') {
      out[key] += `\n${line.trim()}`
    }
  }
  for (const k of Object.keys(out)) out[k] = out[k].trim()
  return out
}

/** Function name from the first `CREATE [OR REPLACE] FUNCTION [public.]name(` in a file. */
export function extractFunctionName(text: string): string | null {
  const m = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z0-9_]+)"?/i.exec(text)
  return m ? m[1] : null
}

export interface ProcedureMeta {
  file: string // relative to SQL_ROOT
  functionName: string
  meta: Record<string, string>
}

/**
 * All procedure files under a subdir with their parsed frontmatter + function name.
 * Drives the recap catalog (no registry needed — the .sql file is the source of truth).
 */
export function loadProcedureMetas(subdir: string): ProcedureMeta[] {
  const dir = path.join(PROCEDURES_DIR, subdir)
  const out: ProcedureMeta[] = []
  for (const file of listSqlFiles(dir)) {
    const text = fs.readFileSync(file, 'utf-8')
    const functionName = extractFunctionName(text)
    if (!functionName) continue // skip helper/shared files without a single named function
    out.push({ file: path.relative(SQL_ROOT, file), functionName, meta: parseSqlMeta(text) })
  }
  return out
}

// ─── Object scanner (drives diagnose + analyzer drift) ─────────────────────────

export interface SqlObjects {
  tables: string[]
  enums: string[]
  indexes: { table: string; name: string }[]
  functions: string[]
}

/** Strip line + block comments so scanning never matches DDL keywords mentioned in prose. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

/** Scan the executed phase dirs for the objects they create (names only). Deduped, sorted. */
export function scanSqlObjects(): SqlObjects {
  const tables = new Set<string>()
  const enums = new Set<string>()
  const functions = new Set<string>()
  const indexes: { table: string; name: string }[] = []
  const seenIdx = new Set<string>()

  for (const dir of [SCHEMA_DIR, INDEXES_DIR, PROCEDURES_DIR, CRON_DIR]) {
    for (const file of listSqlFiles(dir)) {
      const text = stripComments(fs.readFileSync(file, 'utf-8'))
      for (const m of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_]+)"?/gi)) {
        tables.add(m[1])
      }
      for (const m of text.matchAll(/create\s+type\s+"?([a-z0-9_]+)"?\s+as\s+enum/gi)) {
        enums.add(m[1])
      }
      for (const m of text.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
        functions.add(m[1])
      }
      for (const m of text.matchAll(
        /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?"?([a-z0-9_]+)"?\s+on\s+"?([a-z0-9_]+)"?/gi,
      )) {
        const key = `${m[2]}.${m[1]}`
        if (!seenIdx.has(key)) {
          seenIdx.add(key)
          indexes.push({ name: m[1], table: m[2] })
        }
      }
    }
  }
  return {
    tables: [...tables].sort(),
    enums: [...enums].sort(),
    functions: [...functions].sort(),
    indexes: indexes.sort((a, b) => `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`)),
  }
}
