#!/usr/bin/env node
/**
 * Comprehensive Drizzle Migration Runner
 *
 * Phases:
 *   1. Core schema        – all application tables + basic indexes + FKs
 *   2. BetterAuth tables  – ALTER users, session, account, verification
 *   3. Processing log     – app_processing_log + indexes
 *   4. Performance idx    – additional composite indexes
 *   5. Stored procedures  – sp_process_bale_daily (MySQL) / pg function
 *   6. Cron setup         – MySQL EVENT scheduler  OR  pg_cron / pgAgent
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

const DB_TYPE = (process.env.DB_TYPE ?? 'mysql').toLowerCase()
const IS_PG = DB_TYPE === 'postgresql' || DB_TYPE === 'postgres'

const DB_HOST = process.env.DB_HOST ?? 'localhost'
const DB_PORT = parseInt(process.env.DB_PORT ?? (IS_PG ? '5432' : '3306'), 10)
const DB_USER = process.env.DB_USER ?? 'root'
const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
const DB_NAME = process.env.DB_NAME ?? 'platform_db'

// ─── Cron / scheduling ──────────────────────────────────────────────────────

const CRON_SCHEDULE = process.env.BALE_PROCESSING_SCHEDULE ?? '1 0 * * *'
const USE_APP_SCHEDULER = process.env.USE_APP_LEVEL_SCHEDULER === 'true'

function getTargetDatabases(): string[] {
  const raw = process.env.TARGET_DATABASES?.trim()
  if (!raw) return ['platform_db', 'platform_db_dev']
  return raw.split(',').map((d) => d.trim()).filter(Boolean)
}

function parseCronForMySQL(schedule: string): string {
  const parts = schedule.trim().split(/\s+/)
  if (parts.length !== 5) {
    return `EVERY 1 DAY STARTS DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d 00:01:00')`
  }
  const minute = parts[0] === '*' ? '0' : parts[0]
  const hour   = parts[1] === '*' ? '0' : parts[1]
  const hh = hour.padStart(2, '0')
  const mm = minute.padStart(2, '0')
  return `EVERY 1 DAY STARTS DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d ${hh}:${mm}:00')`
}

/** Derive db_name from app_name: db_ + lowercase, spaces/special -> underscore */
function deriveDbName(appName: string): string {
  const base = appName.toLowerCase().trim().replace(/[\s\-\.]+/g, '_').replace(/[^a-z0-9_]/g, '')
  return `db_${base || 'unknown'}`
}

/** Derive raw_table_name from app_name: raw_ + same as db_name base */
function deriveRawTableName(appName: string): string {
  const base = appName.toLowerCase().trim().replace(/[\s\-\.]+/g, '_').replace(/[^a-z0-9_]/g, '')
  return `raw_${base || 'unknown'}`
}

function parseCronForPgAgent(schedule: string): {
  minutes: number[]; hours: number[]; weekdays: number[]; monthdays: number[]; months: number[]
} {
  const parts = schedule.trim().split(/\s+/)
  if (parts.length !== 5) {
    return { minutes: [1], hours: [0], weekdays: [0,1,2,3,4,5,6], monthdays: [], months: [] }
  }
  const parse = (field: string, min: number, max: number): number[] => {
    if (field === '*') return []
    if (field.includes(',')) return field.split(',').map(Number).filter((v) => v >= min && v <= max)
    if (field.includes('-')) {
      const [s, e] = field.split('-').map(Number)
      return Array.from({ length: e - s + 1 }, (_, i) => s + i).filter((v) => v >= min && v <= max)
    }
    if (field.includes('/')) {
      const [, step] = field.split('/')
      const r: number[] = []
      for (let i = min; i <= max; i += Number(step)) r.push(i)
      return r
    }
    const v = Number(field)
    return v >= min && v <= max ? [v] : []
  }
  return {
    minutes:   parse(parts[0], 0, 59),
    hours:     parse(parts[1], 0, 23),
    monthdays: parse(parts[2], 1, 31),
    months:    parse(parts[3], 1, 12),
    weekdays:  parse(parts[4], 0, 6),
  }
}

// ─── Low-level query executor ────────────────────────────────────────────────

type ExecFn = (sql: string, params?: unknown[]) => Promise<unknown[]>
let exec!: ExecFn
let closeDb!: () => Promise<void>

async function initConnection() {
  if (IS_PG) {
    const { Pool } = await import('pg')
    const pool = new Pool({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME })
    exec = async (sql, params) => {
      const result = await pool.query(sql, params as unknown[])
      return result.rows
    }
    closeDb = () => pool.end()
  } else {
    const mysql = await import('mysql2/promise')
    const pool = mysql.createPool({
      host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
      multipleStatements: false,
      charset: 'utf8mb4',
    })
    exec = async (sql, params) => {
      const [rows] = await pool.execute(sql, params as unknown[])
      return Array.isArray(rows) ? rows : [rows]
    }
    closeDb = () => pool.end()
  }
}

// ─── Safety helpers ──────────────────────────────────────────────────────────

async function isDefaultCronDb(): Promise<boolean> {
  if (!IS_PG) return false
  try {
    const rows = await exec(`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS exists`)
    const row = rows[0] as Record<string, unknown>
    return row?.exists === true || row?.exists === 't' || row?.exists === 1
  } catch { return false }
}

