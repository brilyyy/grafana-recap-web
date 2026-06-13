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
 *   6. Seeds              – superadmin user(s) only (app/FDW/housekeeping data is not seeded here)
 *
 * Usage:
 *   npx tsx src/db/migrate.ts [--schema-only] [--procedures-only] [--seed-only]
 *
 * Environment:
 *   Reads from .env – see src/env.ts for required variables.
 */

import * as dotenv from 'dotenv'

dotenv.config()

import { randomUUID } from 'node:crypto'
import argon2 from '@node-rs/argon2'
import { runRecapModelStoredProcedures } from '@scripts/recap_models/runProcedures'
import { type SQL, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { runStoredProcedures as runProcedures } from '../../scripts/success_rate/runProcedures'
import { applyFdwConfig } from '../lib/fdw-setup'

// ─── Argument parsing ───────────────────────────────────────────────────────

const args = process.argv.slice(2)
const ONLY_SCHEMA = args.includes('--schema-only')
const ONLY_PROCEDURES = args.includes('--procedures-only')
const ONLY_SEED = args.includes('--seed-only')
const ONLY_FDW = args.includes('--fdw-only')
const ONLY_CRON = args.includes('--cron-only')
const RUN_ALL = !ONLY_SCHEMA && !ONLY_PROCEDURES && !ONLY_SEED && !ONLY_FDW && !ONLY_CRON

// ─── Database connection helpers ────────────────────────────────────────────

const DB_TYPE = (process.env.DB_TYPE ?? 'postgresql').toLowerCase()

const DB_HOST = process.env.DB_HOST ?? 'localhost'
const DB_PORT = parseInt(process.env.DB_PORT ?? '5432', 10)
const DB_USER = process.env.DB_USER ?? 'root'
const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
const DB_NAME = process.env.DB_NAME ?? 'platform_db'

// ─── Low-level query executor (drizzle) ──────────────────────────────────────

let migrationDb!: NodePgDatabase
let migrationPool!: import('pg').Pool
let closeDb!: () => Promise<void>

async function initConnection() {
  const { Pool } = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  })
  migrationPool = pool
  migrationDb = drizzle(pool)
  closeDb = () => pool.end()
}

/** Run a raw (param-less) DDL/SQL string through drizzle. */
async function exec(text: string): Promise<unknown[]> {
  const result = await migrationDb.execute(sql.raw(text))
  return result.rows
}

/** Run a parameterized drizzle `sql` template. */
async function execSql(query: SQL): Promise<unknown[]> {
  const result = await migrationDb.execute(query)
  return result.rows
}

// ─── Safety helpers ──────────────────────────────────────────────────────────

async function tableExists(table: string): Promise<boolean> {
  try {
    const rows = await execSql(
      sql`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=${table} LIMIT 1`,
    )
    return rows.length > 0
  } catch {
    return false
  }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const rows = await execSql(
      sql`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} AND column_name=${column} LIMIT 1`,
    )
    return rows.length > 0
  } catch {
    return false
  }
}

async function indexExists(table: string, idx: string): Promise<boolean> {
  try {
    const rows = await execSql(
      sql`SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename=${table} AND indexname=${idx} LIMIT 1`,
    )
    return rows.length > 0
  } catch {
    return false
  }
}

async function createIndexSafely(idxName: string, table: string, columns: string[], unique = false): Promise<void> {
  if (await indexExists(table, idxName)) return
  const u = unique ? 'UNIQUE' : ''
  await exec(`CREATE ${u} INDEX IF NOT EXISTS "${idxName}" ON "${table}" (${columns.map((c) => `"${c}"`).join(', ')})`)
}

