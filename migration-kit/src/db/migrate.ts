#!/usr/bin/env node
/**
 * Comprehensive Drizzle Migration Runner
 *
 * Phases:
 *   1. Core schema        – all application tables + basic indexes + FKs
 *   2. BetterAuth tables  – ALTER users, session, account, verification
 *   3. Processing log     – app_processing_log + indexes
 *   4. Performance idx    – additional composite indexes
 *   5. Stored procedures  – sp_process_*_daily (PostgreSQL functions)
 *   6. Cron setup         – pg_cron (PostgreSQL only)
 *   7. Seeds              – default app identifiers + superadmin user(s)
 *
 * Usage:
 *   npx tsx src/db/migrate.ts [--schema-only] [--procedures-only] [--cron-only] [--seed-only]
 *
 * Environment:
 *   Reads from .env – see src/env.ts for required variables.
 *   When running on the PostgreSQL "cron default database" (the one with pg_cron installed),
 *   schema/procedure phases are skipped and only cron jobs are created.
 */

import * as dotenv from 'dotenv'
dotenv.config()

import bcrypt from 'bcryptjs'
import { randomUUID, randomBytes, scrypt } from 'crypto'
import { runStoredProcedures as runProcedures } from '../../scripts/success_rate/runProcedures'

/**
 * Hash a password in BetterAuth's own format: `<hexSalt>:<hexKey>`
 * Uses the same scrypt parameters BetterAuth uses internally
 * (N:16384, r:16, p:1, keyLen:64).
 */
function hashForBetterAuth(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex')
    scrypt(password.normalize('NFKC'), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }, (err, key) => {
      if (err) reject(err)
      else resolve(`${salt}:${key.toString('hex')}`)
    })
  })
}

// ─── Argument parsing ───────────────────────────────────────────────────────

const args = process.argv.slice(2)
const ONLY_SCHEMA = args.includes('--schema-only')
const ONLY_PROCEDURES = args.includes('--procedures-only')
const ONLY_CRON = args.includes('--cron-only')
const ONLY_SEED = args.includes('--seed-only')
const ONLY_FDW = args.includes('--fdw-only')
const RUN_ALL = !ONLY_SCHEMA && !ONLY_PROCEDURES && !ONLY_CRON && !ONLY_SEED && !ONLY_FDW

// ─── Database connection helpers ────────────────────────────────────────────

const DB_TYPE = (process.env.DB_TYPE ?? 'postgresql').toLowerCase()

const DB_HOST = process.env.DB_HOST ?? 'localhost'
const DB_PORT = parseInt(process.env.DB_PORT ?? '5432', 10)
const DB_USER = process.env.DB_USER ?? 'root'
const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
const DB_NAME = process.env.DB_NAME ?? 'platform_db'
const DB_USER_TARGET = process.env.DB_USER_TARGET?.trim() || null

// ─── Cron / scheduling ──────────────────────────────────────────────────────

const CRON_SCHEDULE = process.env.BALE_PROCESSING_SCHEDULE ?? '1 0 * * *'
const CRON_SCHEDULE_BALE_BISNIS = process.env.BALE_BISNIS_PROCESSING_SCHEDULE ?? '1 0 * * *'
const CRON_SCHEDULE_OLOB = process.env.OLOB_PROCESSING_SCHEDULE ?? '1 0 * * *'
const USE_APP_SCHEDULER = process.env.USE_APP_LEVEL_SCHEDULER === 'true'

function getTargetDatabases(): string[] {
  const raw = process.env.TARGET_DATABASES?.trim()
  if (!raw) return ['platform_db', 'platform_db_dev']
  return raw.split(',').map((d) => d.trim()).filter(Boolean)
}

/** Derive db_name from app_name: lowercase + _db, spaces/special -> underscore */
function deriveDbName(appName: string): string {
  const base = appName.toLowerCase().trim().replace(/[\s\-\.]+/g, '_').replace(/[^a-z0-9_]/g, '')
  return `${base || 'unknown'}_db`
}

/** Derive raw_table_name from app_name: raw_ + same as db_name base */
function deriveRawTableName(appName: string): string {
  const base = appName.toLowerCase().trim().replace(/[\s\-\.]+/g, '_').replace(/[^a-z0-9_]/g, '')
  return `raw_${base || 'unknown'}`
}

// ─── Low-level query executor ────────────────────────────────────────────────

type ExecFn = (sql: string, params?: unknown[]) => Promise<unknown[]>
let exec!: ExecFn
let closeDb!: () => Promise<void>

async function initConnection() {
  const { Pool } = await import('pg')
  const pool = new Pool({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME })
  exec = async (sql, params) => {
    const result = await pool.query(sql, params as unknown[])
    return result.rows
  }
  closeDb = () => pool.end()
}

// ─── Safety helpers ──────────────────────────────────────────────────────────

