require('reflect-metadata')
const typeorm = require('typeorm')
const dotenv = require('dotenv')

// Load environment variables
dotenv.config()

/**
 * TypeORM Configuration for PostgreSQL CLI commands (migrations)
 * This file is used by TypeORM CLI tools for PostgreSQL
 * Using CommonJS style for typeorm-ts-node-commonjs compatibility
 */
module.exports = new typeorm.DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  entities: [__dirname + '/src/entities/**/*.ts'],
  
  // Migrations - using pattern like example project
  migrations: [__dirname + '/src/migrations/**/*{.ts,.js}'],
  
  // Synchronization (disabled - use migrations only)
  synchronize: false,
  
  // Logging
  logging: true,
  
  // PostgreSQL specific options
  extra: {
    // Connection pool options
    max: 10,
  },
})
