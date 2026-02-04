import 'reflect-metadata'
import { DataSource } from 'typeorm'
import path from 'path'

/**
 * Get database type from environment variable
 */
function getDatabaseType(): 'mysql' | 'postgres' {
  const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase()
  if (dbType === 'postgresql' || dbType === 'postgres') {
    return 'postgres'
  }
  return 'mysql'
}

/**
 * TypeORM Data Source Configuration
 * Used for migrations and entity management
 * Supports both MySQL and PostgreSQL
 */
const dbType = getDatabaseType()

const baseConfig = {
  host: process.env.DB_HOST || (dbType === 'postgres' ? 'localhost' : 'localhost'),
  port: parseInt(process.env.DB_PORT || (dbType === 'postgres' ? '5432' : '3306')),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Entities
  entities: [
    path.join(__dirname, '../entities/**/*.ts'),
    path.join(__dirname, '../entities/**/*.js'),
  ],
  
  // Migrations
  migrations: [path.join(__dirname, '../migrations/**/*.ts')],
  
  // Synchronization (disabled - use migrations only)
  synchronize: false,
  
  // Logging (only in development)
  logging: process.env.NODE_ENV === 'development',
  
  // Connection options
  extra: {
    connectionLimit: 10,
  },
}

// Add database-specific options
const dbSpecificConfig = dbType === 'postgres' 
  ? {
      // PostgreSQL specific options
      // No charset or timezone needed
    }
  : {
      // MySQL specific options
      charset: 'utf8mb4',
      timezone: '+00:00',
    }

export const AppDataSource = new DataSource({
  type: dbType,
  ...baseConfig,
  ...dbSpecificConfig,
})

/**
 * Initialize data source connection
 */
export async function initializeDataSource() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize()
      console.log('✅ TypeORM Data Source initialized successfully!')
      return true
    }
    return true
  } catch (error) {
    console.error('❌ Error initializing TypeORM Data Source:', error)
    return false
  }
}

/**
 * Close data source connection
 */
export async function closeDataSource() {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy()
      console.log('✅ TypeORM Data Source closed successfully!')
      return true
    }
    return true
  } catch (error) {
    console.error('❌ Error closing TypeORM Data Source:', error)
    return false
  }
}
