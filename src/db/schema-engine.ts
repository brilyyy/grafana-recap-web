/**
 * Schema engine — importable, side-effect-free core extracted from migrate.ts.
 *
 * Provides:
 *   - idempotent setup/migration phases parameterized by a drizzle `db` and a
 *     `log` sink (so both the CLI runner and the in-app "App Setup" tool can drive them)
 *   - a read-only `diagnose(db)` that reports schema/config drift against an
 *     EXPECTED manifest (powers the doctor checklist)
 *
 * The CLI wrapper lives in migrate.ts; the tRPC router in routers/setup.ts.
 */
import { randomUUID } from 'node:crypto'
import { hashPassword } from '../lib/password'
import { type SQL, sql } from 'drizzle-orm'
import type { Sql } from 'postgres'
import { applyFdwConfig } from '../lib/fdw-setup'
import { SEED_JOBS } from './seed-schedules'
import {
  CRON_DIR,
  extractFunctionName,
  INDEXES_DIR,
  loadPhaseStatements,
  loadProcedureFiles,
  SCHEMA_DIR,
  scanSqlObjects,
} from './sql-loader'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal drizzle surface — satisfied by both the app `db` and the CLI's migrationDb. */
export interface EngineDb {
  execute(query: SQL): Promise<unknown>
}

/** Where human-readable step lines are written (console.log for CLI, an array for the UI). */
export type LogSink = (line: string) => void

export type Phase = 'schema' | 'fdw' | 'procedures' | 'seed' | 'cron' | 'all'

// ─── Bound helpers (exec + existence checks for a given db) ──────────────────────

function bind(db: EngineDb) {
  /** Run a raw (param-less) DDL/SQL string through drizzle. */
  const exec = async (text: string): Promise<unknown[]> => (await db.execute(sql.raw(text))) as unknown as unknown[]
  /** Run a parameterized drizzle `sql` template. */
  const execSql = async (query: SQL): Promise<unknown[]> => (await db.execute(query)) as unknown as unknown[]

  const tableExists = async (table: string): Promise<boolean> => {
    try {
      const rows = await execSql(
        sql`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=${table} LIMIT 1`,
      )
      return rows.length > 0
    } catch {
      return false
    }
  }

  const columnExists = async (table: string, column: string): Promise<boolean> => {
    try {
      const rows = await execSql(
        sql`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} AND column_name=${column} LIMIT 1`,
      )
      return rows.length > 0
    } catch {
      return false
    }
  }

  const indexExists = async (table: string, idx: string): Promise<boolean> => {
    try {
      const rows = await execSql(
        sql`SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename=${table} AND indexname=${idx} LIMIT 1`,
      )
      return rows.length > 0
    } catch {
      return false
    }
  }

  const createIndexSafely = async (
    idxName: string,
    table: string,
    columns: string[],
    unique = false,
  ): Promise<void> => {
    if (await indexExists(table, idxName)) return
    const u = unique ? 'UNIQUE' : ''
    await exec(
      `CREATE ${u} INDEX IF NOT EXISTS "${idxName}" ON "${table}" (${columns.map((c) => `"${c}"`).join(', ')})`,
    )
  }

  const pgEnumExists = async (name: string): Promise<boolean> => {
    try {
      const rows = await execSql(sql`SELECT 1 FROM pg_type WHERE typname=${name} AND typtype='e' LIMIT 1`)
      return rows.length > 0
    } catch {
      return false
    }
  }

  const functionExists = async (name: string): Promise<boolean> => {
    try {
      const rows = await execSql(
        sql`SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname=${name} LIMIT 1`,
      )
      return rows.length > 0
    } catch {
      return false
    }
  }

  /** Row count for a table. Table name comes from trusted registry constants only. */
  const rowCount = async (table: string): Promise<number> => {
    try {
      const rows = await execSql(sql.raw(`SELECT count(*)::int AS n FROM "${table}"`))
      return (rows[0] as { n: number } | undefined)?.n ?? 0
    } catch {
      return 0
    }
  }

  return {
    exec,
    execSql,
    tableExists,
    columnExists,
    indexExists,
    createIndexSafely,
    pgEnumExists,
    functionExists,
    rowCount,
  }
}