async function isDefaultCronDb(): Promise<boolean> {
  try {
    const rows = await exec(`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS exists`)
    const row = rows[0] as Record<string, unknown>
    return row?.exists === true || row?.exists === 't' || row?.exists === 1
  } catch { return false }
}

async function tableExists(table: string): Promise<boolean> {
  try {
    const rows = await exec(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1`,
      [table],
    )
    return rows.length > 0
  } catch { return false }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const rows = await exec(
      `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
      [table, column],
    )
    return rows.length > 0
  } catch { return false }
}

async function indexExists(table: string, idx: string): Promise<boolean> {
  try {
    const rows = await exec(
      `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename=$1 AND indexname=$2 LIMIT 1`,
      [table, idx],
    )
    return rows.length > 0
  } catch { return false }
}

async function createIndexSafely(
  idxName: string, table: string, columns: string[], unique = false,
): Promise<void> {
  if (await indexExists(table, idxName)) return
  const u = unique ? 'UNIQUE' : ''
  await exec(`CREATE ${u} INDEX IF NOT EXISTS "${idxName}" ON "${table}" (${columns.map((c) => `"${c}"`).join(', ')})`)
}

async function pgEnumExists(name: string): Promise<boolean> {
  try {
    const rows = await exec(`SELECT 1 FROM pg_type WHERE typname=$1 AND typtype='e' LIMIT 1`, [name])
    return rows.length > 0
  } catch { return false }
}

// ─── Phase 1: Core schema ────────────────────────────────────────────────────

