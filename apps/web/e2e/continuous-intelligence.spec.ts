// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Continuous Intelligence Journey (EPIC-020)
// Real Chrome journey through the /brain operating dashboard:
//   Open the Brain → operating dashboard renders (status hero + Continuous
//   AI World + Opportunities + learning feed) → run Discover (the real
//   brain.discoverIntelligence → AI World bridge) → screened discoveries
//   surface as intelligence events → evidence-backed opportunities appear
//   with uncertainty (never income promises) → acknowledge an opportunity →
//   run the full Brain pipeline → evaluate the outcome → the learning feed
//   records the evidence. No page-level JS errors.
// Nothing is faked: assertions follow what the REAL gateway reports (the
// deterministic curated catalog is the discovery source — no live-service
// claims).
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from '@playwright/test';
import { injectSession } from './helpers/auth.js';

test.describe.configure({ mode: 'serial' });

test.describe('Continuous Intelligence — Real-User Journey (EPIC-020)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  test('operating dashboard → discover → opportunities → pipeline → learning', async ({ page }) => {
    test.setTimeout(240_000);

    // SPRINT-090A: /health/ready readiness gate in Playwright webServer
    // ensures the gateway is initialized before tests begin.
    await page.goto('/brain');
    // Wait for brain page to hydrate before capturing console errors.
    await expect(page.getByRole('heading', { name: 'Continuous AI World' })).toBeVisible({
      timeout: 60_000,
    });

    // ── Capture console errors ──────────────────────────────────────────
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ── Operating dashboard renders (EPIC-020 §13) ──────────────────────
    // Status hero answers "what is VedMoulya doing" with existing telemetry.
    // (The hero's loading label is "Brain Operations"; the loaded hero shows
    // the live status meta instead — assert the stable loaded state.)
    await expect(page.getByRole('heading', { name: 'Continuous AI World' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { name: 'Opportunities' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What VedMoulya learned' })).toBeVisible();
    // The discovery surface is explicit: discovery is never adoption.
    await expect(page.getByText(/Discovery is never adoption/)).toBeVisible();

    // ── Run Discover through the real brain.discoverIntelligence ────────
    await page.getByRole('button', { name: 'Discover' }).click();
    // The screened AI World catalog is surfaced as intelligence events
    // (the deterministic curated catalog: Qwen3, Langfuse, pgvector…).
    await expect(page.getByText(/Qwen3|Langfuse|pgvector|OpenRouter/).first()).toBeVisible({
      timeout: 60_000,
    });

    // Security-tagged chips render (TRUSTED_WITH_REVIEW for reviewed GitHub).
    await expect(page.getByText(/trusted with review/i).first()).toBeVisible();

    // Evidence-backed opportunities appear with explicit uncertainty —
    // an open-source GitHub discovery becomes an automation/productivity
    // opportunity, never an income promise.
    await expect(page.getByText(/Open-source option/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Uncertainty \d+%/).first()).toBeVisible();

    // ── Acknowledge an opportunity (explicit user decision) ─────────────
    // The first opportunity's acknowledge button marks it Noted.
    const firstNoted = page.getByText('Noted');
    const firstAcknowledge = page.locator('button[title="Acknowledge this opportunity"]').first();
    await firstAcknowledge.click();
    await expect(firstNoted.first()).toBeVisible({ timeout: 30_000 });

    // ── Run the full Brain pipeline from an example ─────────────────────
    await page.getByRole('button', { name: 'Blog post' }).click();
    await expect(
      page
        .getByText('Write a high-quality blog post about AI productivity for professionals')
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

    // ── Evaluate the outcome → the learning feed records evidence ───────
    // Terminal status badge → outcome evaluation affordance.
    await expect(page.getByText(/COMPLETED|PARTIAL|FAILED|CANCELLED/).first()).toBeVisible({
      timeout: 60_000,
    });
    const acceptButton = page.getByRole('button', { name: 'Yes — solved it' });
    if (await acceptButton.count()) {
      await acceptButton.click();
      // The learning feed reflects the recorded outcome (accepted).
      await expect(page.getByText('accepted').first()).toBeVisible({ timeout: 30_000 });
    }

    // No page-level JS errors broke the operating view.
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });
});