// ─── SQL-file appliers (the single source of truth lives in src/db/sql/) ────────

/** Execute every statement in a phase dir (01_schema / 02_indexes / 06_cron), in file order. */
async function applySqlDir(db: EngineDb, phaseDir: string, log: LogSink): Promise<void> {
  const { exec } = bind(db)
  let lastFile = ''
  for (const { file, sql: text } of loadPhaseStatements(phaseDir)) {
    if (file !== lastFile) {
      log(`  • ${file}`)
      lastFile = file
    }
    await exec(text)
  }
}

/** Execute each procedure file under 03_procedures/<subdir> as one blob (function bodies stay intact). */
async function applyProcedureFiles(db: EngineDb, subdir: string, log: LogSink): Promise<void> {
  const { exec } = bind(db)
  for (const { file, sql: text } of loadProcedureFiles(subdir)) {
    await exec(text)
    log(`  ✅ ${extractFunctionName(text) ?? file} created/replaced`)
  }
}

// ─── Managed columns + conflict-aware applier ─────────────────────────────────

export type ColumnResolution = 'null' | 'random'
/** Map of `${table}.${column}` → how to resolve a NOT NULL-on-populated conflict. */
export type ColumnResolutions = Record<string, ColumnResolution>

export interface ManagedColumn {
  table: string
  column: string
  type: string // SQL type, e.g. 'VARCHAR(255)'
  notNull?: boolean
  default?: string // SQL default expression (safe backfill); when set the add can never conflict
  randomSql?: string // SQL expression used to backfill existing rows when resolution = 'random'
}

export interface ColumnConflict {
  key: string // `${table}.${column}`
  table: string
  column: string
  type: string
  rowCount: number
}

/**
 * Every column the engine adds to an *already-existing* table. Safe entries are nullable or carry a
 * `default`; conflict-prone entries are NOT NULL with no default — adding them to a populated table
 * fails unless resolved (null = leave nullable, random = backfill via `randomSql` then SET NOT NULL).
 */
const MANAGED_COLUMNS: ManagedColumn[] = [
  // app_identifier — cross-db drift (nullable, safe)
  { table: 'app_identifier', column: 'db_name', type: 'VARCHAR(255)' },
  { table: 'app_identifier', column: 'raw_table_name', type: 'VARCHAR(255)' },
  { table: 'app_identifier', column: 'retention_days', type: 'INTEGER' },
  // raw_table_housekeeping (safe default)
  { table: 'raw_table_housekeeping', column: 'date_column_type', type: 'VARCHAR(50)', default: "'timestamp'" },
  // users — BetterAuth columns (nullable / defaulted, safe)
  { table: 'users', column: 'name', type: 'VARCHAR(255)' },
  { table: 'users', column: 'email_verified', type: 'INTEGER', default: '0' },
  { table: 'users', column: 'image', type: 'VARCHAR(500)' },
  // app_processing_log (recap_kind has a safe default; catalog_entry_id nullable)
  {
    table: 'app_processing_log',
    column: 'recap_kind',
    type: 'VARCHAR(64)',
    notNull: true,
    default: "'success_rate_daily'",
  },
  { table: 'app_processing_log', column: 'catalog_entry_id', type: 'VARCHAR(128)' },
  // recap_cms_corp_daily legacy upgrade — CONFLICT-PRONE (NOT NULL, no default)
  {
    table: 'recap_cms_corp_daily',
    column: 'jenis_transaksi',
    type: 'VARCHAR(1024)',
    notNull: true,
    randomSql: "'rnd_' || substr(md5(random()::text), 1, 12)",
  },
  {
    table: 'recap_cms_corp_daily',
    column: 'rc',
    type: 'VARCHAR(255)',
    notNull: true,
    randomSql: 'substr(md5(random()::text), 1, 6)',
  },
  {
    table: 'recap_cms_corp_daily',
    column: 'rc_description',
    type: 'TEXT',
    notNull: true,
    randomSql: "'random ' || substr(md5(random()::text), 1, 8)",
  },
  {
    table: 'recap_cms_corp_daily',
    column: 'status_transaksi',
    type: 'VARCHAR(64)',
    notNull: true,
    randomSql: "(ARRAY['Sukses','Gagal','Pending'])[floor(random()*3)+1]",
  },
  // recap_cms_corp_daily.error_type — nullable enum, safe
  { table: 'recap_cms_corp_daily', column: 'error_type', type: '"error_type_enum"' },
]

