import { MigrationInterface, QueryRunner } from 'typeorm'
import bcrypt from 'bcryptjs'
import { getDatabaseAdapter } from '../lib/db-factory'

// Hash password helper (duplicated from auth.ts to avoid circular dependency)
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

export class SeedSuperAdmins1770030366141 implements MigrationInterface {
  name = 'SeedSuperAdmins1770030366141'

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
    // The users table only exists in target databases.
    if (isPostgres && await this.isDefaultCronDatabase(queryRunner)) {
      console.log('ℹ️  SeedSuperAdmins: default cron database detected — skipping seed')
      return
    }

    const defaultUsernames = process.env.DEFAULT_SU_USERNAME
    const defaultPasswords = process.env.DEFAULT_SU_PASSWORD
    const defaultEmails = process.env.DEFAULT_SU_EMAIL

    // Check if environment variables are set
    if (!defaultUsernames || !defaultPasswords) {
      console.log('⚠️  DEFAULT_SU_USERNAME or DEFAULT_SU_PASSWORD not set. Skipping superadmin seed.')
      return
    }

    // Parse comma-separated values
    const usernames = defaultUsernames.split(',').map(u => u.trim()).filter(u => u.length > 0)
    const passwords = defaultPasswords.split(',').map(p => p.trim()).filter(p => p.length > 0)
    const emails = defaultEmails
      ? defaultEmails.split(',').map(e => e.trim()).filter(e => e.length > 0)
      : []

    // Validate arrays have same length
    if (usernames.length !== passwords.length) {
      throw new Error(
        `DEFAULT_SU_USERNAME and DEFAULT_SU_PASSWORD must have the same number of entries. ` +
        `Found ${usernames.length} usernames and ${passwords.length} passwords.`
      )
    }

    // Validate email array if provided
    if (emails.length > 0 && emails.length !== usernames.length) {
      throw new Error(
        `DEFAULT_SU_EMAIL must have the same number of entries as DEFAULT_SU_USERNAME. ` +
        `Found ${usernames.length} usernames and ${emails.length} emails.`
      )
    }

    // Insert superadmin users
    for (let i = 0; i < usernames.length; i++) {
      const username = usernames[i]
      const password = passwords[i]
      const email = emails[i] || `${username}@superadmin.local`

      // Validate password length
      if (password.length < 8) {
        console.warn(`⚠️  Password for ${username} is less than 8 characters. Skipping.`)
        continue
      }

      // Hash password
      const passwordHash = await hashPassword(password)

      // Insert user (skip if already exists)
      const usersTable = this.quoteIdentifier('users')
      const usernameCol = this.quoteIdentifier('username')
      const emailCol = this.quoteIdentifier('email')
      const passwordHashCol = this.quoteIdentifier('password_hash')
      const roleCol = this.quoteIdentifier('role')

      try {
        if (isPostgres) {
          // PostgreSQL: Use ON CONFLICT
          await queryRunner.query(
            `INSERT INTO ${usersTable} (${usernameCol}, ${emailCol}, ${passwordHashCol}, ${roleCol})
             VALUES ($1, $2, $3, 'superadmin')
             ON CONFLICT (${usernameCol}) DO NOTHING`,
            [username, email, passwordHash]
          )
        } else {
          // MySQL: Use ON DUPLICATE KEY UPDATE
          await queryRunner.query(
            `INSERT INTO ${usersTable} (${usernameCol}, ${emailCol}, ${passwordHashCol}, ${roleCol})
             VALUES (?, ?, ?, 'superadmin')
             ON DUPLICATE KEY UPDATE ${usernameCol} = ${usernameCol}`,
            [username, email, passwordHash]
          )
        }
        console.log(`✅ Superadmin user created: ${username}`)
      } catch (error: any) {
        const normalizedError = adapter.normalizeError(error)
        if (normalizedError.code === 'DUPLICATE_ENTRY') {
          console.log(`ℹ️  Superadmin user already exists: ${username}. Skipping.`)
        } else {
          console.error(`❌ Error creating superadmin user ${username}:`, error.message)
          throw error
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const adapter = this.getAdapter()
    const isPostgres = adapter.getDatabaseType() === 'postgresql'

    // Nothing to remove in the default cron database — seed was never inserted there
    if (isPostgres && await this.isDefaultCronDatabase(queryRunner)) {
      console.log('ℹ️  SeedSuperAdmins: default cron database detected — skipping down')
      return
    }

    const defaultUsernames = process.env.DEFAULT_SU_USERNAME

    if (!defaultUsernames) {
      return
    }

    const usernames = defaultUsernames.split(',').map(u => u.trim()).filter(u => u.length > 0)

    // Remove superadmin users
    if (usernames.length > 0) {
      const usersTable = this.quoteIdentifier('users')
      const usernameCol = this.quoteIdentifier('username')
      const roleCol = this.quoteIdentifier('role')

      if (isPostgres) {
        // PostgreSQL: Use parameterized query with $1, $2, etc.
        const placeholders = usernames.map((_, i) => `$${i + 1}`).join(',')
        await queryRunner.query(
          `DELETE FROM ${usersTable} WHERE ${usernameCol} IN (${placeholders}) AND ${roleCol} = 'superadmin'`,
          usernames
        )
      } else {
        // MySQL: Use parameterized query with ?
        const placeholders = usernames.map(() => '?').join(',')
        await queryRunner.query(
          `DELETE FROM ${usersTable} WHERE ${usernameCol} IN (${placeholders}) AND ${roleCol} = 'superadmin'`,
          usernames
        )
      }
    }
  }
}