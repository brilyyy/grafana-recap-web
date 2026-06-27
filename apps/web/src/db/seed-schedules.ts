#!/usr/bin/env node
/**
 * Standalone Schedule Seeder
 *
 * Seeds `scheduler_jobs` with canonical cron job definitions.
 * Schedules are hardcoded — the DB is the single source of truth.
 * No environment variable lookups for schedules.
 *
 * Idempotent — ON CONFLICT (procedure) DO NOTHING — safe to re-run.
 *
 * Usage:
 *   pnpm db:seed-schedules
 */

import * as dotenv from 'dotenv'

dotenv.config()

import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

export interface SeedJob {
  name: string
  procedure: string
  defaultSchedule: string
}

export const SEED_JOBS: SeedJob[] = [
  { name: 'BALE processing', procedure: 'sp_process_bale_daily', defaultSchedule: '1 0 * * *' },
  { name: 'Bale Bisnis processing', procedure: 'sp_process_bale_bisnis_daily', defaultSchedule: '1 0 * * *' },
  { name: 'OLOB processing', procedure: 'sp_process_olob_daily', defaultSchedule: '1 0 * * *' },
  { name: 'CMS processing', procedure: 'sp_process_cms_daily', defaultSchedule: '1 0 * * *' },
  { name: 'CMS CORP recap', procedure: 'sp_recap_cms_corp_daily', defaultSchedule: '1 0 * * *' },
  {
    name: 'Bale Korpora CORP recap',
    procedure: 'sp_recap_bale_korpora_corp_daily',
    defaultSchedule: '1 0 * * *',
  },
  { name: 'Bale Korpora processing', procedure: 'sp_process_bale_korpora_daily', defaultSchedule: '1 0 * * *' },
  { name: 'EDC Agen processing', procedure: 'sp_process_edc_agen_daily', defaultSchedule: '1 0 * * *' },
  { name: 'EDC Merchant processing', procedure: 'sp_process_edc_merchant_daily', defaultSchedule: '1 0 * * *' },
  {
    name: 'EDC Merchant Ancol processing',
    procedure: 'sp_process_edc_merchant_ancol_daily',
    defaultSchedule: '1 0 * * *',
  },
  { name: 'Debit Online processing', procedure: 'sp_process_debit_online_daily', defaultSchedule: '1 0 * * *' },
  { name: 'Housekeeping', procedure: 'sp_run_raw_housekeeping', defaultSchedule: '0 2 * * *' },
]

async function main() {
  console.log('\n🌱 Seeding scheduler_jobs')

  for (const job of SEED_JOBS) {
    await db.execute(sql`
      INSERT INTO "scheduler_jobs" ("name", "procedure", "schedule")
      VALUES (${job.name}, ${job.procedure}, ${job.defaultSchedule})
      ON CONFLICT ("procedure") DO NOTHING
    `)
    console.log(`  ✅ ${job.name}`)
  }

  console.log(`\n  ✅ ${SEED_JOBS.length} jobs seeded (ON CONFLICT DO NOTHING)`)
  console.log('✅ Done\n')
}

// Only run when executed directly (pnpm db:seed-schedules)
const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error('\n❌ Seed failed:', err)
    process.exit(1)
  })
}