const isConflictProne = (spec: ManagedColumn): boolean => !!spec.notNull && !spec.default
const columnsFor = (table: string): ManagedColumn[] => MANAGED_COLUMNS.filter((c) => c.table === table)

/**
 * Idempotently add a managed column. Skips if the column exists or the table is absent. For a
 * NOT NULL column with no default on a *populated* table, resolves the conflict: 'random' backfills
 * generated values via `randomSql` then enforces NOT NULL; 'null' (default) adds it nullable.
 */
async function addColumnSafely(
  db: EngineDb,
  spec: ManagedColumn,
  resolution: ColumnResolution | undefined,
  log: LogSink,
): Promise<void> {
  const { exec, tableExists, columnExists, rowCount } = bind(db)
  if (!(await tableExists(spec.table))) return
  if (await columnExists(spec.table, spec.column)) return

  const conflict = isConflictProne(spec) && (await rowCount(spec.table)) > 0

  if (!conflict) {
    // Empty table, nullable, or defaulted → add with the full spec.
    const def = spec.default ? ` DEFAULT ${spec.default}` : ''
    const notNull = spec.notNull ? ' NOT NULL' : ''
    await exec(`ALTER TABLE "${spec.table}" ADD COLUMN "${spec.column}" ${spec.type}${def}${notNull}`)
    log(`  ✅ ${spec.table}.${spec.column} added`)
    return
  }

  // NOT NULL column on a populated table — add nullable first, then resolve.
  await exec(`ALTER TABLE "${spec.table}" ADD COLUMN "${spec.column}" ${spec.type}`)
  if ((resolution ?? 'null') === 'random' && spec.randomSql) {
    await exec(`UPDATE "${spec.table}" SET "${spec.column}" = ${spec.randomSql} WHERE "${spec.column}" IS NULL`)
    await exec(`ALTER TABLE "${spec.table}" ALTER COLUMN "${spec.column}" SET NOT NULL`)
    log(`  ✅ ${spec.table}.${spec.column} added → random backfill + NOT NULL`)
  } else {
    log(`  ✅ ${spec.table}.${spec.column} added nullable (conflict resolved → null)`)
  }
}

/**
 * Read-only pre-flight: which managed columns would conflict on apply — i.e. a NOT NULL column with
 * no default that is missing from a table that already has rows. Executes no DDL.
 */
export async function detectColumnConflicts(db: EngineDb): Promise<ColumnConflict[]> {
  const { tableExists, columnExists, rowCount } = bind(db)
  const conflicts: ColumnConflict[] = []
  for (const spec of MANAGED_COLUMNS) {
    if (!isConflictProne(spec)) continue
    if (!(await tableExists(spec.table))) continue
    if (await columnExists(spec.table, spec.column)) continue
    const n = await rowCount(spec.table)
    if (n > 0) {
      conflicts.push({
        key: `${spec.table}.${spec.column}`,
        table: spec.table,
        column: spec.column,
        type: spec.type,
        rowCount: n,
      })
    }
  }
  return conflicts
}

// ─── Phase 1: Core schema ────────────────────────────────────────────────────

