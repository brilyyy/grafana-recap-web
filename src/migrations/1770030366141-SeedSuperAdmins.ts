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

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      const adapter = this.getAdapter()
      const isPostgres = adapter.getDatabaseType() === 'postgresql'
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
    const defaultUsernames = process.env.DEFAULT_SU_USERNAME

    if (!defaultUsernames) {
      return
    }

    const usernames = defaultUsernames.split(',').map(u => u.trim()).filter(u => u.length > 0)

    // Remove superadmin users
    if (usernames.length > 0) {
      const adapter = this.getAdapter()
      const isPostgres = adapter.getDatabaseType() === 'postgresql'
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