async function runCoreSchema() {
  console.log('\n📐 Phase 1: Core schema')

  // PostgreSQL: shared trigger function + enums
  await exec(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql
    `)

  for (const [typName, vals] of [
      ['user_role',        "'superadmin','admin','user'"],
      ['requested_role',   "'admin','user'"],
      ['request_status',   "'pending','approved','rejected'"],
      ['error_type_enum',  "'S','N','Sukses'"],
      ['proc_status_enum', "'running','success','failed'"],
    ] as [string, string][]) {
    if (!(await pgEnumExists(typName))) {
      await exec(`CREATE TYPE "${typName}" AS ENUM (${vals})`)
    }
  }

  // ── app_identifier ────────────────────────────────────────────────────────
  if (!(await tableExists('app_identifier'))) {
    await exec(`
        CREATE TABLE "app_identifier" (
          "id"              SERIAL PRIMARY KEY,
          "app_name"        VARCHAR(255) NOT NULL UNIQUE,
          "db_name"         VARCHAR(255),
          "raw_table_name"  VARCHAR(255),
          "created_at"      TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at"      TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
    await exec(`
      CREATE TRIGGER "upd_app_identifier_updated_at"
        BEFORE UPDATE ON "app_identifier"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `)
    console.log('  ✅ app_identifier created')
  } else {
    console.log('  ⏭  app_identifier exists')
    // Add db_name and raw_table_name if missing (cross-db migration)
    if (!(await columnExists('app_identifier', 'db_name'))) {
      await exec(`ALTER TABLE "app_identifier" ADD COLUMN "db_name" VARCHAR(255)`)
      console.log('  ✅ app_identifier.db_name added')
    }
    if (!(await columnExists('app_identifier', 'raw_table_name'))) {
      await exec(`ALTER TABLE "app_identifier" ADD COLUMN "raw_table_name" VARCHAR(255)`)
      console.log('  ✅ app_identifier.raw_table_name added')
    }
    // Backfill db_name/raw_table_name for existing rows (exclude EDC apps that use fdw_source_table)
    const rows = await exec(
      `SELECT id, app_name FROM "app_identifier" WHERE ("db_name" IS NULL OR "raw_table_name" IS NULL) AND "app_name" NOT IN ('EDC Agen', 'EDC Merchant', 'EDC Merchant Ancol')`,
    )
    for (const row of rows as { id: number; app_name: string }[]) {
      const dbName = deriveDbName(row.app_name)
      const rawTableName = row.app_name === 'OLOB' ? 'openaccount_syslog' : deriveRawTableName(row.app_name)
      await exec('UPDATE "app_identifier" SET "db_name"=$1, "raw_table_name"=$2 WHERE "id"=$3', [dbName, rawTableName, row.id])
    }
    if (rows.length > 0) console.log(`  ✅ Backfilled db_name/raw_table_name for ${rows.length} app(s)`)
  }
  await createIndexSafely('idx_app_name', 'app_identifier', ['app_name'])

  // ── fdw_source_table (shared FDW sources for apps that use multiple/shared tables) ─
  if (!(await tableExists('fdw_source_table'))) {
    await exec(`
        CREATE TABLE "fdw_source_table" (
          "id"              SERIAL PRIMARY KEY,
          "source_db_name"  VARCHAR(255) NOT NULL,
          "table_name"      VARCHAR(255) NOT NULL,
          "schema_name"     VARCHAR(255) DEFAULT 'public',
          "created_at"      TIMESTAMP DEFAULT NOW() NOT NULL,
          UNIQUE("source_db_name", "table_name")
        )
      `)
    console.log('  ✅ fdw_source_table created')
  } else {
    console.log('  ⏭  fdw_source_table exists')
  }

  // ── app_success_rate ──────────────────────────────────────────────────────
  if (!(await tableExists('app_success_rate'))) {
    await exec(`
        CREATE TABLE "app_success_rate" (
          "id"                  SERIAL PRIMARY KEY,
          "id_app_identifier"   INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
          "tanggal_transaksi"   DATE NOT NULL,
          "bulan"               VARCHAR(20) NOT NULL,
          "tahun"               INTEGER NOT NULL,
          "jenis_transaksi"     VARCHAR(255) NOT NULL,
          "rc"                  VARCHAR(50),
          "rc_description"      VARCHAR(500),
          "total_transaksi"     INTEGER,
          "total_nominal"       DECIMAL(20,2),
          "total_biaya_admin"   DECIMAL(20,2),
          "status_transaksi"    VARCHAR(255),
          "error_type"          "error_type_enum",
          "created_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at"          TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
    await exec(`
      CREATE TRIGGER "upd_app_success_rate_updated_at"
        BEFORE UPDATE ON "app_success_rate"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `)
    console.log('  ✅ app_success_rate created')
  } else {
    console.log('  ⏭  app_success_rate exists')
  }
  await createIndexSafely('idx_tanggal_transaksi', 'app_success_rate', ['tanggal_transaksi'])
  await createIndexSafely('idx_id_app_identifier', 'app_success_rate', ['id_app_identifier'])

  // ── response_code_dictionary ──────────────────────────────────────────────
  if (!(await tableExists('response_code_dictionary'))) {
    await exec(`
        CREATE TABLE "response_code_dictionary" (
          "id"                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          "id_app_identifier" INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
          "jenis_transaksi"   VARCHAR(255),
          "rc"                VARCHAR(50),
          "rc_description"    VARCHAR(500),
          "error_type"        "error_type_enum" NOT NULL,
          CONSTRAINT "unique_dictionary_entry" UNIQUE ("id_app_identifier","jenis_transaksi","rc")
        )
      `)
    await createIndexSafely('unique_dictionary_entry', 'response_code_dictionary', ['id_app_identifier', 'jenis_transaksi', 'rc'], true)
    console.log('  ✅ response_code_dictionary created')
  } else {
    console.log('  ⏭  response_code_dictionary exists')
  }

  // ── unmapped_rc ───────────────────────────────────────────────────────────
  if (!(await tableExists('unmapped_rc'))) {
    await exec(`
        CREATE TABLE "unmapped_rc" (
          "id"                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          "id_app_identifier" INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
          "jenis_transaksi"   VARCHAR(255),
          "rc"                VARCHAR(50),
          "rc_description"    VARCHAR(500),
          "status_transaksi"  VARCHAR(255),
          "error_type"        "error_type_enum",
          "created_at"        TIMESTAMP DEFAULT NOW() NOT NULL,
          CONSTRAINT "unique_unmapped_rc_entry" UNIQUE ("id_app_identifier","jenis_transaksi","rc")
        )
      `)
    console.log('  ✅ unmapped_rc created')
  } else {
    console.log('  ⏭  unmapped_rc exists')
  }

  // ── users ─────────────────────────────────────────────────────────────────
  if (!(await tableExists('users'))) {
    await exec(`
        CREATE TABLE "users" (
          "id"            SERIAL PRIMARY KEY,
          "username"      VARCHAR(255) NOT NULL UNIQUE,
          "email"         VARCHAR(255) NOT NULL UNIQUE,
          "password_hash" VARCHAR(255) NOT NULL,
          "role"          "user_role" NOT NULL DEFAULT 'user',
          "created_at"    TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at"    TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
    await exec(`
      CREATE TRIGGER "upd_users_updated_at"
        BEFORE UPDATE ON "users"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `)
    await createIndexSafely('idx_username', 'users', ['username'])
    await createIndexSafely('idx_email', 'users', ['email'])
    console.log('  ✅ users created')
  } else {
    console.log('  ⏭  users exists')
  }

  // ── audit_logs ────────────────────────────────────────────────────────────
  if (!(await tableExists('audit_logs'))) {
    await exec(`
        CREATE TABLE "audit_logs" (
          "id"            SERIAL PRIMARY KEY,
          "user_id"       INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
          "username"      VARCHAR(255),
          "action"        VARCHAR(255) NOT NULL,
          "resource_type" VARCHAR(255) NOT NULL,
          "resource_id"   VARCHAR(255),
          "details"       TEXT,
          "ip_address"    VARCHAR(45),
          "user_agent"    TEXT,
          "created_at"    TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
    await createIndexSafely('idx_audit_user_id', 'audit_logs', ['user_id'])
    await createIndexSafely('idx_audit_action', 'audit_logs', ['action'])
    await createIndexSafely('idx_audit_resource_type', 'audit_logs', ['resource_type'])
    await createIndexSafely('idx_audit_created_at', 'audit_logs', ['created_at'])
    console.log('  ✅ audit_logs created')
  } else {
    console.log('  ⏭  audit_logs exists')
  }

  // ── rate_limit_logs ───────────────────────────────────────────────────────
  if (!(await tableExists('rate_limit_logs'))) {
    await exec(`
        CREATE TABLE "rate_limit_logs" (
          "id"          SERIAL PRIMARY KEY,
          "ip_address"  VARCHAR(45) NOT NULL,
          "endpoint"    VARCHAR(255) NOT NULL,
          "blocked_at"  TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
    await createIndexSafely('idx_ip_endpoint', 'rate_limit_logs', ['ip_address', 'endpoint'])
    await createIndexSafely('idx_blocked_at', 'rate_limit_logs', ['blocked_at'])
    console.log('  ✅ rate_limit_logs created')
  } else {
    console.log('  ⏭  rate_limit_logs exists')
  }

  // ── pending_user_requests ─────────────────────────────────────────────────
  if (!(await tableExists('pending_user_requests'))) {
    await exec(`
        CREATE TABLE "pending_user_requests" (
          "id"               SERIAL PRIMARY KEY,
          "username"         VARCHAR(255) NOT NULL UNIQUE,
          "email"            VARCHAR(255) NOT NULL UNIQUE,
          "password_hash"    VARCHAR(255) NOT NULL,
          "requested_role"   "requested_role" NOT NULL,
          "requested_by"     INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
          "status"           "request_status" NOT NULL DEFAULT 'pending',
          "approved_role"    "user_role",
          "approved_by"      INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
          "rejected_by"      INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
          "rejection_reason" TEXT,
          "created_at"       TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at"       TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
    await exec(`
      CREATE TRIGGER "upd_pur_updated_at"
        BEFORE UPDATE ON "pending_user_requests"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `)
    await createIndexSafely('idx_pur_status', 'pending_user_requests', ['status'])
    await createIndexSafely('idx_pur_requested_by', 'pending_user_requests', ['requested_by'])
    console.log('  ✅ pending_user_requests created')
  } else {
    console.log('  ⏭  pending_user_requests exists')
  }

  console.log('  ✅ Phase 1 done')
}

// ─── Phase 2: BetterAuth tables ──────────────────────────────────────────────

async function runBetterAuthSchema() {
  console.log('\n🔐 Phase 2: BetterAuth tables')

  // ALTER users – add BetterAuth columns if missing
  for (const [col, def] of [
    ['name',           'VARCHAR(255)'],
    ['email_verified', 'INTEGER DEFAULT 0'],
    ['image',          'VARCHAR(500)'],
  ] as [string, string][]) {
    if (!(await columnExists('users', col))) {
      await exec(`ALTER TABLE "users" ADD COLUMN "${col}" ${def}`)
      console.log(`  ✅ users.${col} added`)
    }
  }

  // session table (BetterAuth)
  if (!(await tableExists('session'))) {
    await exec(`
        CREATE TABLE "session" (
          "id"         VARCHAR(255) PRIMARY KEY,
          "expires_at" TIMESTAMP NOT NULL,
          "token"      VARCHAR(255) NOT NULL UNIQUE,
          "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "ip_address" VARCHAR(255),
          "user_agent" TEXT,
          "user_id"    INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
        )
      `)
    console.log('  ✅ session created')
  } else {
    console.log('  ⏭  session exists')
  }

  // account table (BetterAuth)
  if (!(await tableExists('account'))) {
    await exec(`
        CREATE TABLE "account" (
          "id"                       VARCHAR(255) PRIMARY KEY,
          "account_id"               VARCHAR(255) NOT NULL,
          "provider_id"              VARCHAR(255) NOT NULL,
          "user_id"                  INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "access_token"             TEXT,
          "refresh_token"            TEXT,
          "id_token"                 TEXT,
          "access_token_expires_at"  TIMESTAMP,
          "refresh_token_expires_at" TIMESTAMP,
          "scope"                    TEXT,
          "password"                 TEXT,
          "created_at"               TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at"               TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
    console.log('  ✅ account created')
  } else {
    console.log('  ⏭  account exists')
  }

  // verification table (BetterAuth)
  if (!(await tableExists('verification'))) {
    await exec(`
        CREATE TABLE "verification" (
          "id"         VARCHAR(255) PRIMARY KEY,
          "identifier" VARCHAR(255) NOT NULL,
          "value"      VARCHAR(255) NOT NULL,
          "expires_at" TIMESTAMP NOT NULL,
          "created_at" TIMESTAMP DEFAULT NOW(),
          "updated_at" TIMESTAMP DEFAULT NOW()
        )
      `)
    console.log('  ✅ verification created')
  } else {
    console.log('  ⏭  verification exists')
  }

  console.log('  ✅ Phase 2 done')
}

// ─── Phase 3: app_processing_log ─────────────────────────────────────────────

async function runProcessingLogSchema() {
  console.log('\n📋 Phase 3: app_processing_log')

  if (!(await tableExists('app_processing_log'))) {
    await exec(`
        CREATE TABLE "app_processing_log" (
          "id"                SERIAL PRIMARY KEY,
          "app_name"          VARCHAR(255) NOT NULL,
          "id_app_identifier" INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
          "processing_date"   DATE NOT NULL,
          "start_time"        TIMESTAMP NOT NULL,
          "end_time"          TIMESTAMP,
          "status"            "proc_status_enum" NOT NULL,
          "records_processed" INTEGER DEFAULT 0,
          "records_inserted"  INTEGER DEFAULT 0,
          "records_skipped"   INTEGER DEFAULT 0,
          "error_message"     TEXT,
          "created_at"        TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
    await createIndexSafely('idx_app_processing_date', 'app_processing_log', ['app_name', 'processing_date'])
    await createIndexSafely('idx_apl_status', 'app_processing_log', ['status', 'created_at'])
    await createIndexSafely('idx_app_processing_log_processing_date', 'app_processing_log', ['processing_date'])
    console.log('  ✅ app_processing_log created')
  } else {
    console.log('  ⏭  app_processing_log exists')
  }
  console.log('  ✅ Phase 3 done')
}

// ─── Phase 4: Performance indexes ────────────────────────────────────────────

async function runPerformanceIndexes() {
  console.log('\n🔍 Phase 4: Performance indexes')

  const idxDefs: [string, string, string[]][] = [
    ['idx_app_success_rate_id_app_jenis_transaksi', 'app_success_rate', ['id_app_identifier', 'jenis_transaksi']],
    ['idx_app_success_rate_id_app_rc',              'app_success_rate', ['id_app_identifier', 'rc']],
    ['idx_app_success_rate_id_app_error_type',      'app_success_rate', ['id_app_identifier', 'error_type']],
    ['idx_app_success_rate_id_app_bulan_tahun',     'app_success_rate', ['id_app_identifier', 'bulan', 'tahun']],
    ['idx_app_success_rate_rc',                     'app_success_rate', ['rc']],
    ['idx_rcd_id_app_error_type',                   'response_code_dictionary', ['id_app_identifier', 'error_type']],
    ['idx_rcd_jenis_transaksi',                     'response_code_dictionary', ['jenis_transaksi']],
    ['idx_unmapped_rc_id_app_identifier',           'unmapped_rc', ['id_app_identifier']],
  ]

  for (const [name, table, cols] of idxDefs) {
    await createIndexSafely(name, table, cols)
  }
  console.log('  ✅ Phase 4 done')
}

// ─── Phase 4b: PostgreSQL FDW (postgres_fdw) ──────────────────────────────────

async function runFdwSetup() {
  console.log('\n🔗 Phase 4b: postgres_fdw setup')

  try {
    await exec('CREATE EXTENSION IF NOT EXISTS postgres_fdw')
    console.log('  ✅ postgres_fdw extension ready')
  } catch (e: unknown) {
    console.warn('  ⚠️  Could not create postgres_fdw extension:', (e as Error).message)
    console.warn('     Ensure superuser or CREATE privilege. FDW setup skipped.')
    return
  }

  // Collect (db, table) pairs from app_identifier (single-table apps) and fdw_source_table (shared tables)
  const pairs = new Map<string, Set<string>>()

  const appRows = await exec(
    `SELECT db_name, raw_table_name FROM "app_identifier" WHERE "db_name" IS NOT NULL AND "raw_table_name" IS NOT NULL`,
  ) as { db_name: string; raw_table_name: string }[]
  for (const r of appRows) {
    if (!pairs.has(r.db_name)) pairs.set(r.db_name, new Set())
    pairs.get(r.db_name)!.add(r.raw_table_name)
  }

  let fdwRows: { source_db_name: string; table_name: string }[] = []
  if (await tableExists('fdw_source_table')) {
    fdwRows = await exec(
      `SELECT source_db_name, table_name FROM "fdw_source_table"`,
    ) as { source_db_name: string; table_name: string }[]
  }
  for (const r of fdwRows) {
    if (!pairs.has(r.source_db_name)) pairs.set(r.source_db_name, new Set())
    pairs.get(r.source_db_name)!.add(r.table_name)
  }

  const esc = (s: string) => s.replace(/'/g, "''")
  for (const [dbName, tables] of pairs) {
    const serverName = `${dbName}_server`
    try {
      await exec(`DROP SERVER IF EXISTS "${serverName}" CASCADE`)
      await exec(`
        CREATE SERVER "${serverName}"
        FOREIGN DATA WRAPPER postgres_fdw
        OPTIONS (host '${esc(DB_HOST)}', dbname '${esc(dbName)}', port '${DB_PORT}')
      `)
      await exec(`
        CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER
        SERVER "${serverName}"
        OPTIONS (user '${esc(DB_USER)}', password '${esc(DB_PASSWORD)}')
      `)
      if (DB_USER_TARGET) {
        const targetEsc = DB_USER_TARGET.replace(/"/g, '""')
        try {
          await exec(`
            CREATE USER MAPPING IF NOT EXISTS FOR "${targetEsc}"
            SERVER "${serverName}"
            OPTIONS (user '${esc(DB_USER)}', password '${esc(DB_PASSWORD)}')
          `)
          await exec(`
            ALTER USER MAPPING FOR "${targetEsc}" SERVER "${serverName}"
            OPTIONS (SET user '${esc(DB_USER)}', SET password '${esc(DB_PASSWORD)}')
          `)
          console.log(`  ✅ FDW user mapping: ${serverName} -> ${DB_USER_TARGET}`)
        } catch (e: unknown) {
          console.warn(`  ⚠️  User mapping for ${DB_USER_TARGET} on ${serverName} failed:`, (e as Error).message)
        }
        try {
          await exec(`GRANT USAGE ON FOREIGN SERVER "${serverName}" TO "${targetEsc}"`)
          console.log(`  ✅ FDW grant: ${serverName} -> ${DB_USER_TARGET}`)
        } catch (e: unknown) {
          console.warn(`  ⚠️  GRANT USAGE on ${serverName} to ${DB_USER_TARGET} failed:`, (e as Error).message)
        }
      }
      for (const tableName of tables) {
        try {
          await exec(`DROP FOREIGN TABLE IF EXISTS "${tableName}"`)
          await exec(`
            IMPORT FOREIGN SCHEMA public
            LIMIT TO ("${tableName}")
            FROM SERVER "${serverName}"
            INTO public
          `)
          console.log(`  ✅ FDW: ${tableName} <- ${dbName}.${tableName}`)
          if (DB_USER_TARGET) {
            try {
              await exec(`GRANT SELECT ON "${tableName}" TO "${DB_USER_TARGET.replace(/"/g, '""')}"`)
              console.log(`  ✅ FDW grant SELECT: ${tableName} -> ${DB_USER_TARGET}`)
            } catch (e: unknown) {
              console.warn(`  ⚠️  GRANT SELECT on ${tableName} to ${DB_USER_TARGET} failed:`, (e as Error).message)
            }
          }
        } catch (e: unknown) {
          console.warn(`  ⚠️  FDW for ${dbName}.${tableName} failed:`, (e as Error).message)
        }
      }
    } catch (e: unknown) {
      console.warn(`  ⚠️  FDW server ${serverName} failed:`, (e as Error).message)
    }
  }
  console.log('  ✅ Phase 4b done')
}

// ─── Phase 5: Stored procedures ──────────────────────────────────────────────

async function runStoredProcedures() {
  console.log('\n⚙️  Phase 5: Stored procedures')
  await runProcedures(exec, true)
  console.log('  ✅ Phase 5 done')
}

// ─── Phase 6: Cron setup ─────────────────────────────────────────────────────

async function runCronSetup(isDefaultCronDatabase: boolean) {
  console.log('\n⏰ Phase 6: Cron setup')

  // Only run cron setup in the default/cron database
  if (!isDefaultCronDatabase) {
    console.log('  ℹ️  Not the cron database – cron jobs belong in the default database where pg_cron is installed')
    return
  }

  if (USE_APP_SCHEDULER) {
    console.log('  ℹ️  USE_APP_LEVEL_SCHEDULER=true – using node-cron; skipping database cron setup')
    return
  }

  const targetDbs = getTargetDatabases()

  // Try pg_cron first
  const hasPgCron = await (async () => {
    try {
      const r = await exec(`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') AS exists`)
      const row = r[0] as Record<string, unknown>
      return row?.exists === true || row?.exists === 't'
    } catch { return false }
  })()

  if (hasPgCron) {
    console.log('  pg_cron detected – creating jobs…')
    const esc = (s: string) => s.replace(/'/g, "''")
    const { PROCEDURE_APPS } = await import('../../scripts/success_rate/registry')
    const getSchedule = (appKey: string) =>
      process.env[`${appKey.toUpperCase()}_PROCESSING_SCHEDULE`] ?? '1 0 * * *'
    const cronJobs: { jobName: string; schedule: string; sql: string }[] = PROCEDURE_APPS.map(
      ({ appKey, procedureName }) => ({
        jobName: `process-${appKey.replace(/_/g, '-')}-daily`,
        schedule: getSchedule(appKey),
        sql: `SELECT public.${procedureName}(NULL)`,
      })
    )
    for (const dbName of targetDbs) {
      for (const { jobName: base, schedule, sql } of cronJobs) {
        const jobName = `${base}-${dbName}`
        try {
          try { await exec(`SELECT cron.unschedule('${esc(jobName)}')`) } catch { /* ok */ }
          await exec(`
            SELECT cron.schedule_in_database(
              '${esc(jobName)}',
              '${esc(schedule)}',
              $$${sql}$$,
              '${esc(dbName)}',
              NULL,
              true
            )
          `)
          await exec(`
            UPDATE cron.job
            SET nodename = '${esc(DB_HOST)}', nodeport = ${DB_PORT}
            WHERE jobname = '${esc(jobName)}'
          `)
          console.log(`  ✅ pg_cron job '${jobName}' → database '${dbName}' @ ${DB_HOST}:${DB_PORT} (${schedule})`)
        } catch (e: unknown) {
          console.warn(`  ⚠️  pg_cron job '${jobName}' for '${dbName}' failed:`, (e as Error).message)
        }
      }
    }
    return
  }

  console.warn('  ⚠️  pg_cron not found.')
  console.warn(`     To run manually: SELECT public.sp_process_bale_daily(NULL); SELECT public.sp_process_bale_bisnis_daily(NULL); SELECT public.sp_process_olob_daily(NULL); in each target DB`)
  console.warn('     Or set USE_APP_LEVEL_SCHEDULER=true to use node-cron instead.')
  console.log('  ✅ Phase 6 done (no scheduler configured)')
}

// ─── Phase 7: Seeds ──────────────────────────────────────────────────────────

async function runSeeds() {
  console.log('\n🌱 Phase 7: Seeds')

  // Migrate EDC Agent -> EDC Agen (align with procedure name)
  await exec(`UPDATE "app_identifier" SET "app_name"='EDC Agen', "db_name"='itm_db', "raw_table_name"=NULL WHERE "app_name"='EDC Agent'`)

  // Default app identifiers (with db_name, raw_table_name for cross-db)
  const defaultApps = ['Bale', 'Bale Bisnis', 'CMS', 'SMS Notif', 'QRIS', 'EDC Merchant', 'EDC Merchant Ancol', 'EDC Agen', 'Bale Korpora', 'OLOB']
  for (const appName of defaultApps) {
    let dbName: string
    let rawTableName: string | null
    if (appName === 'EDC Agen' || appName === 'EDC Merchant' || appName === 'EDC Merchant Ancol') {
      dbName = 'itm_db'
      rawTableName = null
    } else if (appName === 'OLOB') {
      dbName = deriveDbName(appName)
      rawTableName = 'openaccount_syslog'
    } else {
      dbName = deriveDbName(appName)
      rawTableName = deriveRawTableName(appName)
    }
    await exec(
      `INSERT INTO "app_identifier" ("app_name","db_name","raw_table_name") VALUES ($1,$2,$3)
       ON CONFLICT ("app_name") DO UPDATE SET "db_name"=COALESCE("app_identifier"."db_name",EXCLUDED."db_name"), "raw_table_name"=COALESCE("app_identifier"."raw_table_name",EXCLUDED."raw_table_name")`,
      [appName, dbName, rawTableName],
    )
  }
  // Backfill db_name/raw_table_name for any existing rows where NULL (exclude EDC apps using fdw_source_table)
  const rows = await exec(
    `SELECT id, app_name FROM "app_identifier" WHERE ("db_name" IS NULL OR "raw_table_name" IS NULL) AND "app_name" NOT IN ('EDC Agen', 'EDC Merchant', 'EDC Merchant Ancol')`,
  )
  for (const row of rows as { id: number; app_name: string }[]) {
    const dbName = deriveDbName(row.app_name)
    const rawTableName = row.app_name === 'OLOB' ? 'openaccount_syslog' : deriveRawTableName(row.app_name)
    await exec('UPDATE "app_identifier" SET "db_name"=$1, "raw_table_name"=$2 WHERE "id"=$3', [dbName, rawTableName, row.id])
  }
  if (rows.length > 0) console.log(`  ✅ Backfilled db_name/raw_table_name for ${rows.length} app(s)`)
  console.log(`  ✅ ${defaultApps.length} default app identifiers seeded`)

  // Seed fdw_source_table for EDC (shared tables from itm_db)
  if (await tableExists('fdw_source_table')) {
    const fdwEntries = [
      ['itm_db', 'ASID160448_ZTRANS0P'],
      ['itm_db', 'ASID160448_ZRSPCD0P'],
    ] as [string, string][]
    for (const [sourceDb, tableName] of fdwEntries) {
      await exec(
        `INSERT INTO "fdw_source_table" ("source_db_name","table_name") VALUES ($1,$2)
         ON CONFLICT ("source_db_name","table_name") DO NOTHING`,
        [sourceDb, tableName],
      )
    }
    console.log('  ✅ fdw_source_table seeded (itm_db)')
  }

  // Superadmin users
  const usernames = (process.env.DEFAULT_SU_USERNAME ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const passwords = (process.env.DEFAULT_SU_PASSWORD ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const emails    = (process.env.DEFAULT_SU_EMAIL    ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  if (usernames.length === 0 || passwords.length === 0) {
    console.log('  ⏭  No DEFAULT_SU_USERNAME/PASSWORD set – skipping superadmin seed')
    return
  }
  if (usernames.length !== passwords.length) {
    throw new Error('DEFAULT_SU_USERNAME and DEFAULT_SU_PASSWORD must have the same number of comma-separated values')
  }

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i]
    const password = passwords[i]
    // BetterAuth normalises emails to lowercase before querying – always store lowercase
    const email    = (emails[i] ?? `${username}@superadmin.local`).toLowerCase()

    if (password.length < 8) {
      console.warn(`  ⚠️  Password for ${username} is too short – skipping`)
      continue
    }

    // bcrypt hash for `users.password_hash` (legacy app column)
    const bcryptHash = await bcrypt.hash(password, 12)
    // BetterAuth scrypt format (salt:hexkey) for `account.password`
    const baHash = await hashForBetterAuth(password)
    try {
      // ── Insert / upsert into `users` (application table) ──────────────────
      let userId: number | null = null
      const hasBetterAuthCols = await columnExists('users', 'email_verified')
      let rows: unknown[]
      if (hasBetterAuthCols) {
        rows = await exec(
          `INSERT INTO "users" ("username","email","password_hash","role","name","email_verified")
           VALUES ($1,$2,$3,'superadmin',$4,1)
           ON CONFLICT ("username") DO UPDATE SET
             "email"="excluded"."email",
             "password_hash"="excluded"."password_hash",
             "name"="excluded"."name",
             "email_verified"=1
           RETURNING "id"`,
          [username, email, bcryptHash, username],
        )
      } else {
        rows = await exec(
          `INSERT INTO "users" ("username","email","password_hash","role")
           VALUES ($1,$2,$3,'superadmin')
           ON CONFLICT ("username") DO UPDATE SET
             "email"="excluded"."email",
             "password_hash"="excluded"."password_hash"
           RETURNING "id"`,
          [username, email, bcryptHash],
        )
      }
      userId = rows[0] ? (rows[0] as Record<string, unknown>).id as number : null

      console.log(`  ✅ Superadmin seeded: ${username} (id=${userId})`)

      // ── Insert / upsert into BetterAuth `account` (credential store) ──────
      // BetterAuth verifies passwords from `account.password`, not `users.password_hash`
      if (userId !== null) {
        const userIdStr = String(userId)
        const acct = await exec(
          `SELECT "id" FROM "account" WHERE "provider_id"='credential' AND "user_id"=$1 LIMIT 1`,
          [userId],
        )
        const existingAccountId = acct[0] ? (acct[0] as Record<string, unknown>).id as string : null

        if (existingAccountId) {
          await exec(
            `UPDATE "account" SET "password"=$1,"updated_at"=NOW() WHERE "id"=$2`,
            [baHash, existingAccountId],
          )
          console.log(`  ✅ BetterAuth credential updated for: ${username}`)
        } else {
          const accountId = randomUUID()
          await exec(
            `INSERT INTO "account" ("id","account_id","provider_id","user_id","password","created_at","updated_at")
             VALUES ($1,$2,'credential',$3,$4,NOW(),NOW())`,
            [accountId, userIdStr, userId, baHash],
          )
          console.log(`  ✅ BetterAuth credential account linked for: ${username}`)
        }
      } else {
        console.warn(`  ⚠️  Could not determine userId for ${username} – skipping account link`)
      }
    } catch (e: unknown) {
      console.warn(`  ⚠️  Failed to seed superadmin ${username}:`, (e as Error).message)
    }
  }

  console.log('  ✅ Phase 7 done')
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Drizzle Migration Runner`)
  console.log(`   DB_TYPE : PostgreSQL`)
  console.log(`   Host    : ${DB_HOST}:${DB_PORT}`)
  console.log(`   Database: ${DB_NAME}`)
  console.log(`   Schedule: ${CRON_SCHEDULE}`)

  await initConnection()

  const isCronDb = await isDefaultCronDb()
  if (isCronDb) {
    console.log('\n📡 Detected: PostgreSQL default/cron database (pg_cron present)')
    console.log('   Schema & procedure phases will be SKIPPED for this database.')
    console.log('   Only cron job registration will run.\n')
  }

  try {
    if (!isCronDb) {
      if (RUN_ALL || ONLY_SCHEMA) {
        await runCoreSchema()
        await runBetterAuthSchema()
        await runProcessingLogSchema()
        await runPerformanceIndexes()
      }
      if (RUN_ALL || ONLY_SCHEMA || ONLY_FDW) {
        await runFdwSetup()
      }
      if (RUN_ALL || ONLY_PROCEDURES) {
        await runStoredProcedures()
      }
    }

    if (RUN_ALL || ONLY_CRON) {
      await runCronSetup(isCronDb)
    }

    if (!isCronDb && (RUN_ALL || ONLY_SEED)) {
      await runSeeds()
    }

    console.log('\n✅ All migrations completed successfully!\n')
  } finally {
    await closeDb()
  }
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err)
  process.exit(1)
})
