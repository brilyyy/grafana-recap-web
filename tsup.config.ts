import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/workers/scheduler-worker.ts'],
  outDir: '.output/server/workers',
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  bundle: true,
  clean: true,
  outExtension: () => ({ js: '.mjs' }),
  external: [
    'dotenv',
    'postgres',
    'drizzle-orm',
    'drizzle-orm/postgres-js',
    'node-cron',
    'pino',
    'rotating-file-stream',
  ],
})
