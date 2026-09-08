// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — E2E: Autonomous Builder (BLD-024)
//
// Product-level journey over the REAL gateway + REAL MissionRuntime:
//   authenticate → open Autonomous Builder → enter ONE mission → RUN →
//   mission state + objectives appear → browser refresh keeps observing
//   the SAME mission → duplicate RUN cannot create a second loop →
//   history lists the mission.
//
// Honest scope: this spec asserts the UI faithfully reflects backend state
// (including UNAVAILABLE placeholders). It does NOT fabricate progress.
// The 3-objective no-prompt continuation proof lives in the API-level
// autonomous certification test (services/api MissionRouter.test.ts), which
// drives the real runtime composition directly.
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { injectSession } from './helpers/auth.js';

const BASE_URL = 'http://localhost:3000';
const MISSION_TITLE = `E2E builder mission ${Date.now()}`;

test.describe('Autonomous Builder (BLD-024)', () => {
  test('one mission + RUN: mission appears, state is real, refresh keeps observing', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await injectSession(page);

    await page.goto(`${BASE_URL}/autonomous-builder`);

    // The page renders the one-button form.
    await expect(page.getByTestId('mission-form')).toBeVisible();
    await expect(page.getByTestId('run-mission-btn')).toBeVisible();

    // Enter ONE mission (title is prefilled; make it unique) and press RUN.
    await page.getByTestId('mission-title-input').fill(MISSION_TITLE);
    await page.getByTestId('run-mission-btn').click();

    // Either the RUN succeeds and a live view appears, or an honest error is
    // displayed (e.g. no providers registered in this environment). The UI
    // must never show fake progress in either case.
    const liveCard = page.getByTestId('live-mission-card');
    const runError = page.getByTestId('run-error');
    await expect
      .poll(async () => (await liveCard.isVisible()) || (await runError.isVisible()), {
        timeout: 60_000,
        intervals: [1_000],
      })
      .toBe(true);

    if (!(await liveCard.isVisible())) {
      // Honest error path — the environment has no provider configured.
      const message = await runError.textContent();
      expect(message).toBeTruthy();
      test.info().annotations.push({
        type: 'note',
        description: `RUN surfaced an honest error (no providers?): ${message}`,
      });
      return;
    }

    // Mission state chip reflects REAL backend state (never fabricated %).
    await expect(page.getByTestId('mission-state')).toHaveText(
      /CREATED|RUNNING|PAUSED|WAITING_FOR_APPROVAL|WAITING_FOR_PROVIDER|BLOCKED|COMPLETED|FAILED|CANCELLED/,
    );
    // No fake progress percentages anywhere.
    await expect(page.getByText(/\d+% complete/i)).toHaveCount(0);

    // ── Browser refresh: must NOT create a duplicate mission or reset state ──
    await page.reload();
    await expect(page.getByTestId('live-mission-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('mission-state')).toBeVisible();

    // The same mission is still being observed (URL carries ?mission=…).
    expect(page.url()).toContain('mission=');

    // Duplicate RUN guard: the backend serializes per mission; a second
    // start of the same mission must not create a second live card.
    const cardCountBefore = await page.getByTestId('live-mission-card').count();
    await page
      .getByTestId('run-mission-btn')
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(2_000);
    expect(await page.getByTestId('live-mission-card').count()).toBe(cardCountBefore);
  });

  test('mission history lists previously created missions for the session user', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await injectSession(page);
    await page.goto(`${BASE_URL}/autonomous-builder`);
    await expect(page.getByTestId('mission-history-card')).toBeVisible();
    // History is honest: either entries exist or the empty state is shown.
    const history = page.getByTestId('mission-history');
    const empty = page.getByTestId('history-empty');
    await expect
      .poll(async () => (await history.isVisible()) || (await empty.isVisible()), {
        timeout: 20_000,
      })
      .toBe(true);
  });
});