export async function runCoreSchema(db: EngineDb, log: LogSink) {
  log('\n\uD83D\uDCD0 Phase 1: Core schema')

  // 1) Apply declarative DDL (tables, enums, triggers) from src/db/sql/01_schema.
  await applySqlDir(db, SCHEMA_DIR, log)

  // 2) Reconcile columns the engine adds to *pre-existing* tables (no-ops on fresh installs).
  for (const spec of columnsFor('app_identifier')) await addColumnSafely(db, spec, undefined, log)
  for (const spec of columnsFor('raw_table_housekeeping')) await addColumnSafely(db, spec, undefined, log)

  // 3) Long RC codes (e.g. GCM ERR_MAP_CD / exception paths) exceed legacy VARCHAR(50).
  const { exec, tableExists } = bind(db)
  for (const tbl of ['app_success_rate', 'response_code_dictionary', 'unmapped_rc'] as const) {
    if (await tableExists(tbl)) {
      try {
        await exec(`ALTER TABLE "${tbl}" ALTER COLUMN "rc" TYPE VARCHAR(255)`)
        log(`  \u2705 ${tbl}.rc \u2192 VARCHAR(255)`)
      } catch (e: unknown) {
        log(`  \u23ED  ${tbl}.rc alter skipped: ${(e as Error).message}`)
      }
    }
  }

  log('  \u2705 Phase 1 done')
}

// ─── Phase 2: BetterAuth tables ──────────────────────────────────────────────

export async function runBetterAuthSchema(db: EngineDb, log: LogSink) {
  log('\n\uD83D\uDD10 Phase 2: BetterAuth tables')
  // Tables are created by runCoreSchema (src/db/sql/01_schema). Reconcile BetterAuth
  // columns onto a pre-existing users table (no-ops on fresh installs).
  for (const spec of columnsFor('users')) {
    await addColumnSafely(db, spec, undefined, log)
  }
  log('  \u2705 Phase 2 done')
}

// ─── Phase 3: app_processing_log ─────────────────────────────────────────────

export async function runProcessingLogSchema(db: EngineDb, log: LogSink) {
  const { exec } = bind(db)
  log('\n\uD83D\uDCCB Phase 3: app_processing_log')
  // Table created by runCoreSchema. Reconcile added columns, then backfill catalog_entry_id.
  for (const spec of columnsFor('app_processing_log')) {
    await addColumnSafely(db, spec, undefined, log)
  }
  await exec(`
    UPDATE "app_processing_log"
    SET "catalog_entry_id" = CASE
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'cms_corp_daily' AND "app_name" = 'CMS' THEN 'cms_corp_daily'
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'bale_korpora_corp_daily' AND "app_name" = 'Bale Korpora' THEN 'bale_korpora_corp_daily'
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'success_rate_daily' AND "app_name" = 'Bale' THEN 'sr:bale'
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'success_rate_daily' AND "app_name" = 'Bale Bisnis' THEN 'sr:bale_bisnis'
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'success_rate_daily' AND "app_name" = 'OLOB' THEN 'sr:olob'
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'success_rate_daily' AND "app_name" = 'EDC Agen' THEN 'sr:edc_agen'
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'success_rate_daily' AND "app_name" = 'EDC Merchant' THEN 'sr:edc_merchant'
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'success_rate_daily' AND "app_name" = 'EDC Merchant Ancol' THEN 'sr:edc_merchant_ancol'
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'success_rate_daily' AND "app_name" = 'CMS' THEN 'sr:cms'
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'success_rate_daily' AND "app_name" = 'Bale Korpora' THEN 'sr:bale_korpora'
      WHEN COALESCE("recap_kind", 'success_rate_daily') = 'success_rate_daily' AND "app_name" = 'Debit Online' THEN 'sr:debit_online'
      ELSE "catalog_entry_id"
    END
    WHERE "catalog_entry_id" IS NULL
  `)
  log('  \u2705 Phase 3 done')
}

// ─── Phase 3b: Custom recap output tables ─────────────────────────────────────