async function tableExists(table: string): Promise<boolean> {
  try {
    if (IS_PG) {
      const rows = await exec(
        `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1`,
        [table],
      )
      return rows.length > 0
    } else {
      const rows = await exec(
        `SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1`,
        [table],
      )
      return rows.length > 0
    }
  } catch { return false }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    if (IS_PG) {
      const rows = await exec(
        `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
        [table, column],
      )
      return rows.length > 0
    } else {
      const rows = await exec(
        `SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1`,
        [table, column],
      )
      return rows.length > 0
    }
  } catch { return false }
}

async function indexExists(table: string, idx: string): Promise<boolean> {
  try {
    if (IS_PG) {
      const rows = await exec(
        `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename=$1 AND indexname=$2 LIMIT 1`,
        [table, idx],
      )
      return rows.length > 0
    } else {
      const rows = await exec(
        `SELECT COUNT(*) AS cnt FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=?`,
        [table, idx],
      )
      const row = rows[0] as Record<string, unknown>
      return Number(row?.cnt ?? row?.CNT ?? 0) > 0
    }
  } catch { return false }
}

async function createIndexSafely(
  idxName: string, table: string, columns: string[], unique = false,
): Promise<void> {
  if (await indexExists(table, idxName)) return
  const u = unique ? 'UNIQUE' : ''
  if (IS_PG) {
    await exec(`CREATE ${u} INDEX IF NOT EXISTS "${idxName}" ON "${table}" (${columns.map((c) => `"${c}"`).join(', ')})`)
  } else {
    await exec(`CREATE ${u} INDEX \`${idxName}\` ON \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')})`)
  }
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
  const ENG = IS_PG ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'

  // PostgreSQL: shared trigger function + enums
  if (IS_PG) {
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
  }

  // ── app_identifier ────────────────────────────────────────────────────────
  if (!(await tableExists('app_identifier'))) {
    if (IS_PG) {
      await exec(`
        CREATE TABLE "app_identifier" (
          "id"              SERIAL PRIMARY KEY,
          "app_name"        VARCHAR(255) NOT NULL UNIQUE,
          "db_name"         VARCHAR(255),
          "raw_table_name"  VARCHAR(255),
          "created_at"      TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at"      TIMESTAMP DEFAULT NOW() NOT NULL
        )${ENG}
      `)
      await exec(`
        CREATE TRIGGER "upd_app_identifier_updated_at"
          BEFORE UPDATE ON "app_identifier"
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `)
    } else {
      await exec(`
        CREATE TABLE \`app_identifier\` (
          \`id\`              INT AUTO_INCREMENT PRIMARY KEY,
          \`app_name\`        VARCHAR(255) NOT NULL UNIQUE,
          \`db_name\`        VARCHAR(255) NULL,
          \`raw_table_name\`  VARCHAR(255) NULL,
          \`created_at\`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          \`updated_at\`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
        )${ENG}
      `)
    }
    console.log('  ✅ app_identifier created')
  } else {
    console.log('  ⏭  app_identifier exists')
    // Add db_name and raw_table_name if missing (cross-db migration)
    if (!(await columnExists('app_identifier', 'db_name'))) {
      if (IS_PG) {
        await exec(`ALTER TABLE "app_identifier" ADD COLUMN "db_name" VARCHAR(255)`)
      } else {
        await exec('ALTER TABLE `app_identifier` ADD COLUMN `db_name` VARCHAR(255) NULL')
      }
      console.log('  ✅ app_identifier.db_name added')
    }
    if (!(await columnExists('app_identifier', 'raw_table_name'))) {
      if (IS_PG) {
        await exec(`ALTER TABLE "app_identifier" ADD COLUMN "raw_table_name" VARCHAR(255)`)
      } else {
        await exec('ALTER TABLE `app_identifier` ADD COLUMN `raw_table_name` VARCHAR(255) NULL')
      }
      console.log('  ✅ app_identifier.raw_table_name added')
    }
    // Backfill db_name/raw_table_name for existing rows (so FDW/procedures have config)
    if (IS_PG) {
      const rows = await exec('SELECT id, app_name FROM "app_identifier" WHERE "db_name" IS NULL OR "raw_table_name" IS NULL')
      for (const row of rows as { id: number; app_name: string }[]) {
        const dbName = deriveDbName(row.app_name)
        const rawTableName = deriveRawTableName(row.app_name)
        await exec('UPDATE "app_identifier" SET "db_name"=$1, "raw_table_name"=$2 WHERE "id"=$3', [dbName, rawTableName, row.id])
      }
      if (rows.length > 0) console.log(`  ✅ Backfilled db_name/raw_table_name for ${rows.length} app(s)`)
    } else {
      const rows = await exec('SELECT id, app_name FROM `app_identifier` WHERE `db_name` IS NULL OR `raw_table_name` IS NULL')
      for (const row of rows as { id: number; app_name: string }[]) {
        const dbName = deriveDbName(row.app_name)
        const rawTableName = deriveRawTableName(row.app_name)
        await exec('UPDATE `app_identifier` SET `db_name`=?, `raw_table_name`=? WHERE `id`=?', [dbName, rawTableName, row.id])
      }
      if (rows.length > 0) console.log(`  ✅ Backfilled db_name/raw_table_name for ${rows.length} app(s)`)
    }
  }
  await createIndexSafely('idx_app_name', 'app_identifier', ['app_name'])

  // ── app_success_rate ──────────────────────────────────────────────────────
  if (!(await tableExists('app_success_rate'))) {
    if (IS_PG) {
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
    } else {
      await exec(`
        CREATE TABLE \`app_success_rate\` (
          \`id\`                INT AUTO_INCREMENT PRIMARY KEY,
          \`id_app_identifier\` INT NOT NULL,
          \`tanggal_transaksi\` DATE NOT NULL,
          \`bulan\`             VARCHAR(20) NOT NULL,
          \`tahun\`             INT NOT NULL,
          \`jenis_transaksi\`   VARCHAR(255) NOT NULL,
          \`rc\`                VARCHAR(50) NULL,
          \`rc_description\`    VARCHAR(500) NULL,
          \`total_transaksi\`   INT NULL,
          \`total_nominal\`     DECIMAL(20,2) NULL,
          \`total_biaya_admin\` DECIMAL(20,2) NULL,
          \`status_transaksi\`  VARCHAR(255) NULL,
          \`error_type\`        ENUM('S','N','Sukses') NULL,
          \`created_at\`        TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          \`updated_at\`        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT \`fk_asr_app_id\` FOREIGN KEY (\`id_app_identifier\`) REFERENCES \`app_identifier\`(\`id\`) ON DELETE CASCADE
        )${ENG}
      `)
    }
    console.log('  ✅ app_success_rate created')
  } else {
    console.log('  ⏭  app_success_rate exists')
  }
  await createIndexSafely('idx_tanggal_transaksi', 'app_success_rate', ['tanggal_transaksi'])
  await createIndexSafely('idx_id_app_identifier', 'app_success_rate', ['id_app_identifier'])

  // ── response_code_dictionary ──────────────────────────────────────────────
  if (!(await tableExists('response_code_dictionary'))) {
    if (IS_PG) {
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
    } else {
      await exec(`
        CREATE TABLE \`response_code_dictionary\` (
          \`id\`                INT AUTO_INCREMENT PRIMARY KEY,
          \`id_app_identifier\` INT NOT NULL,
          \`jenis_transaksi\`   VARCHAR(255) NULL,
          \`rc\`                VARCHAR(50) NULL,
          \`rc_description\`    VARCHAR(500) NULL,
          \`error_type\`        ENUM('S','N','Sukses') NOT NULL,
          CONSTRAINT \`fk_rcd_app_id\` FOREIGN KEY (\`id_app_identifier\`) REFERENCES \`app_identifier\`(\`id\`) ON DELETE CASCADE
        )${ENG}
      `)
    }
    await createIndexSafely('unique_dictionary_entry', 'response_code_dictionary', ['id_app_identifier', 'jenis_transaksi', 'rc'], true)
    console.log('  ✅ response_code_dictionary created')
  } else {
    console.log('  ⏭  response_code_dictionary exists')
  }

  // ── unmapped_rc ───────────────────────────────────────────────────────────
  if (!(await tableExists('unmapped_rc'))) {
    if (IS_PG) {
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
    } else {
      await exec(`
        CREATE TABLE \`unmapped_rc\` (
          \`id\`                INT AUTO_INCREMENT PRIMARY KEY,
          \`id_app_identifier\` INT NOT NULL,
          \`jenis_transaksi\`   VARCHAR(255) NULL,
          \`rc\`                VARCHAR(50) NULL,
          \`rc_description\`    VARCHAR(500) NULL,
          \`status_transaksi\`  VARCHAR(255) NULL,
          \`error_type\`        ENUM('S','N','Sukses') NULL,
          \`created_at\`        TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT \`fk_urc_app_id\` FOREIGN KEY (\`id_app_identifier\`) REFERENCES \`app_identifier\`(\`id\`) ON DELETE CASCADE
        )${ENG}
      `)
      await createIndexSafely('unique_unmapped_rc_entry', 'unmapped_rc', ['id_app_identifier', 'jenis_transaksi', 'rc'], true)
    }
    console.log('  ✅ unmapped_rc created')
  } else {
    console.log('  ⏭  unmapped_rc exists')
  }

  // ── users ─────────────────────────────────────────────────────────────────
  if (!(await tableExists('users'))) {
    if (IS_PG) {
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
    } else {
      await exec(`
        CREATE TABLE \`users\` (
          \`id\`            INT AUTO_INCREMENT PRIMARY KEY,
          \`username\`      VARCHAR(255) NOT NULL UNIQUE,
          \`email\`         VARCHAR(255) NOT NULL UNIQUE,
          \`password_hash\` VARCHAR(255) NOT NULL,
          \`role\`          ENUM('superadmin','admin','user') NOT NULL DEFAULT 'user',
          \`created_at\`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          \`updated_at\`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
        )${ENG}
      `)
    }
    await createIndexSafely('idx_username', 'users', ['username'])
    await createIndexSafely('idx_email', 'users', ['email'])
    console.log('  ✅ users created')
  } else {
    console.log('  ⏭  users exists')
  }

  // ── audit_logs ────────────────────────────────────────────────────────────
  if (!(await tableExists('audit_logs'))) {
    if (IS_PG) {
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
    } else {
      await exec(`
        CREATE TABLE \`audit_logs\` (
          \`id\`            INT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\`       INT NULL,
          \`username\`      VARCHAR(255) NULL,
          \`action\`        VARCHAR(255) NOT NULL,
          \`resource_type\` VARCHAR(255) NOT NULL,
          \`resource_id\`   VARCHAR(255) NULL,
          \`details\`       TEXT NULL,
          \`ip_address\`    VARCHAR(45) NULL,
          \`user_agent\`    TEXT NULL,
          \`created_at\`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT \`fk_al_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
        )${ENG}
      `)
    }
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
    if (IS_PG) {
      await exec(`
        CREATE TABLE "rate_limit_logs" (
          "id"          SERIAL PRIMARY KEY,
          "ip_address"  VARCHAR(45) NOT NULL,
          "endpoint"    VARCHAR(255) NOT NULL,
          "blocked_at"  TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
    } else {
      await exec(`
        CREATE TABLE \`rate_limit_logs\` (
          \`id\`          INT AUTO_INCREMENT PRIMARY KEY,
          \`ip_address\`  VARCHAR(45) NOT NULL,
          \`endpoint\`    VARCHAR(255) NOT NULL,
          \`blocked_at\`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )${ENG}
      `)
    }
    await createIndexSafely('idx_ip_endpoint', 'rate_limit_logs', ['ip_address', 'endpoint'])
    await createIndexSafely('idx_blocked_at', 'rate_limit_logs', ['blocked_at'])
    console.log('  ✅ rate_limit_logs created')
  } else {
    console.log('  ⏭  rate_limit_logs exists')
  }

  // ── pending_user_requests ─────────────────────────────────────────────────
  if (!(await tableExists('pending_user_requests'))) {
    if (IS_PG) {
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
    } else {
      await exec(`
        CREATE TABLE \`pending_user_requests\` (
          \`id\`               INT AUTO_INCREMENT PRIMARY KEY,
          \`username\`         VARCHAR(255) NOT NULL UNIQUE,
          \`email\`            VARCHAR(255) NOT NULL UNIQUE,
          \`password_hash\`    VARCHAR(255) NOT NULL,
          \`requested_role\`   ENUM('admin','user') NOT NULL,
          \`requested_by\`     INT NULL,
          \`status\`           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
          \`approved_role\`    ENUM('superadmin','admin','user') NULL,
          \`approved_by\`      INT NULL,
          \`rejected_by\`      INT NULL,
          \`rejection_reason\` TEXT NULL,
          \`created_at\`       TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          \`updated_at\`       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT \`fk_pur_req_by\` FOREIGN KEY (\`requested_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL,
          CONSTRAINT \`fk_pur_app_by\` FOREIGN KEY (\`approved_by\`)  REFERENCES \`users\`(\`id\`) ON DELETE SET NULL,
          CONSTRAINT \`fk_pur_rej_by\` FOREIGN KEY (\`rejected_by\`)  REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
        )${ENG}
      `)
    }
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
  const ENG = IS_PG ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'

  // ALTER users – add BetterAuth columns if missing
  for (const [col, def] of [
    ['name',           IS_PG ? 'VARCHAR(255)' : 'VARCHAR(255) NULL'],
    ['email_verified', IS_PG ? 'INTEGER DEFAULT 0' : 'INT DEFAULT 0'],
    ['image',          IS_PG ? 'VARCHAR(500)' : 'VARCHAR(500) NULL'],
  ] as [string, string][]) {
    if (!(await columnExists('users', col))) {
      if (IS_PG) {
        await exec(`ALTER TABLE "users" ADD COLUMN "${col}" ${def}`)
      } else {
        await exec(`ALTER TABLE \`users\` ADD COLUMN \`${col}\` ${def}`)
      }
      console.log(`  ✅ users.${col} added`)
    }
  }

  // session table (BetterAuth)
  if (!(await tableExists('session'))) {
    if (IS_PG) {
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
    } else {
      await exec(`
        CREATE TABLE \`session\` (
          \`id\`         VARCHAR(255) PRIMARY KEY,
          \`expires_at\` TIMESTAMP NOT NULL,
          \`token\`      VARCHAR(255) NOT NULL UNIQUE,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
          \`ip_address\` VARCHAR(255) NULL,
          \`user_agent\` TEXT NULL,
          \`user_id\`    INT NOT NULL,
          CONSTRAINT \`fk_session_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        )${ENG}
      `)
    }
    console.log('  ✅ session created')
  } else {
    console.log('  ⏭  session exists')
  }

  // account table (BetterAuth)
  if (!(await tableExists('account'))) {
    if (IS_PG) {
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
    } else {
      await exec(`
        CREATE TABLE \`account\` (
          \`id\`                       VARCHAR(255) PRIMARY KEY,
          \`account_id\`               VARCHAR(255) NOT NULL,
          \`provider_id\`              VARCHAR(255) NOT NULL,
          \`user_id\`                  INT NOT NULL,
          \`access_token\`             TEXT NULL,
          \`refresh_token\`            TEXT NULL,
          \`id_token\`                 TEXT NULL,
          \`access_token_expires_at\`  TIMESTAMP NULL,
          \`refresh_token_expires_at\` TIMESTAMP NULL,
          \`scope\`                    TEXT NULL,
          \`password\`                 TEXT NULL,
          \`created_at\`               TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          \`updated_at\`               TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT \`fk_account_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        )${ENG}
      `)
    }
    console.log('  ✅ account created')
  } else {
    console.log('  ⏭  account exists')
  }

  // verification table (BetterAuth)
  if (!(await tableExists('verification'))) {
    if (IS_PG) {
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
    } else {
      await exec(`
        CREATE TABLE \`verification\` (
          \`id\`         VARCHAR(255) PRIMARY KEY,
          \`identifier\` VARCHAR(255) NOT NULL,
          \`value\`      VARCHAR(255) NOT NULL,
          \`expires_at\` TIMESTAMP NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )${ENG}
      `)
    }
    console.log('  ✅ verification created')
  } else {
    console.log('  ⏭  verification exists')
  }

  console.log('  ✅ Phase 2 done')
}

// ─── Phase 3: app_processing_log ─────────────────────────────────────────────

async function runProcessingLogSchema() {
  console.log('\n📋 Phase 3: app_processing_log')
  const ENG = IS_PG ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'

  if (!(await tableExists('app_processing_log'))) {
    if (IS_PG) {
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
    } else {
      await exec(`
        CREATE TABLE \`app_processing_log\` (
          \`id\`                INT AUTO_INCREMENT PRIMARY KEY,
          \`app_name\`          VARCHAR(255) NOT NULL,
          \`id_app_identifier\` INT NOT NULL,
          \`processing_date\`   DATE NOT NULL,
          \`start_time\`        TIMESTAMP NOT NULL,
          \`end_time\`          TIMESTAMP NULL,
          \`status\`            ENUM('running','success','failed') NOT NULL,
          \`records_processed\` INT DEFAULT 0,
          \`records_inserted\`  INT DEFAULT 0,
          \`records_skipped\`   INT DEFAULT 0,
          \`error_message\`     TEXT NULL,
          \`created_at\`        TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT \`fk_apl_app_id\` FOREIGN KEY (\`id_app_identifier\`) REFERENCES \`app_identifier\`(\`id\`) ON DELETE CASCADE
        )${ENG}
      `)
    }
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
  if (!IS_PG) return
  console.log('\n🔗 Phase 4b: postgres_fdw setup')

  try {
    await exec('CREATE EXTENSION IF NOT EXISTS postgres_fdw')
    console.log('  ✅ postgres_fdw extension ready')
  } catch (e: unknown) {
    console.warn('  ⚠️  Could not create postgres_fdw extension:', (e as Error).message)
    console.warn('     Ensure superuser or CREATE privilege. FDW setup skipped.')
    return
  }

  const rows = await exec(
    `SELECT id, app_name, db_name, raw_table_name FROM "app_identifier" WHERE "db_name" IS NOT NULL AND "raw_table_name" IS NOT NULL`
  ) as { id: number; app_name: string; db_name: string; raw_table_name: string }[]

  const esc = (s: string) => s.replace(/'/g, "''")
  for (const row of rows) {
    const { db_name, raw_table_name } = row
    const serverName = `${db_name}_server`
    try {
      await exec(`
        DROP SERVER IF EXISTS "${serverName}" CASCADE
      `)
      await exec(`
        CREATE SERVER "${serverName}"
        FOREIGN DATA WRAPPER postgres_fdw
        OPTIONS (host '${esc(DB_HOST)}', dbname '${esc(db_name)}', port '${DB_PORT}')
      `)
      await exec(`
        CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER
        SERVER "${serverName}"
        OPTIONS (user '${esc(DB_USER)}', password '${esc(DB_PASSWORD)}')
      `)
      await exec(`
        DROP FOREIGN TABLE IF EXISTS "${raw_table_name}"
      `)
      await exec(`
        IMPORT FOREIGN SCHEMA public
        LIMIT TO ("${raw_table_name}")
        FROM SERVER "${serverName}"
        INTO public
      `)
      console.log(`  ✅ FDW: ${raw_table_name} <- ${db_name}.${raw_table_name}`)
    } catch (e: unknown) {
      console.warn(`  ⚠️  FDW for ${db_name}.${raw_table_name} failed:`, (e as Error).message)
    }
  }
  console.log('  ✅ Phase 4b done')
}

// ─── Phase 5: Stored procedures ──────────────────────────────────────────────

async function runStoredProcedures() {
  console.log('\n⚙️  Phase 5: Stored procedures')

  if (IS_PG) {
    await exec(`
CREATE OR REPLACE FUNCTION public.sp_process_bale_daily(p_processing_date DATE DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_app_id INT;
  v_app_name VARCHAR(255) := 'Bale';
  v_start_timestamp TIMESTAMP;
  v_end_timestamp TIMESTAMP;
  v_processing_date DATE;
  v_log_id INT;
  v_error_msg TEXT;
  v_records_processed INT := 0;
  v_records_inserted INT := 0;
  rec RECORD;
  v_tanggal_transaksi DATE;
  v_jenis_transaksi VARCHAR(255);
  v_rc VARCHAR(50);
  v_rc_description VARCHAR(500);
  v_total_transaksi INT;
  v_total_nominal DECIMAL(20,2);
  v_total_biaya_admin DECIMAL(20,2);
  v_status_transaksi VARCHAR(255);
  v_bulan VARCHAR(20);
  v_tahun INT;
  v_error_type VARCHAR(255);
  v_normalized_rc VARCHAR(50);
  v_normalized_rc_desc VARCHAR(500);
  v_normalized_status VARCHAR(255);
  v_is_rc_empty BOOLEAN;
  v_is_success BOOLEAN;
BEGIN
  IF p_processing_date IS NULL THEN
    v_processing_date := CURRENT_DATE - INTERVAL '1 day';
  ELSE
    v_processing_date := p_processing_date;
  END IF;
  v_start_timestamp := v_processing_date::timestamp;
  v_end_timestamp := (v_processing_date + INTERVAL '1 day' - INTERVAL '1 second')::timestamp;

  SELECT id INTO v_app_id FROM app_identifier WHERE app_name = v_app_name LIMIT 1;
  IF v_app_id IS NULL THEN
    RAISE EXCEPTION 'Application Bale not found in app_identifier table';
  END IF;

  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running')
  RETURNING id INTO v_log_id;

  BEGIN
    DELETE FROM app_success_rate WHERE id_app_identifier = v_app_id AND tanggal_transaksi = v_processing_date;

    FOR rec IN
      WITH categories AS (
        SELECT unnest(ARRAY[
          'ACTIVATE_DORMANT','BILLPAYMENT_BANK_LOAN','BILLPAYMENT_BPJS_KESEHATAN','BILLPAYMENT_BPJS_TENAGA_KERJA',
          'BILLPAYMENT_CREDIT_CARD','BILLPAYMENT_CREDIT_CARD_OTHER','BILLPAYMENT_DONATION_ACT',
          'BILLPAYMENT_DONATION_BAZNAS','BILLPAYMENT_DONATION_DOMPET','BILLPAYMENT_ECOM_BUKALAPAK',
          'BILLPAYMENT_ECOM_TOKOPEDIA','BILLPAYMENT_EDUCATION','BILLPAYMENT_INSURANCE',
          'BILLPAYMENT_INTERNET_TV','BILLPAYMENT_MPN','BILLPAYMENT_MULTIBILLER',
          'BILLPAYMENT_MULTIBILLER_LEGAL','BILLPAYMENT_NON_PBB','BILLPAYMENT_OTHER_LOAN','BILLPAYMENT_PBB',
          'BILLPAYMENT_PDAM','BILLPAYMENT_PEGADAIAN','BILLPAYMENT_PGN','BILLPAYMENT_PHONE',
          'BILLPAYMENT_PLN','BILLPAYMENT_TICKET_TRAIN','BILLPAYMENT_TRANSPORTATION','BILLPAYMENT_VA',
          'BILLPAYMENT_VA_MORTGAGE','BILLPAYMENT_VEHICLE_TAX','BUY_MUTUAL_FUND','BUY_SBN',
          'CARDLESS_DEPOSIT','CARDLESS_WITHDRAWAL','EDEPOSITO_PLACEMENT','EDEPOSITO_WITHDRAWAL',
          'FREEZE_PROXY_BIFAST','MONEY_CHANGER','PORTING_PROXY_BIFAST',
          'PURCHASE_EVOUCHER_MTIX','PURCHASE_EVOUCHER_STREAMING','PURCHASE_NFC_EMONEY',
          'PURCHASE_NFC_FLAZZ','PURCHASE_NFC_TAPCASH','PURCHASE_PHONE','PURCHASE_PLN_PREPAID',
          'PURCHASE_TOPUP_DANA','PURCHASE_TOPUP_GOPAY','PURCHASE_TOPUP_ISAKU','PURCHASE_TOPUP_LINKAJA',
          'PURCHASE_TOPUP_OVO','PURCHASE_TOPUP_POSPAY','PURCHASE_TOPUP_SHOPEEPAY','QR_CROSS_BORDER',
          'QR_MPM','REGISTRATION_PROXY_BIFAST','SELL_MUTUAL_FUND','SWITCH_FROM_MUTUAL_FUND',
          'SWITCH_TO_MUTUAL_FUND','TRANSFER_ALL','TRANSFER_BIFAST','TRANSFER_FOREX_OA',
          'TRANSFER_FOREX_ON_US','TRANSFER_OA','TRANSFER_OFF_US','TRANSFER_ON_US','TRANSFER_RTGS',
          'TRANSFER_SKN','TRANSFER_SPLIT_BILL','TRANSFER_SWIFT','UNFREEZE_PROXY_BIFAST',
          'UNREGISTRATION_PROXY_BIFAST','UPDATE_PROXY_BIFAST'
        ]) AS category
      )
      SELECT
        to_char(rb.transaction_date,'YYYY-MM-DD') AS "Tanggal Transaksi",
        rb.transaction_category AS "Jenis Transaksi",
        rb.result_code AS "RC",
        rb.result_code_desc AS "RC Description",
        count(DISTINCT rb.id) AS "total transaksi",
        SUM(rb.transaction_amount) AS "Total Nominal",
        SUM(rb.transaction_fee) AS "Total Biaya Admin",
        CASE
          WHEN rb.transaction_status = 0 THEN 'Success'
          WHEN rb.transaction_status = 1 THEN 'Failed'
          WHEN rb.transaction_status = 2 THEN 'Pending'
          WHEN rb.transaction_status = 9 THEN 'ACK'
          WHEN rb.transaction_status = 8 THEN 'REVERSAL'
          ELSE 'Status Tidak Dikenal'
        END AS "Status Transaksi"
      FROM raw_bale rb
      JOIN categories c ON rb.transaction_category = c.category
      WHERE rb.transaction_state IN ('1','9','8')
        AND rb.transaction_date BETWEEN v_start_timestamp AND v_end_timestamp
      GROUP BY "Tanggal Transaksi",rb.transaction_category,rb.result_code,rb.result_code_desc,rb.transaction_status
      ORDER BY "Tanggal Transaksi" DESC
    LOOP
      v_records_processed := v_records_processed + 1;
      v_tanggal_transaksi := rec."Tanggal Transaksi"::date;
      v_jenis_transaksi   := rec."Jenis Transaksi";
      v_rc                := rec."RC";
      v_rc_description    := rec."RC Description";
      v_total_transaksi   := rec."total transaksi";
      v_total_nominal     := rec."Total Nominal";
      v_total_biaya_admin := rec."Total Biaya Admin";
      v_status_transaksi  := rec."Status Transaksi";
      v_bulan := EXTRACT(MONTH FROM v_tanggal_transaksi)::VARCHAR;
      v_tahun := EXTRACT(YEAR  FROM v_tanggal_transaksi);
      v_normalized_rc := NULLIF(TRIM(COALESCE(v_rc, '')), '');
      v_normalized_rc := NULLIF(v_normalized_rc, '-');
      v_is_rc_empty := (v_normalized_rc IS NULL OR v_normalized_rc = '' OR v_normalized_rc = '-');
      v_normalized_rc_desc := LOWER(TRIM(COALESCE(v_rc_description, '')));
      v_normalized_status  := LOWER(TRIM(COALESCE(v_status_transaksi, '')));
      v_is_success := (
        v_normalized_rc_desc IN ('sukses','success','berhasil') OR
        v_normalized_status  IN ('sukses','success','berhasil')
      );
      IF v_is_rc_empty AND v_is_success THEN
        v_normalized_rc := '00'; v_is_rc_empty := FALSE;
      END IF;
      v_error_type := NULL;
      IF NOT v_is_rc_empty AND v_jenis_transaksi IS NOT NULL THEN
        SELECT error_type INTO v_error_type
        FROM response_code_dictionary
        WHERE id_app_identifier = v_app_id
          AND jenis_transaksi = v_jenis_transaksi
          AND rc = v_normalized_rc
        LIMIT 1;
        IF v_error_type IS NULL THEN
          INSERT INTO unmapped_rc (id_app_identifier, jenis_transaksi, rc, rc_description, status_transaksi, error_type)
          VALUES (v_app_id, v_jenis_transaksi, v_normalized_rc, v_rc_description, v_status_transaksi, NULL)
          ON CONFLICT (id_app_identifier, jenis_transaksi, rc) DO NOTHING;
        END IF;
      END IF;
      IF v_is_rc_empty THEN
        IF v_is_success THEN v_normalized_rc := '00'; v_error_type := 'Sukses';
        ELSE v_error_type := NULL; END IF;
      END IF;
      INSERT INTO app_success_rate (
        id_app_identifier, tanggal_transaksi, bulan, tahun, jenis_transaksi, rc, rc_description,
        total_transaksi, total_nominal, total_biaya_admin, status_transaksi, error_type
      ) VALUES (
        v_app_id, v_tanggal_transaksi, v_bulan, v_tahun, v_jenis_transaksi, v_normalized_rc, v_rc_description,
        v_total_transaksi, v_total_nominal, v_total_biaya_admin, v_status_transaksi, v_error_type::error_type_enum
      );
      v_records_inserted := v_records_inserted + 1;
    END LOOP;

    UPDATE app_processing_log
    SET status = 'success', end_time = NOW(), records_processed = v_records_processed, records_inserted = v_records_inserted
    WHERE id = v_log_id;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    UPDATE app_processing_log SET status = 'failed', end_time = NOW(), error_message = v_error_msg WHERE id = v_log_id;
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql
    `)
    console.log('  ✅ PostgreSQL sp_process_bale_daily created/replaced')
  } else {
    // MySQL stored procedure (config-driven cross-db: reads db_name, raw_table_name from app_identifier)
    await exec('DROP PROCEDURE IF EXISTS sp_process_bale_daily')
    await exec(`
CREATE PROCEDURE sp_process_bale_daily(IN p_processing_date DATE)
MODIFIES SQL DATA
SQL SECURITY DEFINER
BEGIN
  DECLARE v_app_id INT;
  DECLARE v_app_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Bale';
  DECLARE v_start_timestamp DATETIME;
  DECLARE v_end_timestamp DATETIME;
  DECLARE v_processing_date DATE;
  DECLARE v_log_id INT;
  DECLARE v_error_msg TEXT;
  DECLARE v_records_processed INT DEFAULT 0;
  DECLARE v_records_inserted  INT DEFAULT 0;
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_tanggal_transaksi DATE;
  DECLARE v_jenis_transaksi VARCHAR(255);
  DECLARE v_rc VARCHAR(50);
  DECLARE v_rc_description VARCHAR(500);
  DECLARE v_total_transaksi INT;
  DECLARE v_total_nominal DECIMAL(20,2);
  DECLARE v_total_biaya_admin DECIMAL(20,2);
  DECLARE v_status_transaksi VARCHAR(255);
  DECLARE v_bulan VARCHAR(20);
  DECLARE v_tahun INT;
  DECLARE v_error_type VARCHAR(255);
  DECLARE v_normalized_rc VARCHAR(50);
  DECLARE v_normalized_rc_desc VARCHAR(500);
  DECLARE v_normalized_status VARCHAR(255);
  DECLARE v_is_rc_empty BOOLEAN;
  DECLARE v_is_success BOOLEAN;

  DECLARE cur_bale_data CURSOR FOR
    WITH categories AS (
      SELECT 'ACTIVATE_DORMANT' COLLATE utf8mb4_unicode_ci AS category UNION ALL
      SELECT 'BILLPAYMENT_BANK_LOAN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_BPJS_KESEHATAN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_BPJS_TENAGA_KERJA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_CREDIT_CARD' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_CREDIT_CARD_OTHER' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_DONATION_ACT' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_DONATION_BAZNAS' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_DONATION_DOMPET' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_ECOM_BUKALAPAK' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_ECOM_TOKOPEDIA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_EDUCATION' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_INSURANCE' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_INTERNET_TV' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_MPN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_MULTIBILLER' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_MULTIBILLER_LEGAL' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_NON_PBB' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_OTHER_LOAN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PBB' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PDAM' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PEGADAIAN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PGN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PHONE' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_PLN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_TICKET_TRAIN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_TRANSPORTATION' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_VA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_VA_MORTGAGE' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BILLPAYMENT_VEHICLE_TAX' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BUY_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'BUY_SBN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'CARDLESS_DEPOSIT' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'CARDLESS_WITHDRAWAL' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'EDEPOSITO_PLACEMENT' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'EDEPOSITO_WITHDRAWAL' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'FREEZE_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'MONEY_CHANGER' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PORTING_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_EVOUCHER_MTIX' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_EVOUCHER_STREAMING' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_NFC_EMONEY' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_NFC_FLAZZ' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_NFC_TAPCASH' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_PHONE' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_PLN_PREPAID' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_DANA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_GOPAY' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_ISAKU' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_LINKAJA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_OVO' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_POSPAY' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'PURCHASE_TOPUP_SHOPEEPAY' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'QR_CROSS_BORDER' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'QR_MPM' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'REGISTRATION_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'SELL_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'SWITCH_FROM_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'SWITCH_TO_MUTUAL_FUND' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_ALL' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_FOREX_OA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_FOREX_ON_US' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_OA' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_OFF_US' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_ON_US' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_RTGS' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_SKN' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_SPLIT_BILL' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'TRANSFER_SWIFT' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'UNFREEZE_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'UNREGISTRATION_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci UNION ALL
      SELECT 'UPDATE_PROXY_BIFAST' COLLATE utf8mb4_unicode_ci
    )
    SELECT
      DATE_FORMAT(rb.transaction_date,'%Y-%m-%d') AS \`Tanggal Transaksi\`,
      rb.transaction_category AS \`Jenis Transaksi\`,
      rb.result_code AS \`RC\`,
      rb.result_code_desc AS \`RC Description\`,
      COUNT(DISTINCT rb.id) AS \`total transaksi\`,
      SUM(rb.transaction_amount) AS \`Total Nominal\`,
      SUM(rb.transaction_fee) AS \`Total Biaya Admin\`,
      CASE
        WHEN rb.transaction_status = 0 THEN 'Success'
        WHEN rb.transaction_status = 1 THEN 'Failed'
        WHEN rb.transaction_status = 2 THEN 'Pending'
        WHEN rb.transaction_status = 9 THEN 'ACK'
        WHEN rb.transaction_status = 8 THEN 'REVERSAL'
        ELSE 'Status Tidak Dikenal'
      END AS \`Status Transaksi\`
    FROM \`db_bale\`.\`raw_bale\` rb
    JOIN categories c ON rb.transaction_category COLLATE utf8mb4_unicode_ci = c.category COLLATE utf8mb4_unicode_ci
    WHERE rb.transaction_state IN ('1','9','8')
      AND rb.transaction_date BETWEEN v_start_timestamp AND v_end_timestamp
    GROUP BY \`Tanggal Transaksi\`,rb.transaction_category,rb.result_code,rb.result_code_desc,rb.transaction_status
    ORDER BY \`Tanggal Transaksi\` DESC;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    BEGIN ROLLBACK; END;
    GET DIAGNOSTICS CONDITION 1 v_error_msg = MESSAGE_TEXT;
    IF v_log_id IS NOT NULL THEN
      BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
        UPDATE app_processing_log SET status='failed', end_time=NOW(),
          error_message=CONCAT(COALESCE(error_message,''),' | ',COALESCE(v_error_msg,'UNKNOWN')) WHERE id=v_log_id;
      END;
    END IF;
    RESIGNAL;
  END;

  IF p_processing_date IS NULL THEN SET v_processing_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY);
  ELSE SET v_processing_date = p_processing_date; END IF;

  SET v_start_timestamp = v_processing_date;
  SET v_end_timestamp = DATE_ADD(v_processing_date, INTERVAL 1 DAY) - INTERVAL 1 SECOND;

  SET v_done = 0;
  SELECT id INTO v_app_id FROM app_identifier
  WHERE app_name COLLATE utf8mb4_unicode_ci = v_app_name COLLATE utf8mb4_unicode_ci LIMIT 1;
  SET v_done = 0;
  IF v_app_id IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Application Bale not found in app_identifier table'; END IF;

  INSERT INTO app_processing_log (app_name, id_app_identifier, processing_date, start_time, status)
  VALUES (v_app_name, v_app_id, v_processing_date, NOW(), 'running');
  SET v_log_id = LAST_INSERT_ID();
  IF v_log_id IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Failed to create processing log entry'; END IF;

  START TRANSACTION;
  DELETE FROM app_success_rate WHERE id_app_identifier=v_app_id AND tanggal_transaksi=v_processing_date;

  SET v_done = 0;
  OPEN cur_bale_data;
  read_loop: LOOP
    FETCH cur_bale_data INTO v_tanggal_transaksi,v_jenis_transaksi,v_rc,v_rc_description,
      v_total_transaksi,v_total_nominal,v_total_biaya_admin,v_status_transaksi;
    IF v_done THEN LEAVE read_loop; END IF;
    SET v_records_processed = v_records_processed + 1;
    SET v_bulan = MONTH(v_tanggal_transaksi);
    SET v_tahun = YEAR(v_tanggal_transaksi);
    SET v_normalized_rc = NULLIF(TRIM(COALESCE(v_rc,'')), '');
    SET v_normalized_rc = NULLIF(v_normalized_rc, '-');
    SET v_is_rc_empty = (v_normalized_rc IS NULL OR v_normalized_rc='' OR v_normalized_rc='-');
    SET v_normalized_rc_desc = LOWER(TRIM(COALESCE(v_rc_description,'')));
    SET v_normalized_status  = LOWER(TRIM(COALESCE(v_status_transaksi,'')));
    SET v_is_success = (
      v_normalized_rc_desc IN ('sukses','success','berhasil') OR
      v_normalized_status  IN ('sukses','success','berhasil')
    );
    IF v_is_rc_empty AND v_is_success THEN SET v_normalized_rc='00'; SET v_is_rc_empty=FALSE; END IF;
    SET v_error_type = NULL;
    IF NOT v_is_rc_empty AND v_jenis_transaksi IS NOT NULL THEN
      SET v_done = 0;
      SELECT error_type INTO v_error_type FROM response_code_dictionary
      WHERE id_app_identifier=v_app_id
        AND jenis_transaksi COLLATE utf8mb4_unicode_ci=v_jenis_transaksi COLLATE utf8mb4_unicode_ci
        AND rc COLLATE utf8mb4_unicode_ci=v_normalized_rc COLLATE utf8mb4_unicode_ci LIMIT 1;
      SET v_done = 0;
      IF v_error_type IS NULL THEN
        INSERT IGNORE INTO unmapped_rc (id_app_identifier,jenis_transaksi,rc,rc_description,status_transaksi,error_type)
        VALUES (v_app_id,v_jenis_transaksi,v_normalized_rc,v_rc_description,v_status_transaksi,NULL);
      END IF;
    END IF;
    IF v_is_rc_empty THEN
      IF v_is_success THEN SET v_normalized_rc='00'; SET v_error_type='Sukses';
      ELSE SET v_error_type=NULL; END IF;
    END IF;
    INSERT INTO app_success_rate (
      id_app_identifier,tanggal_transaksi,bulan,tahun,jenis_transaksi,rc,rc_description,
      total_transaksi,total_nominal,total_biaya_admin,status_transaksi,error_type
    ) VALUES (
      v_app_id,v_tanggal_transaksi,v_bulan,v_tahun,v_jenis_transaksi,v_normalized_rc,v_rc_description,
      v_total_transaksi,v_total_nominal,v_total_biaya_admin,v_status_transaksi,v_error_type
    );
    SET v_records_inserted = v_records_inserted + 1;
  END LOOP;
  CLOSE cur_bale_data;
  COMMIT;

  UPDATE app_processing_log
  SET status='success', end_time=NOW(), records_processed=v_records_processed, records_inserted=v_records_inserted
  WHERE id=v_log_id;
END
    `)
    console.log('  ✅ MySQL sp_process_bale_daily created/replaced')
  }

  console.log('  ✅ Phase 5 done')
}

// ─── Phase 6: Cron setup ─────────────────────────────────────────────────────

async function runCronSetup(isDefaultCronDatabase: boolean) {
  console.log('\n⏰ Phase 6: Cron setup')

  if (!IS_PG) {
    // MySQL event scheduler
    try {
      await exec('SET GLOBAL event_scheduler = ON')
    } catch {
      console.warn('  ⚠️  Could not enable event_scheduler (may require SUPER privilege)')
    }

    await exec('DROP EVENT IF EXISTS `evt_process_bale_daily`')
    const mysqlSchedule = parseCronForMySQL(CRON_SCHEDULE)
    await exec(`
      CREATE EVENT \`evt_process_bale_daily\`
      ON SCHEDULE ${mysqlSchedule}
      DO CALL sp_process_bale_daily(NULL)
    `)
    console.log(`  ✅ MySQL event evt_process_bale_daily created (${CRON_SCHEDULE})`)
    return
  }

  // PostgreSQL – only run cron setup in the default/cron database
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
    for (const dbName of targetDbs) {
      const jobName = `process-bale-daily-${dbName}`
      try {
        // Remove existing job first (unschedule is safe if it doesn't exist)
        try { await exec(`SELECT cron.unschedule('${esc(jobName)}')`) } catch { /* ok */ }
        await exec(`
          SELECT cron.schedule_in_database(
            '${esc(jobName)}',
            '${esc(CRON_SCHEDULE)}',
            $$SELECT public.sp_process_bale_daily(NULL)$$,
            '${esc(dbName)}',
            NULL,
            true
          )
        `)
        // schedule_in_database defaults to nodename='localhost'. When DB is on a remote host
        // (DB_HOST), pg_cron must connect to that host. Update nodename/nodeport so jobs succeed.
        await exec(`
          UPDATE cron.job
          SET nodename = '${esc(DB_HOST)}', nodeport = ${DB_PORT}
          WHERE jobname = '${esc(jobName)}'
        `)
        console.log(`  ✅ pg_cron job '${jobName}' → database '${dbName}' @ ${DB_HOST}:${DB_PORT} (${CRON_SCHEDULE})`)
      } catch (e: unknown) {
        console.warn(`  ⚠️  pg_cron job for '${dbName}' failed:`, (e as Error).message)
      }
    }
    return
  }

  // Fallback: pgAgent
  const hasPgAgent = await (async () => {
    try {
      const r = await exec(`SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='pgagent') AS exists`)
      const row = r[0] as Record<string, unknown>
      return row?.exists === true || row?.exists === 't'
    } catch { return false }
  })()

  if (hasPgAgent) {
    console.log('  pgAgent detected – creating jobs…')
    const sched = parseCronForPgAgent(CRON_SCHEDULE)
    const fmtArr = (arr: number[]) => arr.length === 0 ? 'ARRAY[]::INTEGER[]' : `ARRAY[${arr.join(',')}]`

    for (const dbName of targetDbs) {
      const jobName = `process-bale-daily-${dbName}`
      const esc = (s: string) => s.replace(/'/g, "''")
      try {
        // Remove existing job
        await exec(`DELETE FROM pgagent.pga_job WHERE jobname = '${esc(jobName)}'`)
        await exec(`
          DO $$
          DECLARE v_jobid INTEGER;
          BEGIN
            INSERT INTO pgagent.pga_job (jobjclid, jobname, jobdesc, jobhostagent, jobenabled)
            VALUES (1, '${esc(jobName)}', 'Bale processing for ${esc(dbName)} (${esc(CRON_SCHEDULE)})', '', true)
            RETURNING jobid INTO v_jobid;

            INSERT INTO pgagent.pga_schedule (
              jscjobid, jscname, jscdesc, jscenabled, jscstart,
              jscminutes, jschours, jscweekdays, jscmonthdays, jscmonths
            ) VALUES (
              v_jobid, 'bale-daily-${esc(dbName)}', 'Daily Bale schedule for ${esc(dbName)}', true, NOW(),
              ${fmtArr(sched.minutes)}, ${fmtArr(sched.hours)}, ${fmtArr(sched.weekdays)},
              ${fmtArr(sched.monthdays)}, ${fmtArr(sched.months)}
            );

            INSERT INTO pgagent.pga_jobstep (jstjobid, jstname, jstkind, jstcode, jstdbname, jstenabled)
            VALUES (v_jobid, 'execute-procedure', 's', 'SELECT public.sp_process_bale_daily(NULL);', '${esc(dbName)}', true);
          END $$
        `)
        console.log(`  ✅ pgAgent job '${jobName}' → database '${dbName}' (${CRON_SCHEDULE})`)
      } catch (e: unknown) {
        console.warn(`  ⚠️  pgAgent job for '${dbName}' failed:`, (e as Error).message)
      }
    }
    return
  }

  console.warn('  ⚠️  Neither pg_cron nor pgAgent found.')
  console.warn(`     To run manually: SELECT public.sp_process_bale_daily(NULL); in each target DB at ${CRON_SCHEDULE}`)
  console.warn('     Or set USE_APP_LEVEL_SCHEDULER=true to use node-cron instead.')
  console.log('  ✅ Phase 6 done (no scheduler configured)')
}

// ─── Phase 7: Seeds ──────────────────────────────────────────────────────────

async function runSeeds() {
  console.log('\n🌱 Phase 7: Seeds')

  // Default app identifiers (with db_name, raw_table_name for cross-db)
  const defaultApps = ['Bale', 'CMS', 'SMS Notif', 'QRIS', 'EDC Merchant', 'EDC Agent', 'Bale Korpora']
  for (const appName of defaultApps) {
    const dbName = deriveDbName(appName)
    const rawTableName = deriveRawTableName(appName)
    if (IS_PG) {
      await exec(
        `INSERT INTO "app_identifier" ("app_name","db_name","raw_table_name") VALUES ($1,$2,$3)
         ON CONFLICT ("app_name") DO UPDATE SET "db_name"=COALESCE("app_identifier"."db_name",EXCLUDED."db_name"), "raw_table_name"=COALESCE("app_identifier"."raw_table_name",EXCLUDED."raw_table_name")`,
        [appName, dbName, rawTableName],
      )
    } else {
      await exec(
        'INSERT INTO `app_identifier` (`app_name`,`db_name`,`raw_table_name`) VALUES (?,?,?) ON DUPLICATE KEY UPDATE `db_name`=COALESCE(`app_identifier`.`db_name`,VALUES(`db_name`)), `raw_table_name`=COALESCE(`app_identifier`.`raw_table_name`,VALUES(`raw_table_name`))',
        [appName, dbName, rawTableName],
      )
    }
  }
  // Backfill db_name/raw_table_name for any existing rows where NULL
  if (IS_PG) {
    const rows = await exec('SELECT id, app_name FROM "app_identifier" WHERE "db_name" IS NULL OR "raw_table_name" IS NULL')
    for (const row of rows as { id: number; app_name: string }[]) {
      const dbName = deriveDbName(row.app_name)
      const rawTableName = deriveRawTableName(row.app_name)
      await exec('UPDATE "app_identifier" SET "db_name"=$1, "raw_table_name"=$2 WHERE "id"=$3', [dbName, rawTableName, row.id])
    }
    if (rows.length > 0) console.log(`  ✅ Backfilled db_name/raw_table_name for ${rows.length} app(s)`)
  } else {
    const rows = await exec('SELECT id, app_name FROM `app_identifier` WHERE `db_name` IS NULL OR `raw_table_name` IS NULL')
    for (const row of rows as { id: number; app_name: string }[]) {
      const dbName = deriveDbName(row.app_name)
      const rawTableName = deriveRawTableName(row.app_name)
      await exec('UPDATE `app_identifier` SET `db_name`=?, `raw_table_name`=? WHERE `id`=?', [dbName, rawTableName, row.id])
    }
    if (rows.length > 0) console.log(`  ✅ Backfilled db_name/raw_table_name for ${rows.length} app(s)`)
  }
  console.log(`  ✅ ${defaultApps.length} default app identifiers seeded`)

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
      const hasBetterAuthCols = await columnExists('users', IS_PG ? 'email_verified' : 'email_verified')
      if (IS_PG) {
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
      } else {
        if (hasBetterAuthCols) {
          await exec(
            `INSERT INTO \`users\` (\`username\`,\`email\`,\`password_hash\`,\`role\`,\`name\`,\`email_verified\`)
             VALUES (?,?,?,'superadmin',?,1)
             ON DUPLICATE KEY UPDATE
               \`email\`=VALUES(\`email\`),
               \`password_hash\`=VALUES(\`password_hash\`),
               \`name\`=VALUES(\`name\`),
               \`email_enabled\`=1`,
            [username, email, bcryptHash, username],
          )
        } else {
          await exec(
            `INSERT INTO \`users\` (\`username\`,\`email\`,\`password_hash\`,\`role\`)
             VALUES (?,?,?,'superadmin')
             ON DUPLICATE KEY UPDATE
               \`email\`=VALUES(\`email\`),
               \`password_hash\`=VALUES(\`password_hash\`)`,
            [username, email, bcryptHash],
          )
        }
        const sel = await exec('SELECT `id` FROM `users` WHERE `username`=?', [username])
        userId = sel[0] ? (sel[0] as Record<string, unknown>).id as number : null
      }

      console.log(`  ✅ Superadmin seeded: ${username} (id=${userId})`)

      // ── Insert / upsert into BetterAuth `account` (credential store) ──────
      // BetterAuth verifies passwords from `account.password`, not `users.password_hash`
      if (userId !== null) {
        const userIdStr = String(userId)
        let existingAccountId: string | null = null
        if (IS_PG) {
          const acct = await exec(
            `SELECT "id" FROM "account" WHERE "provider_id"='credential' AND "user_id"=$1 LIMIT 1`,
            [userId],
          )
          existingAccountId = acct[0] ? (acct[0] as Record<string, unknown>).id as string : null
        } else {
          const acct = await exec(
            'SELECT `id` FROM `account` WHERE `provider_id`=\'credential\' AND `user_id`=? LIMIT 1',
            [userId],
          )
          existingAccountId = acct[0] ? (acct[0] as Record<string, unknown>).id as string : null
        }

        if (existingAccountId) {
          // Update password – must use BetterAuth's scrypt format (salt:hexkey)
          if (IS_PG) {
            await exec(
              `UPDATE "account" SET "password"=$1,"updated_at"=NOW() WHERE "id"=$2`,
              [baHash, existingAccountId],
            )
          } else {
            await exec(
              'UPDATE `account` SET `password`=?,`updated_at`=NOW() WHERE `id`=?',
              [baHash, existingAccountId],
            )
          }
          console.log(`  ✅ BetterAuth credential updated for: ${username}`)
        } else {
          // Insert new credential account – password must be BetterAuth scrypt format
          const accountId = randomUUID()
          if (IS_PG) {
            await exec(
              `INSERT INTO "account" ("id","account_id","provider_id","user_id","password","created_at","updated_at")
               VALUES ($1,$2,'credential',$3,$4,NOW(),NOW())`,
              [accountId, userIdStr, userId, baHash],
            )
          } else {
            await exec(
              'INSERT INTO `account` (`id`,`account_id`,`provider_id`,`user_id`,`password`,`created_at`,`updated_at`) VALUES (?,?,\'credential\',?,?,NOW(),NOW())',
              [accountId, userIdStr, userId, baHash],
            )
          }
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
  console.log(`   DB_TYPE : ${IS_PG ? 'PostgreSQL' : 'MySQL'}`)
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
      if (IS_PG && (RUN_ALL || ONLY_SCHEMA || ONLY_FDW)) {
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
