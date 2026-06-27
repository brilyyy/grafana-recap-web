import { defineConfig } from 'tsup'

const cjsCompatBanner = `import { createRequire as __createRequire } from 'node:module';
import { fileURLToPath as __fileURLToPath } from 'node:url';
import { dirname as __dirnameFn } from 'node:path';
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirnameFn(__filename);`

export default defineConfig([
  {
    entry: ['src/workers/scheduler-worker.ts'],
    outDir: '.output/server/workers',
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    bundle: true,
    splitting: false,
    clean: true,
    outExtension: () => ({ js: '.mjs' }),
    noExternal: [/.*/],
    banner: { js: cjsCompatBanner },
  },
  {
    entry: ['src/db/seed-superadmin.ts'],
    outDir: '.output/server/workers',
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    bundle: true,
    splitting: false,
    clean: false,
    outExtension: () => ({ js: '.mjs' }),
    noExternal: [/.*/],
    banner: { js: cjsCompatBanner },
  },
  {
    entry: ['src/db/dump-sp-catalog.ts'],
    outDir: '.output/server/workers',
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    bundle: true,
    splitting: false,
    clean: false,
    outExtension: () => ({ js: '.mjs' }),
    noExternal: [/.*/],
    banner: { js: cjsCompatBanner },
  },
])
