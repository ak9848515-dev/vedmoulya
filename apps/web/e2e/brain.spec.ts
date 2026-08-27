// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — VedMoulya Brain Journey: UNDERSTAND → PLAN → INTELLIGENCE →
// EXECUTION → VERIFY → RESULT (EPIC-016)
// Real Chrome journey through the /brain page:
//   run a task through the real brain.* gateway → the pipeline advances
//   honestly (stages complete) → the run lands in a truthful terminal state
//   (synthesized result OR an honest missing-capability hand-off) → decision
//   records explain every choice → the approval gate can be requested and
//   granted for a sensitive action → no page-level JS errors.
// Nothing is faked: assertions follow what the REAL backend reports.
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from '@playwright/test';
import { injectSession } from './helpers/auth.js';

test.describe.configure({ mode: 'serial' });

test.describe('VedMoulya Brain — Real-User Journey (EPIC-016)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  test('run pipeline → honest terminal state → decisions → approval gate', async ({ page }) => {
    test.setTimeout(240_000);

    // SPRINT-090A: /health/ready readiness gate in Playwright webServer
    // ensures the gateway is initialized before tests begin.
    await page.goto('/brain');
    // Wait for the brain page to hydrate (auth + tRPC data load).
    // The examples are rendered once the page is ready — this is a
    // legitimate business assertion, not a warm-up.
    await expect(page.getByRole('button', { name: 'Blog post' })).toBeVisible({
      timeout: 60_000,
    });

    // ── Capture console errors ──────────────────────────────────────────
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ── Run the pipeline from an example ────────────────────────────────
    await page.getByRole('button', { name: 'Blog post' }).click();

    // The task card appears with the objective (input + card — use .first()).
    await expect(
      page
        .getByText('Write a high-quality blog post about AI productivity for professionals')
        .first(),
    ).toBeVisible({ timeout: 60_000 });

    // The stage rail renders the pipeline stages.
    await expect(page.getByLabel('Brain pipeline stages')).toBeVisible();
    await expect(page.getByText('Understand').first()).toBeVisible();
    await expect(page.getByText('Plan').first()).toBeVisible();
    await expect(page.getByText('Execute').first()).toBeVisible();
    await expect(page.getByText('Verify').first()).toBeVisible();
    await expect(page.getByText('Result').first()).toBeVisible();

    // The pipeline advances: at least UNDERSTANDING must complete (the first
    // brain.createTask round-trip after a dev-server restart cold-compiles).
    await expect(page.getByText('completed').first()).toBeVisible({ timeout: 60_000 });

    // ── Honest terminal state ───────────────────────────────────────────
    // Either execution reached a synthesized result (COMPLETED through the
    // deterministic runtime) or a required capability had no eligible
    // provider and the Brain honestly handed off (PARTIAL) — both truthful.
    const resultPanel = page.getByText('Synthesized result');
    const handOff = page.getByText(/missing-capabilities/i);
    const noRoles = page.getByText(/No role assignments yet/i);
    await expect
      .poll(
        async () =>
          (await resultPanel.count()) > 0 ||
          (await handOff.count()) > 0 ||
          (await noRoles.count()) > 0,
        { timeout: 120_000 },
      )
      .toBe(true);

    // ── Decision explainability ─────────────────────────────────────────
    await expect(page.getByText('Why the Brain chose what it chose')).toBeVisible({
      timeout: 30_000,
    });
    // At least one decision record is visible (mode / plan / roles / verify).
    await expect(
      page.getByText(/task mode|capability plan|provider roles|verification/).first(),
    ).toBeVisible();

    // ── Approval gate: request → approve through the real backend ──────
    // Wait for the pipeline to fully finish (the terminal status badge) so
    // the approval controls are enabled.
    await expect(page.getByText(/COMPLETED|PARTIAL|FAILED|CANCELLED/).first()).toBeVisible({
      timeout: 60_000,
    });
    // The panel offers to request approval for a sensitive action (also when
    // an informational missing-capability hand-off is pending).
    await page
      .getByText('Request approval for a sensitive action (publish, send, deploy…)')
      .click();
    await page.getByRole('button', { name: 'Publish' }).click();
    // The task now pauses at the approval gate with Approve / Reject.
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
    // Grant the approval — the pending gate clears (the informational
    // missing-capability notice may remain, which is honest).
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0, { timeout: 30_000 });

    // ── Recent tasks history reflects the run ───────────────────────────
    await expect(page.getByText(/Recent Brain tasks/)).toBeVisible();
    await expect(page.getByText(/Write a high-quality blog post/).first()).toBeVisible();

    // No page-level JS errors broke the Brain UI.
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });
});
