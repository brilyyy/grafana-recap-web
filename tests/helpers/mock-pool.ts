/**
 * Fake pg.Pool for testing `applyFdwConfig` without a live database.
 *
 * Responses are queued in order via `enqueue()`.  If the queue is empty a
 * default `{ rows: [] }` is returned.  Errors are injected the same way via
 * `enqueueError()`.  All emitted SQL strings are recorded in `getQueries()`.
 */
export class MockPool {
  private calls: string[] = []
  private queue: (Record<string, unknown>[] | Error)[] = []

  /** Queue rows to be returned by the next call(s) to `query`. */
  enqueue(rows: Record<string, unknown>[]) {
    this.queue.push(rows)
  }

  /** Queue an error to be thrown by the next call to `query`. */
  enqueueError(err: Error | string) {
    this.queue.push(typeof err === 'string' ? new Error(err) : err)
  }

  async query(sql: string): Promise<{ rows: Record<string, unknown>[] }> {
    this.calls.push(sql.trim())
    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      if (next instanceof Error) throw next
      return { rows: next }
    }
    return { rows: [] }
  }

  getQueries(): string[] {
    return [...this.calls]
  }

  reset() {
    this.calls = []
    this.queue = []
  }

  async end() {}
}