async function pgEnumExists(name: string): Promise<boolean> {
  try {
    const rows = await execSql(sql`SELECT 1 FROM pg_type WHERE typname=${name} AND typtype='e' LIMIT 1`)
    return rows.length > 0
  } catch {
    return false
  }
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
    ['user_role', "'superadmin','admin','user'"],
    ['requested_role', "'admin','user'"],
    ['request_status', "'pending','approved','rejected'"],
    ['error_type_enum', "'S','N','Sukses'"],
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
          "retention_days"  INTEGER,
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
    if (!(await columnExists('app_identifier', 'retention_days'))) {
      await exec(`ALTER TABLE "app_identifier" ADD COLUMN "retention_days" INTEGER`)
      console.log('  ✅ app_identifier.retention_days added')
    }
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

  // ── raw_table_housekeeping ────────────────────────────────────────────────
  if (!(await tableExists('raw_table_housekeeping'))) {
    await exec(`
        CREATE TABLE "raw_table_housekeeping" (
          "id"               SERIAL PRIMARY KEY,
          "db_name"          VARCHAR(255) NOT NULL,
          "table_name"       VARCHAR(255) NOT NULL,
          "date_column"      VARCHAR(255),
          "date_column_type" VARCHAR(50) DEFAULT 'timestamp',
          "retention_days"   INTEGER,
          "notes"            VARCHAR(500),
          "created_at"       TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at"       TIMESTAMP DEFAULT NOW() NOT NULL,
          UNIQUE("db_name", "table_name")
        )
      `)
    await exec(`
      CREATE TRIGGER "upd_raw_table_housekeeping_updated_at"
        BEFORE UPDATE ON "raw_table_housekeeping"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `)
    console.log('  ✅ raw_table_housekeeping created')
  } else {
    console.log('  ⏭  raw_table_housekeeping exists')
    if (!(await columnExists('raw_table_housekeeping', 'date_column_type'))) {
      await exec(`ALTER TABLE "raw_table_housekeeping" ADD COLUMN "date_column_type" VARCHAR(50) DEFAULT 'timestamp'`)
      console.log('  ✅ raw_table_housekeeping.date_column_type added')
    }
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
          "rc"                  VARCHAR(255),
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
          "rc"                VARCHAR(255),
          "rc_description"    VARCHAR(500),
          "error_type"        "error_type_enum" NOT NULL,
          CONSTRAINT "unique_dictionary_entry" UNIQUE ("id_app_identifier","jenis_transaksi","rc")
        )
      `)
    await createIndexSafely(
      'unique_dictionary_entry',
      'response_code_dictionary',
      ['id_app_identifier', 'jenis_transaksi', 'rc'],
      true,
    )
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
          "rc"                VARCHAR(255),
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

  // Long RC codes (e.g. GCM ERR_MAP_CD / exception paths) exceed legacy VARCHAR(50)
  for (const tbl of ['app_success_rate', 'response_code_dictionary', 'unmapped_rc'] as const) {
    if (await tableExists(tbl)) {
      try {
        await exec(`ALTER TABLE "${tbl}" ALTER COLUMN "rc" TYPE VARCHAR(255)`)
        console.log(`  ✅ ${tbl}.rc → VARCHAR(255)`)
      } catch (e: unknown) {
        console.log(`  ⏭  ${tbl}.rc alter skipped: ${(e as Error).message}`)
      }
    }
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
    ['name', 'VARCHAR(255)'],
    ['email_verified', 'INTEGER DEFAULT 0'],
    ['image', 'VARCHAR(500)'],
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
          "recap_kind"        VARCHAR(64) NOT NULL DEFAULT 'success_rate_daily',
          "catalog_entry_id"  VARCHAR(128),
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

  if (!(await columnExists('app_processing_log', 'recap_kind'))) {
    await exec(`
      ALTER TABLE "app_processing_log"
      ADD COLUMN "recap_kind" VARCHAR(64) NOT NULL DEFAULT 'success_rate_daily'
    `)
    console.log('  ✅ app_processing_log.recap_kind added')
  }
  if (!(await columnExists('app_processing_log', 'catalog_entry_id'))) {
    await exec(`
      ALTER TABLE "app_processing_log"
      ADD COLUMN "catalog_entry_id" VARCHAR(128)
    `)
    console.log('  ✅ app_processing_log.catalog_entry_id added')
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
  await createIndexSafely('idx_apl_recap_kind_date', 'app_processing_log', ['recap_kind', 'processing_date'])
  await createIndexSafely('idx_apl_catalog_entry_date', 'app_processing_log', ['catalog_entry_id', 'processing_date'])

  console.log('  ✅ Phase 3 done')
}

// ─── Phase 3b: Custom recap output tables ─────────────────────────────────────

async function runRecapModelTables() {
  console.log('\n📊 Phase 3b: recap model tables')

  if (!(await tableExists('recap_cms_corp_daily'))) {
    await exec(`
      CREATE TABLE "recap_cms_corp_daily" (
        "id"                  SERIAL PRIMARY KEY,
        "id_app_identifier"   INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
        "tanggal_transaksi"   DATE NOT NULL,
        "corp_id"             VARCHAR(255) NOT NULL,
        "jenis_transaksi"     VARCHAR(1024) NOT NULL,
        "rc"                  VARCHAR(255) NOT NULL,
        "rc_description"      TEXT NOT NULL,
        "status_transaksi"    VARCHAR(64) NOT NULL,
        "error_type"          "error_type_enum",
        "total_transaksi"     INTEGER DEFAULT 0,
        "total_nominal"       DECIMAL(20, 2) DEFAULT 0,
        "created_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT "recap_cms_corp_daily_grain_key" UNIQUE (
          "id_app_identifier",
          "tanggal_transaksi",
          "corp_id",
          "jenis_transaksi",
          "rc",
          "rc_description",
          "status_transaksi"
        )
      )
    `)
    await exec(`
      CREATE TRIGGER "upd_recap_cms_corp_daily_updated_at"
        BEFORE UPDATE ON "recap_cms_corp_daily"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `)
    console.log('  ✅ recap_cms_corp_daily created')
  } else {
    console.log('  ⏭  recap_cms_corp_daily exists')
    if (!(await columnExists('recap_cms_corp_daily', 'jenis_transaksi'))) {
      await exec(`
        ALTER TABLE "recap_cms_corp_daily"
        ADD COLUMN "jenis_transaksi" VARCHAR(1024) NOT NULL DEFAULT '(legacy aggregate)'
      `)
      await exec(`ALTER TABLE "recap_cms_corp_daily" ADD COLUMN "rc" VARCHAR(255) NOT NULL DEFAULT ''`)
      await exec(`ALTER TABLE "recap_cms_corp_daily" ADD COLUMN "rc_description" TEXT NOT NULL DEFAULT ''`)
      await exec(`
        ALTER TABLE "recap_cms_corp_daily"
        ADD COLUMN "status_transaksi" VARCHAR(64) NOT NULL DEFAULT 'legacy'
      `)
      await exec(`ALTER TABLE "recap_cms_corp_daily" ALTER COLUMN "jenis_transaksi" DROP DEFAULT`)
      await exec(`ALTER TABLE "recap_cms_corp_daily" ALTER COLUMN "rc" DROP DEFAULT`)
      await exec(`ALTER TABLE "recap_cms_corp_daily" ALTER COLUMN "rc_description" DROP DEFAULT`)
      await exec(`ALTER TABLE "recap_cms_corp_daily" ALTER COLUMN "status_transaksi" DROP DEFAULT`)
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
      console.log('  ✅ recap_cms_corp_daily upgraded to CORP × jenis × RC × status grain')
    }
  }
  if ((await tableExists('recap_cms_corp_daily')) && !(await columnExists('recap_cms_corp_daily', 'error_type'))) {
    await exec(`
      ALTER TABLE "recap_cms_corp_daily"
      ADD COLUMN "error_type" "error_type_enum"
    `)
    console.log('  ✅ recap_cms_corp_daily error_type column added')
  }
  await createIndexSafely('idx_recap_cms_corp_daily_app_date', 'recap_cms_corp_daily', [
    'id_app_identifier',
    'tanggal_transaksi',
  ])
  await createIndexSafely('idx_recap_cms_corp_daily_app_date_corp', 'recap_cms_corp_daily', [
    'id_app_identifier',
    'tanggal_transaksi',
    'corp_id',
  ])

  if (!(await tableExists('recap_bale_korpora_corp_daily'))) {
    await exec(`
      CREATE TABLE "recap_bale_korpora_corp_daily" (
        "id"                  SERIAL PRIMARY KEY,
        "id_app_identifier"   INTEGER NOT NULL REFERENCES "app_identifier"("id") ON DELETE CASCADE,
        "tanggal_transaksi"   DATE NOT NULL,
        "corp_id"             VARCHAR(255) NOT NULL,
        "jenis_transaksi"     VARCHAR(1024) NOT NULL,
        "rc"                  VARCHAR(255) NOT NULL,
        "rc_description"      TEXT NOT NULL,
        "status_transaksi"    VARCHAR(64) NOT NULL,
        "error_type"          "error_type_enum",
        "total_transaksi"     INTEGER DEFAULT 0,
        "total_nominal"       DECIMAL(20, 2) DEFAULT 0,
        "created_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_at"          TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT "recap_bale_korpora_corp_daily_grain_key" UNIQUE (
          "id_app_identifier",
          "tanggal_transaksi",
          "corp_id",
          "jenis_transaksi",
          "rc",
          "rc_description",
          "status_transaksi"
        )
      )
    `)
    await exec(`
      CREATE TRIGGER "upd_recap_bale_korpora_corp_daily_updated_at"
        BEFORE UPDATE ON "recap_bale_korpora_corp_daily"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `)
    console.log('  ✅ recap_bale_korpora_corp_daily created')
  } else {
    console.log('  ⏭  recap_bale_korpora_corp_daily exists')
  }
  await createIndexSafely('idx_recap_bk_corp_daily_app_date', 'recap_bale_korpora_corp_daily', [
    'id_app_identifier',
    'tanggal_transaksi',
  ])
  await createIndexSafely('idx_recap_bk_corp_daily_app_date_corp', 'recap_bale_korpora_corp_daily', [
    'id_app_identifier',
    'tanggal_transaksi',
    'corp_id',
  ])

  console.log('  ✅ Phase 3b done')
}

async function runRecapModelProcedures() {
  console.log('\n⚙️  Phase 5b: Custom recap stored procedures (PostgreSQL)')
  await runRecapModelStoredProcedures(migrationDb)
  console.log('  ✅ Phase 5b done')
}

// ─── Phase 4: Performance indexes ────────────────────────────────────────────

async function runPerformanceIndexes() {
  console.log('\n🔍 Phase 4: Performance indexes')

  const idxDefs: [string, string, string[]][] = [
    ['idx_app_success_rate_id_app_jenis_transaksi', 'app_success_rate', ['id_app_identifier', 'jenis_transaksi']],
    ['idx_app_success_rate_id_app_rc', 'app_success_rate', ['id_app_identifier', 'rc']],
    ['idx_app_success_rate_id_app_error_type', 'app_success_rate', ['id_app_identifier', 'error_type']],
    ['idx_app_success_rate_id_app_bulan_tahun', 'app_success_rate', ['id_app_identifier', 'bulan', 'tahun']],
    ['idx_app_success_rate_rc', 'app_success_rate', ['rc']],
    ['idx_rcd_id_app_error_type', 'response_code_dictionary', ['id_app_identifier', 'error_type']],
    ['idx_rcd_jenis_transaksi', 'response_code_dictionary', ['jenis_transaksi']],
    ['idx_unmapped_rc_id_app_identifier', 'unmapped_rc', ['id_app_identifier']],
  ]

  for (const [name, table, cols] of idxDefs) {
    await createIndexSafely(name, table, cols)
  }
  console.log('  ✅ Phase 4 done')
}

// ─── Phase 4b: PostgreSQL FDW (postgres_fdw) ──────────────────────────────────

async function runFdwSetup() {
  console.log('\n🔗 Phase 4b: postgres_fdw setup')
  const result = await applyFdwConfig(migrationPool)
  for (const err of result.errors) {
    console.warn(`  ⚠️  ${err}`)
  }
  console.log(`  ✅ FDW: ${result.serversProcessed} servers, ${result.tablesProcessed} tables processed`)
  console.log('  ✅ Phase 4b done')
}

// ─── Phase 5: Stored procedures ──────────────────────────────────────────────

async function runStoredProcedures() {
  console.log('\n⚙️  Phase 5: Stored procedures')
  await runProcedures(migrationDb)

  // PostgreSQL-only: housekeeping utility function
  // Reads retention_days at runtime so UI changes take effect without re-running migration
  if (DB_TYPE === 'postgresql' || DB_TYPE === 'postgres') {
    try {
      // Helper: mirrors fdwLocalRelationName() TS logic so the stored function always
      // targets the prefixed FDW foreign table even if table_name in the DB still holds
      // the old short (logical) name from a pre-fix installation.
      await exec(`
        CREATE OR REPLACE FUNCTION public.housekeeping_platform_relation(p_db_name TEXT, p_table_name TEXT)
        RETURNS TEXT AS $$
        DECLARE
          v_raw    TEXT;
          v_suffix TEXT;
        BEGIN
          -- If already prefixed with db_name_, use as-is.
          IF p_table_name LIKE p_db_name || '_%' THEN
            RETURN p_table_name;
          END IF;
          v_raw := p_db_name || '_' || p_table_name;
          IF char_length(v_raw) <= 63 THEN
            RETURN v_raw;
          END IF;
          -- Replicate JS: first 55 chars + '_' + first 7 hex chars of MD5(db:table)
          v_suffix := substring(md5(p_db_name || ':' || p_table_name) FROM 1 FOR 7);
          RETURN substring(v_raw FROM 1 FOR 55) || '_' || v_suffix;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
      `)
      await exec(`
        CREATE OR REPLACE FUNCTION public.sp_run_raw_housekeeping(p_id INTEGER)
        RETURNS INTEGER AS $$
        DECLARE
          v_db_name        TEXT;
          v_table_name     TEXT;
          v_rel_name       TEXT;
          v_date_column    TEXT;
          v_date_col_type  TEXT;
          v_retention_days INTEGER;
          v_sql            TEXT;
          v_deleted        INTEGER;
        BEGIN
          SELECT db_name, table_name, date_column, date_column_type, retention_days
            INTO v_db_name, v_table_name, v_date_column, v_date_col_type, v_retention_days
            FROM raw_table_housekeeping
           WHERE id = p_id;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'Housekeeping config id=% not found', p_id;
          END IF;

          IF v_retention_days IS NULL THEN
            RAISE EXCEPTION 'retention_days not set for table %', v_table_name;
          END IF;

          IF v_date_column IS NULL THEN
            RAISE EXCEPTION 'date_column not set for table % (reference table – housekeeping not applicable)', v_table_name;
          END IF;

          -- Resolve the actual FDW foreign-table name (prefixed) so DELETE bypasses any view.
          v_rel_name := public.housekeeping_platform_relation(v_db_name, v_table_name);

          IF v_date_col_type = 'int_1yymmdd' THEN
            -- TRXMDT integer format: 1YYMMDD (e.g. 1250311 = 2025-03-11)
            v_sql := format(
              'DELETE FROM %I WHERE %I < (1000000'
              ' + (EXTRACT(YEAR  FROM (CURRENT_DATE - (''%s days'')::INTERVAL))::int %% 100) * 10000'
              ' + (EXTRACT(MONTH FROM (CURRENT_DATE - (''%s days'')::INTERVAL))::int) * 100'
              ' + (EXTRACT(DAY   FROM (CURRENT_DATE - (''%s days'')::INTERVAL))::int))',
              v_rel_name, v_date_column,
              v_retention_days, v_retention_days, v_retention_days
            );
          ELSE
            -- Standard timestamp / date column
            v_sql := format(
              'DELETE FROM %I WHERE %I < (CURRENT_DATE - (''%s days'')::INTERVAL)',
              v_rel_name, v_date_column, v_retention_days
            );
          END IF;

          EXECUTE v_sql;
          GET DIAGNOSTICS v_deleted = ROW_COUNT;
          RETURN v_deleted;
        END;
        $$ LANGUAGE plpgsql;
      `)
      await exec(`
        CREATE OR REPLACE FUNCTION public.sp_run_all_raw_housekeeping()
        RETURNS INTEGER AS $$
        DECLARE
          r         RECORD;
          v_n       INTEGER;
          v_total   INTEGER := 0;
        BEGIN
          FOR r IN
            SELECT id FROM raw_table_housekeeping
            WHERE date_column IS NOT NULL AND retention_days IS NOT NULL
            ORDER BY id
          LOOP
            BEGIN
              v_n := public.sp_run_raw_housekeeping(r.id);
              v_total := v_total + COALESCE(v_n, 0);
            EXCEPTION WHEN OTHERS THEN
              RAISE WARNING 'sp_run_all_raw_housekeeping: id=% failed: %', r.id, SQLERRM;
            END;
          END LOOP;
          RETURN v_total;
        END;
        $$ LANGUAGE plpgsql;
      `)
      console.log('  ✅ sp_run_raw_housekeeping + sp_run_all_raw_housekeeping created/updated')
    } catch (e: unknown) {
      console.warn('  ⚠️  sp_run_raw_housekeeping failed:', (e as Error).message)
    }
  }

  console.log('  ✅ Phase 5 done')
}

// ─── Phase 6: Seeds ──────────────────────────────────────────────────────────

async function runSeeds() {
  console.log('\n🌱 Phase 7: Seeds')
  console.log(
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
    const email = (emails[i] ?? `${username}@superadmin.local`).toLowerCase()

    if (password.length < 8) {
      console.warn(`  ⚠️  Password for ${username} is too short – skipping`)
      continue
    }

    // argon2 hash used for both users.password_hash and account.password
    const argon2Hash = await argon2.hash(password)
    try {
      // ── Insert / upsert into `users` (application table) ──────────────────
      let userId: number | null = null
      const hasBetterAuthCols = await columnExists('users', 'email_verified')
      let rows: unknown[]
      if (hasBetterAuthCols) {
        rows = await execSql(sql`
          INSERT INTO "users" ("username","email","password_hash","role","name","email_verified")
          VALUES (${username},${email},${argon2Hash},'superadmin',${username},1)
          ON CONFLICT ("username") DO UPDATE SET
            "email"="excluded"."email",
            "password_hash"="excluded"."password_hash",
            "name"="excluded"."name",
            "email_verified"=1
          RETURNING "id"`)
      } else {
        rows = await execSql(sql`
          INSERT INTO "users" ("username","email","password_hash","role")
          VALUES (${username},${email},${argon2Hash},'superadmin')
          ON CONFLICT ("username") DO UPDATE SET
            "email"="excluded"."email",
            "password_hash"="excluded"."password_hash"
          RETURNING "id"`)
      }
      userId = rows[0] ? ((rows[0] as Record<string, unknown>).id as number) : null

      console.log(`  ✅ Superadmin seeded: ${username} (id=${userId})`)

      // ── Insert / upsert into BetterAuth `account` (credential store) ──────
      // BetterAuth verifies passwords from `account.password`, not `users.password_hash`
      if (userId !== null) {
        const acct = await execSql(
          sql`SELECT "id" FROM "account" WHERE "provider_id"='credential' AND "user_id"=${userId} LIMIT 1`,
        )
        const existingAccountId = acct[0] ? ((acct[0] as Record<string, unknown>).id as string) : null

        if (existingAccountId) {
          await execSql(
            sql`UPDATE "account" SET "password"=${argon2Hash},"updated_at"=NOW() WHERE "id"=${existingAccountId}`,
          )
          console.log(`  ✅ BetterAuth credential updated for: ${username}`)
        } else {
          const accountId = randomUUID()
          await execSql(sql`
            INSERT INTO "account" ("id","account_id","provider_id","user_id","password","created_at","updated_at")
            VALUES (${accountId},${String(userId)},'credential',${userId},${argon2Hash},NOW(),NOW())`)
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

// ─── Phase 8: Scheduler jobs table + seed ────────────────────────────────────

const SEED_JOBS: { name: string; procedure: string; envVar: string; defaultSchedule: string }[] = [
  {
    name: 'BALE processing',
    procedure: 'sp_process_bale_daily',
    envVar: 'BALE_PROCESSING_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'Bale Bisnis processing',
    procedure: 'sp_process_bale_bisnis_daily',
    envVar: 'BALE_BISNIS_PROCESSING_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'OLOB processing',
    procedure: 'sp_process_olob_daily',
    envVar: 'OLOB_PROCESSING_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'CMS processing',
    procedure: 'sp_process_cms_daily',
    envVar: 'CMS_PROCESSING_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'CMS CORP recap',
    procedure: 'sp_recap_cms_corp_daily',
    envVar: 'CMS_CORP_RECAP_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'Bale Korpora CORP recap',
    procedure: 'sp_recap_bale_korpora_corp_daily',
    envVar: 'BALE_KORPORA_CORP_RECAP_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'Bale Korpora processing',
    procedure: 'sp_process_bale_korpora_daily',
    envVar: 'BALE_KORPORA_PROCESSING_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'EDC Agen processing',
    procedure: 'sp_process_edc_agen_daily',
    envVar: 'EDC_AGEN_PROCESSING_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'EDC Merchant processing',
    procedure: 'sp_process_edc_merchant_daily',
    envVar: 'EDC_MERCHANT_PROCESSING_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'EDC Merchant Ancol processing',
    procedure: 'sp_process_edc_merchant_ancol_daily',
    envVar: 'EDC_MERCHANT_ANCOL_PROCESSING_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'Debit Online processing',
    procedure: 'sp_process_debit_online_daily',
    envVar: 'DEBIT_ONLINE_PROCESSING_SCHEDULE',
    defaultSchedule: '1 0 * * *',
  },
  {
    name: 'Housekeeping',
    procedure: 'sp_run_raw_housekeeping',
    envVar: 'HOUSEKEEPING_SCHEDULE',
    defaultSchedule: '0 2 * * *',
  },
]

async function runCronSetup() {
  console.log('\n⏰ Phase 8: Scheduler jobs table')

  if (!(await tableExists('scheduler_jobs'))) {
    await exec(`
      CREATE TABLE "scheduler_jobs" (
        "id"            SERIAL PRIMARY KEY,
        "name"          VARCHAR(255) NOT NULL,
        "procedure"     VARCHAR(255) NOT NULL UNIQUE,
        "schedule"      VARCHAR(100) NOT NULL DEFAULT '1 0 * * *',
        "timezone"      VARCHAR(100) DEFAULT 'Asia/Jakarta',
        "enabled"       BOOLEAN DEFAULT true NOT NULL,
        "last_run_at"   TIMESTAMP,
        "last_status"   VARCHAR(50),
        "last_error"    TEXT,
        "created_at"    TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_at"    TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `)
    console.log('  ✅ scheduler_jobs created')
  } else {
    console.log('  ⏭  scheduler_jobs exists')
  }

  for (const job of SEED_JOBS) {
    const schedule = (process.env[job.envVar] ?? job.defaultSchedule).trim()
    await exec(`
      INSERT INTO "scheduler_jobs" ("name", "procedure", "schedule")
      VALUES ('${job.name.replace(/'/g, "''")}', '${job.procedure}', '${schedule.replace(/'/g, "''")}')
      ON CONFLICT ("procedure") DO NOTHING
    `)
  }
  console.log(`  ✅ ${SEED_JOBS.length} scheduler jobs seeded (ON CONFLICT DO NOTHING)`)

  console.log('  ✅ Phase 8 done')
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Drizzle Migration Runner`)
  console.log(`   DB_TYPE : PostgreSQL`)
  console.log(`   Host    : ${DB_HOST}:${DB_PORT}`)
  console.log(`   Database: ${DB_NAME}`)

  await initConnection()

  try {
    if (RUN_ALL || ONLY_SCHEMA) {
      await runCoreSchema()
      await runBetterAuthSchema()
      await runProcessingLogSchema()
      await runRecapModelTables()
      await runPerformanceIndexes()
    }
    if (RUN_ALL || ONLY_SCHEMA || ONLY_FDW) {
      await runFdwSetup()
    }
    if (RUN_ALL || ONLY_PROCEDURES) {
      await runStoredProcedures()
      await runRecapModelProcedures()
    }
    if (RUN_ALL || ONLY_SEED) {
      await runSeeds()
    }
    if (RUN_ALL || ONLY_CRON) {
      await runCronSetup()
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