export async function runRecapModelTables(db: EngineDb, log: LogSink, resolutions: ColumnResolutions = {}) {
  const { exec, tableExists, columnExists } = bind(db)
  log('\n\uD83D\uDCCA Phase 3b: recap model tables')
  // Tables created by runCoreSchema. Upgrade a legacy recap_cms_corp_daily that predates the
  // CORP \u00D7 jenis \u00D7 RC \u00D7 status grain (adds NOT NULL columns + swaps the unique key).
  if ((await tableExists('recap_cms_corp_daily')) && !(await columnExists('recap_cms_corp_daily', 'jenis_transaksi'))) {
    for (const spec of columnsFor('recap_cms_corp_daily')) {
      if (isConflictProne(spec)) {
        await addColumnSafely(db, spec, resolutions[`${spec.table}.${spec.column}`], log)
      }
    }
    // A UNIQUE constraint permits multiple NULLs, so the swap works under either resolution.
    await exec(`
      ALTER TABLE "recap_cms_corp_daily"
      DROP CONSTRAINT IF EXISTS "recap_cms_corp_daily_id_app_identifier_tanggal_transaksi_corp_id_key"
    `)
    await exec(`
      ALTER TABLE "recap_cms_corp_daily"
      ADD CONSTRAINT "recap_cms_corp_daily_grain_key" UNIQUE (
        "id_app_identifier",
        "tanggal_transaksi",
        "corp_id",
        "jenis_transaksi",
        "rc",
        "rc_description",
        "status_transaksi"
      )
    `)
    log('  \u2705 recap_cms_corp_daily upgraded to CORP \u00D7 jenis \u00D7 RC \u00D7 status grain')
  }
  const errorTypeSpec = columnsFor('recap_cms_corp_daily').find((c) => c.column === 'error_type')
  if (errorTypeSpec) await addColumnSafely(db, errorTypeSpec, undefined, log)
  log('  \u2705 Phase 3b done')
}

export async function runRecapModelProcedures(db: EngineDb, log: LogSink) {
  log('\n\u2699\uFE0F  Phase 5b: Custom recap stored procedures (PostgreSQL)')
  await applyProcedureFiles(db, 'recap_models', log)
  log('  \u2705 Phase 5b done')
}

// ─── Phase 4: Performance indexes ────────────────────────────────────────────

export async function runPerformanceIndexes(db: EngineDb, log: LogSink) {
  log('\n\uD83D\uDD0D Phase 4: Performance indexes')
  await applySqlDir(db, INDEXES_DIR, log)
  log('  \u2705 Phase 4 done')
}

// ─── Phase 4b: PostgreSQL FDW (postgres_fdw) ──────────────────────────────────

export async function runFdwSetup(_db: EngineDb, log: LogSink, client?: Sql) {
  log('\n🔗 Phase 4b: postgres_fdw setup')
  if (!client) {
    log('  ⚠️  No raw SQL client provided – skipping FDW setup')
    return
  }
  const result = await applyFdwConfig(client)
  for (const err of result.errors) {
    log(`  ⚠️  ${err}`)
  }
  log(`  ✅ FDW: ${result.serversProcessed} servers, ${result.tablesProcessed} tables processed`)
  log('  ✅ Phase 4b done')
}

// ─── Phase 5: Stored procedures ──────────────────────────────────────────────

export async function runStoredProcedures(db: EngineDb, log: LogSink) {
  log('\n\u2699\uFE0F  Phase 5: Stored procedures')
  await applyProcedureFiles(db, '_shared', log)
  await applyProcedureFiles(db, 'success_rate', log)
  log('  \u2705 Phase 5 done')
}

// ─── Phase 6: Seeds ──────────────────────────────────────────────────────────

