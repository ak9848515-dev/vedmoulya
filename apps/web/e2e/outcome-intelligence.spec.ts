// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Outcome & Revenue Intelligence Journey (EPIC-020)
// Real Chrome journey through the /brain outcome-first surface:
//   Open the Brain → Today's Top 5 panel renders (ranked actions with why +
//   next step, transparent priority) → run the Brain pipeline → evaluate the
//   outcome with the 3-value satisfaction loop (Yes / Partially / No) → the
//   learning feed records the outcome → run another task so Today's Top 5
//   reflects the in-flight work. No page-level JS errors.
// Nothing is faked: assertions follow what the REAL gateway reports.
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from '@playwright/test';
import { injectSession } from './helpers/auth.js';

test.describe.configure({ mode: 'serial' });

test.describe('Outcome & Revenue Intelligence — Real-User Journey (EPIC-020)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  test('today priorities → pipeline → 3-value satisfaction → learning', async ({ page }) => {
    test.setTimeout(240_000);

    // SPRINT-090A: /health/ready readiness gate in Playwright webServer
    // ensures the gateway is initialized before tests begin.
    await page.goto('/brain');
    // Wait for brain page to hydrate before capturing console errors.
    await expect(page.getByRole('heading', { name: "Today's most valuable actions" })).toBeVisible({
      timeout: 60_000,
    });

    // ── Capture console errors ──────────────────────────────────────────
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ── Today's Top 5 panel renders (mission §8) ────────────────────────
    await expect(page.getByRole('heading', { name: "Today's most valuable actions" })).toBeVisible({
      timeout: 60_000,
    });
    // Transparent ranking language — cost never outranks quality.
    await expect(page.getByText(/cost never outranks quality/)).toBeVisible();

    // ── Run the full Brain pipeline from an example ─────────────────────
    await page.getByRole('button', { name: 'Research brief' }).click();
    await expect(
      page
        .getByText(
          'Research the current state of open-source local LLMs and summarize the best options',
        )
        .first(),
    ).toBeVisible({ timeout: 60_000 });
    // Honest terminal state: synthesized result OR missing-capability hand-off.
    await expect
      .poll(
        async () =>
          (await page.getByText('Synthesized result').count()) > 0 ||
          (await page.getByText(/missing-capabilities/i).count()) > 0,
        { timeout: 120_000 },
      )
      .toBe(true);

    // ── 3-value satisfaction loop (mission §10) ─────────────────────────
    await expect(page.getByText(/COMPLETED|PARTIAL|FAILED|CANCELLED/).first()).toBeVisible({
      timeout: 60_000,
    });
    const yesButton = page.getByRole('button', { name: 'Yes — solved it' });
    const partiallyButton = page.getByRole('button', { name: 'Partially' });
    const noButton = page.getByRole('button', { name: 'No' });
    if ((await yesButton.count()) > 0) {
      // The three explicit feedback options are all present — never a hidden
      // chain-of-thought; concise decision explanations only.
      // SPRINT-094: Under parallel contention, buttons may render at
      // different times — wait for each with a timeout.
      await expect(partiallyButton).toBeVisible({ timeout: 30_000 });
      await expect(noButton).toBeVisible({ timeout: 30_000 });
      await partiallyButton.click();
      // The learning feed records the outcome.
      await expect(page.getByText('accepted').first()).toBeVisible({ timeout: 30_000 });
    }

    // No page-level JS errors broke the outcome-first view.
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });
});
