// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Playwright E2E Test Configuration
// Covers complete user journey: Identity → Dashboard → Career → Learning →
// Business → Marketplace → Settings
// BLD-016-B — Web Application Quality
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // ── Test Configuration ───────────────────────────────────────────────────
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  // ── Timeouts ─────────────────────────────────────────────────────────────
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },

  // ── Build / Dev Server ───────────────────────────────────────────────────
  // Uses production build (next start) in CI, dev server locally.
  // Note: webServer.command runs from the directory of THIS config file
  // (apps/web), so CI must run `npm run start` directly — the .next build
  // is produced by the CI e2e job's "Build web app" step before this runs.
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  // ── Projects ─────────────────────────────────────────────────────────────
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
      },
    },
  ],
});