export async function runSeeds(db: EngineDb, log: LogSink) {
  const { execSql, columnExists } = bind(db)
  log('\n🌱 Phase 7: Seeds')
  log(
    '  ℹ️  Skipping app_identifier, fdw_source_table, and raw_table_housekeeping seeds (use existing DB data / Superadmin UI).',
  )

  // Superadmin users
  const usernames = (process.env.DEFAULT_SU_USERNAME ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const passwords = (process.env.DEFAULT_SU_PASSWORD ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const emails = (process.env.DEFAULT_SU_EMAIL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (usernames.length === 0 || passwords.length === 0) {
    log('  ⏭  No DEFAULT_SU_USERNAME/PASSWORD set – skipping superadmin seed')
    return
  }
  if (usernames.length !== passwords.length) {
    throw new Error('DEFAULT_SU_USERNAME and DEFAULT_SU_PASSWORD must have the same number of comma-separated values')
  }

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i]
    const password = passwords[i]
    // BetterAuth normalises emails to lowercase before querying – always store lowercase
    const email = (emails[i] ?? `${username}@superadmin.local`).toLowerCase()

    if (password.length < 8) {
      log(`  ⚠️  Password for ${username} is too short – skipping`)
      continue
    }

    const passwordHash = await hashPassword(password)
    try {
      // ── Insert / upsert into `users` (application table) ──────────────────
      let userId: number | null = null
      const hasBetterAuthCols = await columnExists('users', 'email_verified')
      let rows: unknown[]
      if (hasBetterAuthCols) {
        rows = await execSql(sql`
          INSERT INTO "users" ("username","email","password_hash","role","name","email_verified")
          VALUES (${username},${email},${passwordHash},'superadmin',${username},1)
          ON CONFLICT ("username") DO UPDATE SET
            "email"="excluded"."email",
            "password_hash"="excluded"."password_hash",
            "name"="excluded"."name",
            "email_verified"=1
          RETURNING "id"`)
      } else {
        rows = await execSql(sql`
          INSERT INTO "users" ("username","email","password_hash","role")
          VALUES (${username},${email},${passwordHash},'superadmin')
          ON CONFLICT ("username") DO UPDATE SET
            "email"="excluded"."email",
            "password_hash"="excluded"."password_hash"
          RETURNING "id"`)
      }
      userId = rows[0] ? ((rows[0] as Record<string, unknown>).id as number) : null

      log(`  ✅ Superadmin seeded: ${username} (id=${userId})`)

      // ── Insert / upsert into BetterAuth `account` (credential store) ──────
      // BetterAuth verifies passwords from `account.password`, not `users.password_hash`
      if (userId !== null) {
        const acct = await execSql(
          sql`SELECT "id" FROM "account" WHERE "provider_id"='credential' AND "user_id"=${userId} LIMIT 1`,
        )
        const existingAccountId = acct[0] ? ((acct[0] as Record<string, unknown>).id as string) : null

        if (existingAccountId) {
          await execSql(
            sql`UPDATE "account" SET "password"=${passwordHash},"updated_at"=NOW() WHERE "id"=${existingAccountId}`,
          )
          log(`  ✅ BetterAuth credential updated for: ${username}`)
        } else {
          const accountId = randomUUID()
          await execSql(sql`
            INSERT INTO "account" ("id","account_id","provider_id","user_id","password","created_at","updated_at")
            VALUES (${accountId},${String(userId)},'credential',${userId},${passwordHash},NOW(),NOW())`)
          log(`  ✅ BetterAuth credential account linked for: ${username}`)
        }
      } else {
        log(`  ⚠️  Could not determine userId for ${username} – skipping account link`)
      }
    } catch (e: unknown) {
      log(`  ⚠️  Failed to seed superadmin ${username}: ${(e as Error).message}`)
    }
  }

  log('  ✅ Phase 7 done')
}

// ─── Phase 7b: Auto-register existing DB procedures ──────────────────────────

async function migrateExistingProcedures(db: EngineDb, log: LogSink) {
  const { exec, execSql, tableExists } = bind(db)

  if (!(await tableExists('app_custom_procedure'))) {
    log('\n🔄 Skipping procedure migration (app_custom_procedure not yet created)')
    return
  }

  log('\n🔄 Phase 7b: Auto-register existing DB procedures')

  const existing = await execSql(sql`
    SELECT p.proname AS function_name,
           pg_get_functiondef(p.oid) AS sql_text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'sp_%'
      AND p.proname NOT IN (SELECT function_name FROM app_custom_procedure)
    ORDER BY p.proname
  `)

  if (existing.length === 0) {
    log('  ✅ No unregistered procedures found')
    return
  }

  const migratedApp = await execSql(sql`
    INSERT INTO app_identifier (app_name) VALUES ('Migrated')
    ON CONFLICT (app_name) DO UPDATE SET updated_at = NOW()
    RETURNING id
  `)
  const migratedAppId = (migratedApp[0] as Record<string, unknown>).id as number

  for (const row of existing as Record<string, unknown>[]) {
    const fn = row.function_name as string
    const sqlText = row.sql_text as string

    const appKey = fn
      .replace(/^sp_process_/, '')
      .replace(/^sp_recap_/, '')
      .replace(/_daily$/, '')

    const appMatch = await execSql(sql`
      SELECT id FROM app_identifier
      WHERE LOWER(REPLACE(app_name, ' ', '_')) = ${appKey}
         OR LOWER(app_name) = ${appKey.replace(/_/g, ' ')}
      LIMIT 1
    `)

    const appId = appMatch.length > 0 ? (appMatch[0] as Record<string, unknown>).id as number : migratedAppId

    await execSql(sql`
      INSERT INTO app_custom_procedure (id_app_identifier, function_name, recap_kind, output_table, sql_text)
      VALUES (${appId}, ${fn}, 'success_rate_daily', 'app_success_rate', ${sqlText})
      ON CONFLICT (function_name) DO NOTHING
    `)
    log(`  ✅ Registered: ${fn} → app_identifier id=${appId}`)
  }

  log('  ✅ Phase 7b done')
}

// ─── Phase 8: Scheduler jobs table + seed ────────────────────────────────────

export async function runCronSetup(db: EngineDb, log: LogSink) {
  const { exec } = bind(db)
  log('\n\u23F0 Phase 8: Scheduler jobs table')
  await applySqlDir(db, CRON_DIR, log)

  for (const job of SEED_JOBS) {
    const schedule = job.defaultSchedule.trim()
    await exec(`
      INSERT INTO "scheduler_jobs" ("name", "procedure", "schedule")
      VALUES ('${job.name.replace(/'/g, "''")}', '${job.procedure}', '${schedule.replace(/'/g, "''")}')
      ON CONFLICT ("procedure") DO NOTHING
    `)
  }
  log(`  \u2705 ${SEED_JOBS.length} scheduler jobs seeded (ON CONFLICT DO NOTHING)`)
  log('  \u2705 Phase 8 done')
}

// ─── Phase grouping (drives the App Setup "Migrate" buttons) ──────────────────

/** Run the full schema group: core + betterauth + processing log + recap tables + perf indexes. */
async function runSchemaGroup(db: EngineDb, log: LogSink, resolutions: ColumnResolutions = {}) {
  await runCoreSchema(db, log)
  await runBetterAuthSchema(db, log)
  await runProcessingLogSchema(db, log)
  await runRecapModelTables(db, log, resolutions)
  await runPerformanceIndexes(db, log)
}

/**
 * Apply a single phase (or all). `client` is required for the `fdw` and `all` phases.
 * `resolutions` resolves NOT NULL-on-populated conflicts during the schema group (default → null).
 */
export async function applyPhase(
  db: EngineDb,
  client: Sql | undefined,
  phase: Phase,
  log: LogSink,
  resolutions: ColumnResolutions = {},
): Promise<void> {
  switch (phase) {
    case 'schema':
      await runSchemaGroup(db, log, resolutions)
      break
    case 'fdw':
      await runFdwSetup(db, log, client)
      break
    case 'procedures':
      await runStoredProcedures(db, log)
      await runRecapModelProcedures(db, log)
      await migrateExistingProcedures(db, log)
      break
    case 'seed':
      await runSeeds(db, log)
      break
    case 'cron':
      await runCronSetup(db, log)
      break
    case 'all':
      await runSchemaGroup(db, log, resolutions)
      await runFdwSetup(db, log, client)
      await runStoredProcedures(db, log)
      await runRecapModelProcedures(db, log)
      await migrateExistingProcedures(db, log)
      await runSeeds(db, log)
      await runCronSetup(db, log)
      break
  }
}

// ─── Diagnose (read-only doctor) ──────────────────────────────────────────────

export type DiagnoseCategory = 'enum' | 'table' | 'column' | 'index' | 'function' | 'seed'
export type DiagnoseStatus = 'ok' | 'missing' | 'drift' | 'error'

export interface DiagnoseRow {
  category: DiagnoseCategory
  name: string
  status: DiagnoseStatus
  detail?: string
}

export interface DiagnoseReport {
  rows: DiagnoseRow[]
  summary: { ok: number; missing: number; drift: number; error: number; total: number }
  dbName: string
}

/** Columns the engine adds to pre-existing tables over time (drift-prone), grouped by table. */
function driftColumnsByTable(): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const c of MANAGED_COLUMNS) {
    const arr = m.get(c.table) ?? []
    arr.push(c.column)
    m.set(c.table, arr)
  }
  return m
}

