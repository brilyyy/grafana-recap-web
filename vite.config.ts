import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // tanstackStart() builds with Nitro node-server preset by default,
  // producing .output/server/index.mjs for `node .output/server/index.mjs`.
  // Override target via NITRO_PRESET env var if deploying to a different runtime.
  plugins: [tanstackStart(), react(), tailwindcss()],
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
