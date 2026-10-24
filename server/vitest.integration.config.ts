import { defineConfig } from 'vitest/config'

// Integration tests talk to the real Supabase project configured in ../.env.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
