import { MigrationInterface, QueryRunner } from 'typeorm'
import bcrypt from 'bcryptjs'

// Hash password helper (duplicated from auth.ts to avoid circular dependency)
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

export class SeedSuperAdmins1770030366141 implements MigrationInterface {
  name = 'SeedSuperAdmins1770030366141'

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
      try {
        await queryRunner.query(
          `INSERT INTO \`users\` (\`username\`, \`email\`, \`password_hash\`, \`role\`)
           VALUES (?, ?, ?, 'superadmin')
           ON DUPLICATE KEY UPDATE \`username\` = \`username\``,
          [username, email, passwordHash]
        )
        console.log(`✅ Superadmin user created: ${username}`)
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
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
      const placeholders = usernames.map(() => '?').join(',')
      await queryRunner.query(
        `DELETE FROM \`users\` WHERE \`username\` IN (${placeholders}) AND \`role\` = 'superadmin'`,
        usernames
      )
    }
  }
}
