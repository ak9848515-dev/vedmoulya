// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Playwright E2E Test Configuration
// SPRINT-090A — Deterministic Startup via /health/ready
//
// The webServer.url now points to /health/ready instead of the base URL.
// This ensures Playwright waits for actual application readiness (gateway
// initialized + database reachable) before beginning browser tests.
//
// Lifecycle:
//   1. Playwright starts VedMoulya (dev server or next start)
//   2. Playwright polls http://localhost:3000/health/ready
//   3. /health/ready returns 200 only when:
//      - Gateway is initialized (getServices() called)
//      - Database is reachable (SELECT 1 succeeds)
//   4. Tests begin — no business-page warm-up needed
//
// Previous approach (SPRINT-087E): Each E2E test navigated to /brain and
// polled for "Idle — ready" / "Working — executing" / "Needs your approval"
// with a 120s timeout. This was a business warm-up that coupled test startup
// to a specific page's tRPC query. SPRINT-090A replaces it with the
// deterministic /health/ready readiness contract.
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
  // SPRINT-090A: webServer.url points to /health/ready so Playwright waits
  // for actual application readiness before beginning tests. This replaces
  // the per-test /brain warm-up pattern with a single deterministic gate.
  //
  // The readiness endpoint:
  //   - Returns 200 when gateway init + database are ready
  //   - Returns 503 during cold startup
  //   - Requires no authentication
  //   - Performs safe SELECT 1 database probe
  //   - Does not trigger DDL or engine initialization
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000/health/ready',
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
