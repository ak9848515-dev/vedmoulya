// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge Journey (EPIC-017)
// Real Chrome journey through the /live-intelligence page:
//   enter a meaningful task → the Bridge understands it through the Brain →
//   discovers capability candidates (with evidence) → compares current vs
//   better for THIS task (structured reasons, never chain-of-thought) → if a
//   materially better option exists it is offered and pauses for explicit user
//   approval → hand off to execution → outcome evaluated → task-specific
//   performance feedback recorded. No UI stubbing — every assertion follows
//   what the REAL liveIntelligence.* gateway reports. When the environment has
//   no materially better option (nothing fabricated), the honest
//   "No materially better option requires activation" state is asserted and
//   the loop still proceeds to the execution hand-off.
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from '@playwright/test';
import { injectSession } from './helpers/auth.js';

test.describe.configure({ mode: 'serial' });

test.describe('Live Intelligence Bridge — Real-User Journey (EPIC-017)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  test('task → understand → discover → compare → (approve if better) → hand-off → evaluate → feedback', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ── Open the Bridge ──────────────────────────────────────────────────
    await page.goto('/live-intelligence');
    await expect(page.getByRole('heading', { name: 'Live Intelligence Bridge' })).toBeVisible({
      timeout: 60_000,
    });

    // ── Create a meaningful task from an example ─────────────────────────
    await page.getByRole('button', { name: 'Blog post' }).click();

    // The loop card appears with the objective + the stage rail.
    await expect(
      page
        .getByText('Write a high-quality blog post about AI productivity for professionals')
        .first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Understand').first()).toBeVisible();
    await expect(page.getByText('Discover').first()).toBeVisible();
    await expect(page.getByText('Compare').first()).toBeVisible();
    await expect(page.getByText('Recommend').first()).toBeVisible();

    // ── Understand + Discover + Compare advance through the real gateway ─
    // The pipeline advances automatically (start → discover → compare →
    // recommend); the first round-trip after a dev-server restart cold-compiles.
    await expect(page.getByText('Capability candidates').first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText('Current vs better — for THIS task').first()).toBeVisible({
      timeout: 60_000,
    });

    // Evidence is rendered on the real registry candidates (never fabricated).
    await expect(page.getByText(/Evidence: Registry provider/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // ── Recommendation branch (honest): either a materially better option is
    //    offered (approval required) or the environment honestly reports none.
    const approvalButton = page.getByText(/Approve & Configure|Use recommended/).first();
    const noBetter = page.getByText(/No materially better option requires activation/).first();
    await expect
      .poll(async () => (await approvalButton.count()) > 0 || (await noBetter.count()) > 0, {
        timeout: 60_000,
      })
      .toBe(true);

    if ((await approvalButton.count()) > 0) {
      // The paid/alternative option pauses for EXPLICIT approval.
      await expect(page.getByText('Explicit approval required').first()).toBeVisible({
        timeout: 30_000,
      });
      await approvalButton.click();
      await expect(
        page.getByText(/Approved — continuing with the best available option/).first(),
      ).toBeVisible({
        timeout: 30_000,
      });
    }

    // ── Hand off to execution (Continue → Hand off to execution) ─────────
    await page.getByRole('button', { name: /Hand off to execution/ }).click();

    // ── Honest terminal state ────────────────────────────────────────────
    // The deterministic execution hand-off either completes (outcome +
    // feedback rendered) or honestly pauses at a configuration/manual/
    // approval boundary (CONFIGURING / PARTIAL) — never fabricated success.
    const outcome = page.getByText('Outcome evaluation').first();
    const handoffCard = page.getByRole('heading', { name: 'Hand-off' }).first();
    await expect
      .poll(async () => (await outcome.count()) > 0 || (await handoffCard.count()) > 0, {
        timeout: 120_000,
      })
      .toBe(true);

    // ── Feedback (task-specific performance) when the loop completed ─────
    if ((await outcome.count()) > 0) {
      await expect(page.getByText('Task-specific performance').first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(/COMPLETED|PARTIAL/).first()).toBeVisible({ timeout: 30_000 });
    }

    // ── Recent loops history reflects the run ────────────────────────────
    await expect(page.getByText('Recent Bridge loops')).toBeVisible();
    await expect(page.getByText(/Write a high-quality blog post/).first()).toBeVisible();

    // No page-level JS errors broke the Bridge UI.
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });
});
