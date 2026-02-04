/**
 * Database Adapter Interface
 * 
 * Abstract interface untuk database operations yang support
 * baik MySQL maupun PostgreSQL
 */
export interface DatabaseConnection {
  release(): void
  execute(query: string, params?: any[]): Promise<any>
  query(query: string, params?: any[]): Promise<any>
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
}

export interface DatabaseError {
  code: string
  message: string
}

export interface DatabaseAdapter {
  /**
   * Execute a prepared statement query
   * Returns [rows, result] format similar to mysql2
   */
  execute(query: string, params?: any[]): Promise<[any[], any]>
  
  /**
   * Execute a regular query
   * Returns [rows, result] format similar to mysql2
   */
  query(query: string, params?: any[]): Promise<[any[], any]>
  
  /**
   * Get a connection from the pool
   */
  getConnection(): Promise<DatabaseConnection>
  
  /**
   * Get last insert ID from result
   */
  getLastInsertId(result: any): number
  
  /**
   * Normalize error codes between databases
   */
  normalizeError(error: any): DatabaseError
  
  /**
   * Quote identifier (table/column name)
   */
  quoteIdentifier(name: string): string
  
  /**
   * Get database type
   */
  getDatabaseType(): 'mysql' | 'postgresql'
  
  /**
   * Test database connection
   */
  testConnection(): Promise<boolean>
}
