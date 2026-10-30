import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// The tests create (and delete) throwaway accounts in the Supabase project from ../.env.
if (existsSync('../.env')) process.loadEnvFile('../.env')

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Journeys share one dev server and database; a couple at a time keeps them reliable.
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    // The installed Google Chrome, so no extra browser download is needed.
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  // Starts the API and the website if they aren't already running.
  webServer: [
    {
      command: 'npm run dev:api',
      cwd: '..',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    { command: 'npm run dev', cwd: '..', url: 'http://localhost:5173', reuseExistingServer: true },
  ],
})
