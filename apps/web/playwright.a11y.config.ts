import { defineConfig, devices } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Accessibility Release Gate configuration
//
// The gate audits the REAL production application: Playwright starts the
// production server (`next start`) and polls a deterministic readiness URL
// before running the six-route structural audit.
//
// Readiness (SPRINT-090A contract): /health/live returns 200 whenever the
// server process is alive and never performs I/O — the deterministic
// process-liveness probe for gates that intentionally run without database
// infrastructure (the a11y CI job provisions none; the audited routes are
// client-rendered and do not require it to render their structure).
// Polling the base URL '/' was replaced: an HTML route is a weaker, less
// deterministic readiness signal than the dedicated probe.
//
// forbidOnly / retries / workers mirror playwright.config.ts so CI runs the
// same deterministic, serial, no-.only() regime as the E2E gate. Retries do
// not weaken the gate: every route must ultimately pass its assertions or
// the job (and CI Result) fails.
// ─────────────────────────────────────────────────────────────────────────────

const port = process.env.A11Y_PORT ?? '3100';
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  webServer: {
    command: `npm run start -- -p ${port}`,
    url: `${baseURL}/health/live`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], baseURL },
    },
  ],
});
