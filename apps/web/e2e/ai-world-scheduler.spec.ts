// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI World Scheduler Journey (EPIC-018)
// Real Chrome journey through the EXISTING /ai-world page:
//   Open AI World → view discovery status → view schedules → change a
//   frequency → save → run discovery → observe the persisted result →
//   reload → verify schedule + history persist.
// Nothing is faked: assertions follow what the REAL gateway reports. The
// deterministic static catalog is the discovery source (no live-service
// claims are ever made — scheduled runs honestly report what they found).
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from '@playwright/test';
import { injectSession } from './helpers/auth.js';
import { installAuthDiagnostics, captureBrowserState } from './helpers/auth-diagnostics.js';

test.describe.configure({ mode: 'serial' });

test.describe('AI World Discovery Activity — Real-User Journey (EPIC-018)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  test('discovery status → schedules → change frequency → run → reload persistence', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ── SPRINT-086: Install auth diagnostics BEFORE navigation ──────────
    const diag = installAuthDiagnostics(page);

    // ── Open AI World ───────────────────────────────────────────────────
    await page.goto('/ai-world');
    // exact: true — the page also renders an "AI World — Today" h2, and
    // accessible-name matching is prefix-based, so the bare h1 needs an
    // exact match.
    await expect(page.getByRole('heading', { name: 'AI World', exact: true })).toBeVisible({
      timeout: 60_000,
    });

    // ── SPRINT-086: Capture browser state after navigation ──────────────
    const browserState = await captureBrowserState(page);
    console.warn(`[AUTH-DIAG] heading appeared — auth succeeded`);
    console.warn(`[AUTH-DIAG] sessionRequest: ${JSON.stringify(diag.sessionRequest)}`);
    console.warn(`[AUTH-DIAG] meRequest: ${JSON.stringify(diag.meRequest)}`);
    console.warn(`[AUTH-DIAG] browserState: ${JSON.stringify(browserState)}`);

    // ── Discovery Activity / Schedule section (EPIC-018) ────────────────
    await expect(page.getByText('Discovery Activity')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Next discovery', { exact: true })).toBeVisible();
    await expect(page.getByText('Last scan', { exact: true })).toBeVisible();

    // ── EPIC-018 runtime closure — the automatic discovery indicator must
    //    be honest: it only claims automatic discovery when the runtime
    //    cadence driver is actually active in the gateway process.
    await expect(page.getByText(/Automatic discovery/)).toBeVisible({ timeout: 60_000 });

    // All seven schedule categories render with plain labels + statuses. The
    // labels also appear in the page's tab bar ("Providers", "GitHub"), so
    // scope each assertion to its schedule row via the unique frequency-select
    // aria-label ("<label> frequency") and its parent <li>.
    for (const label of [
      'Critical changes',
      'Providers',
      'GitHub',
      'Free AI',
      'Local Models',
      'AI News',
      'Deep Scan',
    ]) {
      const row = page.getByLabel(`${label} frequency`).locator('xpath=ancestor::li');
      await expect(row.getByText(label, { exact: true })).toBeVisible();
    }

    // ── Change a frequency and save (auto-persisted) ────────────────────
    await page.getByLabel('AI News frequency').selectOption('WEEKLY');
    // The frequency select reflects the saved value.
    await expect(page.getByLabel('AI News frequency')).toHaveValue('WEEKLY');

    // ── Run discovery through the same bounded path (Run now) ───────────
    // SPRINT-082: The click() fires an async handler (runNow mutation →
    // refreshAll → refreshScheduler) but returns immediately.  We
    // synchronize deterministically on the network round-trips instead of
    // relying on a DOM-polling timeout that races the handler.
    //
    // 1) Wait for the runNow mutation POST to complete (server returns
    //    the DiscoveryRun after the bounded run finishes).
    const runNowResponse = page.waitForResponse(
      (res) => res.url().includes('aiWorldScheduler.runNow') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Run AI News discovery now' }).click();
    await runNowResponse;

    // 2) Wait for the subsequent scheduler-status batched POST that the
    //    handler fires after the mutation (refreshScheduler →
    //    schedulerStatus.refetch).  With httpBatchLink the refetch lands as
    //    a POST containing 'aiWorldScheduler.getStatus' in the URL path.
    //    This response carries the fresh lastScanAt that makes the UI
    //    display "Completed just now".
    await page.waitForResponse((res) => {
      const url = res.url();
      return (
        res.request().method() === 'POST' &&
        url.includes('/api/trpc') &&
        url.includes('aiWorldScheduler.getStatus')
      );
    });

    // 3) Now the React Query cache is updated and React will re-render.
    //    The DOM assertion can safely poll.
    await expect(page.getByText(/Completed (just now|1m ago)/)).toBeVisible({ timeout: 30_000 });

    // ── Reload: schedule + history persist (same gateway process) ───────
    await page.reload();
    await expect(page.getByText('Discovery Activity')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('AI News frequency')).toHaveValue('WEEKLY');
    // The AI News row still reports the persisted run.
    await expect(page.getByText(/AI News/)).toBeVisible();
    await expect(page.getByText(/last run (just now|1m ago)/)).toBeVisible();

    // No page-level JS errors broke the schedule UI.
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });
});
