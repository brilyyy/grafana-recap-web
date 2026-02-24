import { MigrationInterface, QueryRunner } from 'typeorm'
import { getDatabaseAdapter } from '../lib/db-factory'

export class SeedDefaultApps1770030366140 implements MigrationInterface {
  name = 'SeedDefaultApps1770030366140'

  private getAdapter() {
    return getDatabaseAdapter()
  }

  private quoteIdentifier(name: string): string {
    return this.getAdapter().quoteIdentifier(name)
  }

  /**
   * Returns true if running in the default PostgreSQL database
   * (identified by the presence of the pg_cron extension).
   * Seed data must only be inserted into target databases.
   */
  private async isDefaultCronDatabase(queryRunner: QueryRunner): Promise<boolean> {
    try {
      const raw: any = await queryRunner.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
        ) AS exists
      `)
      const row = Array.isArray(raw) ? raw[0] : raw?.rows?.[0] ?? raw
      return row != null && (row.exists === true || row.exists === 't')
    } catch {
      return false
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const adapter = this.getAdapter()
    const isPostgres = adapter.getDatabaseType() === 'postgresql'

    // Skip seeding in the default PostgreSQL database (pg_cron host).
    // The app_identifier table only exists in target databases.
    if (isPostgres && await this.isDefaultCronDatabase(queryRunner)) {
      console.log('ℹ️  SeedDefaultApps: default cron database detected — skipping seed')
      return
    }

    const tableName = this.quoteIdentifier('app_identifier')
    const appNameCol = this.quoteIdentifier('app_name')

    const defaultApps = [
      'Bale',
      'CMS',
      'SMS Notif',
      'QRIS',
      'EDC Merchant',
      'EDC Agent',
      'Bale Korpora'
    ]

    // Insert default app identifiers with upsert
    for (const appName of defaultApps) {
      if (isPostgres) {
        // PostgreSQL: Use ON CONFLICT
        await queryRunner.query(`
          INSERT INTO ${tableName} (${appNameCol})
          VALUES ($1)
          ON CONFLICT (${appNameCol}) DO NOTHING
        `, [appName])
      } else {
        // MySQL: Use ON DUPLICATE KEY UPDATE
        await queryRunner.query(`
          INSERT INTO ${tableName} (${appNameCol})
          VALUES (?)
          ON DUPLICATE KEY UPDATE ${appNameCol} = ${appNameCol}
        `, [appName])
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const adapter = this.getAdapter()
    const isPostgres = adapter.getDatabaseType() === 'postgresql'

    // Nothing to remove in the default cron database — seed was never inserted there
    if (isPostgres && await this.isDefaultCronDatabase(queryRunner)) {
      console.log('ℹ️  SeedDefaultApps: default cron database detected — skipping down')
      return
    }

    const tableName = this.quoteIdentifier('app_identifier')
    const appNameCol = this.quoteIdentifier('app_name')
    
    // Remove default apps
    const defaultApps = [
      'Bale',
      'CMS',
      'SMS Notif',
      'QRIS',
      'EDC Merchant',
      'EDC Agent',
      'Bale Korpora'
    ]

    if (isPostgres) {
      // PostgreSQL: Use parameterized query
      const placeholders = defaultApps.map((_, i) => `$${i + 1}`).join(', ')
      await queryRunner.query(`
        DELETE FROM ${tableName}
        WHERE ${appNameCol} IN (${placeholders})
      `, defaultApps)
    } else {
      // MySQL: Use parameterized query with ?
      const placeholders = defaultApps.map(() => '?').join(', ')
      await queryRunner.query(`
        DELETE FROM ${tableName}
        WHERE ${appNameCol} IN (${placeholders})
      `, defaultApps)
    }
  }
}