import { MigrationInterface, QueryRunner } from 'typeorm'
import { getDatabaseAdapter } from '../lib/db-factory'
import { buildSimpleUpsertQuery } from '../lib/sql-helpers'

export class SeedDefaultApps1770030366140 implements MigrationInterface {
  name = 'SeedDefaultApps1770030366140'

  private getAdapter() {
    return getDatabaseAdapter()
  }

  private quoteIdentifier(name: string): string {
    return this.getAdapter().quoteIdentifier(name)
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const adapter = this.getAdapter()
    const tableName = this.quoteIdentifier('app_identifier')
    const appNameCol = this.quoteIdentifier('app_name')
    const isPostgres = adapter.getDatabaseType() === 'postgresql'

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

    const adapter = this.getAdapter()
    const isPostgres = adapter.getDatabaseType() === 'postgresql'
    
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
