import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Performance budget for the main chunk (measured 2026-10-24: 546 kB, 162 kB gzipped).
    // It is mostly React, React Router, TanStack Query and Supabase Auth, which every page
    // needs. Pages are lazy-loaded. If this warning fires, find what grew before raising it.
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
