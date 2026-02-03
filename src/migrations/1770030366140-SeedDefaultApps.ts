import { MigrationInterface, QueryRunner } from 'typeorm'

export class SeedDefaultApps1770030366140 implements MigrationInterface {
  name = 'SeedDefaultApps1770030366140'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert default app identifiers
    await queryRunner.query(`
      INSERT INTO \`app_identifier\` (\`app_name\`)
      VALUES
        ('Bale'),
        ('CMS'),
        ('SMS Notif'),
        ('QRIS'),
        ('EDC Merchant'),
        ('EDC Agent'),
        ('Bale Korpora')
      ON DUPLICATE KEY UPDATE \`app_name\` = \`app_name\`
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove default apps
    await queryRunner.query(`
      DELETE FROM \`app_identifier\`
      WHERE \`app_name\` IN ('Bale', 'CMS', 'SMS Notif', 'QRIS', 'EDC Merchant', 'EDC Agent', 'Bale Korpora')
    `)
  }
}
