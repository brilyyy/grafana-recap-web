#!/usr/bin/env node
/**
 * Comprehensive Drizzle Migration Runner (CLI wrapper)
 *
 * Thin CLI over the importable schema engine (./schema-engine.ts). The engine holds
 * all idempotent phase logic; this file only parses flags, opens a connection, and
 * pipes step lines to the console. The in-app "App Setup" tool drives the same engine.
 *
 * Phases:
 *   1. Core schema        – all application tables + basic indexes + FKs
 *   2. BetterAuth tables  – ALTER users, session, account, verification
 *   3. Processing log     – app_processing_log + indexes
 *   3b. Recap model tables – recap_cms_corp_daily, recap_bale_korpora_corp_daily
 *   4. Performance idx    – additional composite indexes
 *   4b. FDW setup         – postgres_fdw foreign servers/tables
 *   5. Stored procedures  – sp_process_*_daily (PostgreSQL functions) + housekeeping
 *   6. Seeds              – superadmin user(s) only
 *   8. Scheduler jobs     – scheduler_jobs table + seed
 *
 * Usage:
 *   npx tsx src/db/migrate.ts [--schema-only] [--procedures-only] [--seed-only] [--fdw-only] [--cron-only]
 *
 * Environment:
 *   Reads from .env – see src/env.ts for required variables.
 */

import * as dotenv from 'dotenv'

dotenv.config()

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  applyPhase,
  runBetterAuthSchema,
  runCoreSchema,
  runCronSetup,
  runFdwSetup,
  runPerformanceIndexes,
  runProcessingLogSchema,
  runRecapModelProcedures,
  runRecapModelTables,
  runSeeds,
  runStoredProcedures,
} from './schema-engine'

// ─── Argument parsing ───────────────────────────────────────────────────────

const args = process.argv.slice(2)
const ONLY_SCHEMA = args.includes('--schema-only')
const ONLY_PROCEDURES = args.includes('--procedures-only')
const ONLY_SEED = args.includes('--seed-only')
const ONLY_FDW = args.includes('--fdw-only')
const ONLY_CRON = args.includes('--cron-only')
const RUN_ALL = !ONLY_SCHEMA && !ONLY_PROCEDURES && !ONLY_SEED && !ONLY_FDW && !ONLY_CRON

// ─── Database connection ──────────────────────────────────────────────────────

const DB_HOST = process.env.DB_HOST ?? 'localhost'
const DB_PORT = parseInt(process.env.DB_PORT ?? '5432', 10)
const DB_USER = process.env.DB_USER ?? 'root'
const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
const DB_NAME = process.env.DB_NAME ?? 'platform_db'

const log = (line: string) => console.log(line)

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Drizzle Migration Runner`)
  console.log(`   DB_TYPE : PostgreSQL`)
  console.log(`   Host    : ${DB_HOST}:${DB_PORT}`)
  console.log(`   Database: ${DB_NAME}`)

  const client = postgres({
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  })
  const db = drizzle(client)

  try {
    if (RUN_ALL) {
      // Full run delegates to the engine's ordered "all" group.
      await applyPhase(db, client, 'all', log)
    } else {
      // Flag-scoped runs preserve the original CLI semantics
      // (note: --schema-only also provisions FDW, matching prior behavior).
      if (ONLY_SCHEMA) {
        await runCoreSchema(db, log)
        await runBetterAuthSchema(db, log)
        await runProcessingLogSchema(db, log)
        await runRecapModelTables(db, log)
        await runPerformanceIndexes(db, log)
      }
      if (ONLY_SCHEMA || ONLY_FDW) {
        await runFdwSetup(db, log, client)
      }
      if (ONLY_PROCEDURES) {
        await runStoredProcedures(db, log)
        await runRecapModelProcedures(db, log)
      }
      if (ONLY_SEED) {
        await runSeeds(db, log)
      }
      if (ONLY_CRON) {
        await runCronSetup(db, log)
      }
    }

    console.log('\n✅ All migrations completed successfully!\n')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err)
  process.exit(1)
})
