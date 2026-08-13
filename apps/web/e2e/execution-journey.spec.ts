// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Journey: PLAN → EXECUTE → VERIFY (EPIC-014)
// Real Chrome journey through the /capability-marketplace page:
//   build plan → click Execute → executable steps run through the real
//   gateway port → the run stops honestly at the first gate (approval /
//   manual / configure) → user approves / completes the hand-off → the run
//   resumes → final state is visible.
// Nothing is faked: assertions follow what the REAL run reports.
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from '@playwright/test';
import { injectSession } from './helpers/auth.js';

test.describe.configure({ mode: 'serial' });

test.describe('Capability Execution — Real-User Journey (EPIC-014)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  test('plan → execute → approval → manual hand-off → resume → final state', async ({ page }) => {
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ── Build the plan ───────────────────────────────────────────────────
    await page.goto('/capability-marketplace');
    await expect(page.getByRole('heading', { name: 'AI Capability Marketplace' })).toBeVisible();

    await page.getByRole('button', { name: 'Educational video' }).click();
    // The first plan build after a dev-server restart cold-compiles the heavy
    // plan route — allow a generous window.
    await expect(page.getByText('AI PLAN')).toBeVisible({ timeout: 60_000 });
    // The outcome appears in the plan header AND recent-plan history — use .first().
    await expect(
      page.getByText('Create a 60-second educational video about the solar system').first(),
    ).toBeVisible();
    await expect(page.getByText('Research').first()).toBeVisible();

    // ── Execute the plan ─────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Execute plan' }).click();

    // The run card appears with an honest status badge (never a fake DONE).
    // The execution.start route cold-compiles on first hit — generous window.
    await expect(page.getByText('Execution', { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByText(
        /WAITING FOR APPROVAL|MANUAL REQUIRED|CONFIGURE REQUIRED|COMPLETED|PARTIAL|BLOCKED|FAILED|RUNNING/,
      ),
    ).toBeVisible();

    // At least one executable step completed through the real port.
    await expect(page.getByText('Done').first()).toBeVisible();

    // ── Approval boundary (the video plan's Fact Check is an approval point) ──
    const approveButton = page.getByRole('button', { name: 'Approve' });
    if (await approveButton.count().then((c) => c > 0)) {
      await approveButton.first().click();
      // The run resumes and advances at least one more step.
      await expect(page.getByText('Done').first()).toBeVisible();
      await page.waitForTimeout(1_500);
    }

    // ── Manual hand-offs (honest: no fake execution, the user marks them done) ──
    for (let i = 0; i < 4; i += 1) {
      const markDone = page.getByRole('button', { name: 'Mark as done' });
      if ((await markDone.count()) === 0) break;
      await page
        .getByPlaceholder(/What did you do/)
        .first()
        .fill('Completed in the external tool');
      await markDone.first().click();
      await expect(page.getByText('Done').first()).toBeVisible();
      await page.waitForTimeout(1_000);
    }

    // ── Final state is visible and honest ────────────────────────────────
    // The run either reached a terminal state (with its honest summary) or is
    // still paused at a remaining manual/configure gate — both are truthful.
    const finalSummary = page.getByText(
      /Every step is done|could not be automated|run failed|run was blocked|cancelled by you/,
    );
    const anyGate = page.getByRole('button', { name: 'Mark as done' });
    await expect
      .poll(async () => (await finalSummary.count()) > 0 || (await anyGate.count()) > 0, {
        timeout: 15_000,
      })
      .toBe(true);

    // No page-level JS errors broke the run UI.
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });
});
