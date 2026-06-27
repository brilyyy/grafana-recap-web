import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**', 'src/lib/**', 'src/server/trpc/**'],
      exclude: ['**/*.tsx', 'src/lib/auth-client.ts', 'src/lib/better-auth.ts'],
    },
  },
})
