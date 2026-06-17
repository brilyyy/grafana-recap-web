import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // tanstackStart() builds with Nitro node-server preset by default,
  // producing .output/server/index.mjs for `node .output/server/index.mjs`.
  // Override target via NITRO_PRESET env var if deploying to a different runtime.
  plugins: [
    // Paraglide first so messages/runtime are generated before other plugins resolve them.
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
    }),
    tanstackStart(),
    nitro(),
    react(),
    tailwindcss(),
  ],
  // Keep the Node-only file logger and its native deps out of bundling;
  // they run in the server runtime only (never the client bundle).
  ssr: {
    external: ['pino', 'rotating-file-stream', 'pino-pretty'],
  },
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
})
