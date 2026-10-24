import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Per-chunk warning only; the real budget (total first-load JS) is enforced by
    // scripts/check-bundle-size.mjs after every build.
    chunkSizeWarningLimit: 600,
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Fixed test configuration so tests never depend on (or reach) a real project.
    env: {
      VITE_API_URL: 'http://api.test',
      VITE_SUPABASE_URL: 'https://project.supabase.test',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_test_000000000000',
    },
  },
})