/** Read-only schema/config health check derived from the src/db/sql/ source of truth. Executes no DDL. */
export async function diagnose(db: EngineDb): Promise<DiagnoseReport> {
  const { execSql, tableExists, columnExists, indexExists, pgEnumExists, functionExists } = bind(db)
  const rows: DiagnoseRow[] = []
  const objects = scanSqlObjects()
  const drift = driftColumnsByTable()

  // Enums
  for (const e of objects.enums) {
    rows.push({ category: 'enum', name: e, status: (await pgEnumExists(e)) ? 'ok' : 'missing' })
  }

  // Tables + drift-prone columns
  for (const t of objects.tables) {
    if (!(await tableExists(t))) {
      rows.push({ category: 'table', name: t, status: 'missing' })
      continue
    }
    rows.push({ category: 'table', name: t, status: 'ok' })
    for (const c of drift.get(t) ?? []) {
      const has = await columnExists(t, c)
      rows.push({
        category: 'column',
        name: `${t}.${c}`,
        status: has ? 'ok' : 'drift',
        detail: has ? undefined : 'column missing — run schema migration',
      })
    }
  }

  // Indexes (only when the host table exists)
  for (const { table, name } of objects.indexes) {
    if (!(await tableExists(table))) {
      rows.push({ category: 'index', name, status: 'missing', detail: `table ${table} absent` })
      continue
    }
    rows.push({ category: 'index', name, status: (await indexExists(table, name)) ? 'ok' : 'missing' })
  }

  // Functions / stored procedures
  for (const f of objects.functions) {
    rows.push({ category: 'function', name: `${f}()`, status: (await functionExists(f)) ? 'ok' : 'missing' })
  }

  // Seeds: ≥1 superadmin, scheduler_jobs populated
  try {
    const r = (await execSql(sql`SELECT COUNT(*)::int AS n FROM "users" WHERE "role"='superadmin'`)) as { n: number }[]
    const n = r[0]?.n ?? 0
    rows.push({
      category: 'seed',
      name: 'superadmin user',
      status: n >= 1 ? 'ok' : 'missing',
      detail: `${n} found`,
    })
  } catch {
    rows.push({ category: 'seed', name: 'superadmin user', status: 'error', detail: 'users table absent' })
  }

  try {
    const r = (await execSql(sql`SELECT COUNT(*)::int AS n FROM "scheduler_jobs"`)) as { n: number }[]
    const n = r[0]?.n ?? 0
    rows.push({
      category: 'seed',
      name: 'scheduler_jobs',
      status: n >= SEED_JOBS.length ? 'ok' : 'drift',
      detail: `${n}/${SEED_JOBS.length} jobs`,
    })
  } catch {
    rows.push({ category: 'seed', name: 'scheduler_jobs', status: 'error', detail: 'scheduler_jobs table absent' })
  }

  const summary = {
    ok: rows.filter((r) => r.status === 'ok').length,
    missing: rows.filter((r) => r.status === 'missing').length,
    drift: rows.filter((r) => r.status === 'drift').length,
    error: rows.filter((r) => r.status === 'error').length,
    total: rows.length,
  }

  return { rows, summary, dbName: process.env.DB_NAME ?? 'unknown' }
}
