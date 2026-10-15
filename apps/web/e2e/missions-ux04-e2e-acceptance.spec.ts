// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Sprint 022: Goal → Mission Journey Browser Acceptance
//
// Runs against the REAL locally-running application with the repository's
// existing Playwright configuration and auth fixture (no parallel framework,
// no mocked API responses). Every assertion reads production UI rendered from
// the real backend MissionStatusView; nothing is stubbed.
//
// Scenarios (per Sprint 022 brief):
//   1. Goal entry            — a user can enter a meaningful goal.
//   2. Explicit consent      — entering a goal does not auto-create a Mission.
//   3. Opt-in launch         — the user explicitly chooses to start the Mission.
//   4. Progress              — the UI shows real Mission status via polling.
//   5. Results and evidence  — terminal results distinguish verified from
//                              unverified and expose available evidence.
//   6. Failure and recovery  — terminal/interrupted states are represented
//                              honestly and continuation uses the governed path.
//   7. Safety                — no consequential action without authorization.
//
// These tests share ONE dev-server gateway (single in-memory mission registry),
// so they run serially, and a mission created in an earlier test is observed
// (never re-created) in later tests.
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { injectSession } from './helpers/auth.js';
import { BASE_URL } from './helpers/factory-journey.js';

const KNOWN_STATE =
  /^(CREATED|RUNNING|PAUSED|WAITING_FOR_APPROVAL|WAITING_FOR_PROVIDER|BLOCKED|COMPLETED|FAILED|CANCELLED)$/;

test.describe('Goal → Mission Journey Acceptance (Sprint 022)', () => {
  test.describe.configure({ mode: 'serial' });

  /** The mission created by scenario 1–3, observed (not re-created) later. */
  let missionId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  test('1–3. Goal entry stays inert until the user explicitly opts in to launch', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`${BASE_URL}/autonomous-builder`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Autonomous Builder' })).toBeVisible({
      timeout: 120_000,
    });

    // ── Scenario 1: enter a meaningful goal ────────────────────────────────
    const stamp = Date.now();
    await page.getByTestId('mission-title-input').fill(`Acceptance goal ${stamp}`);
    await page
      .getByTestId('mission-objective-input')
      .fill(`Verify that every workspace package declares a valid package manifest. Run ${stamp}.`);
    await page.getByTestId('mission-budget-input').fill('1');
    await expect(page.getByTestId('mission-title-input')).toHaveValue(`Acceptance goal ${stamp}`);

    // ── Scenario 2: consent — NO mission exists yet ────────────────────────
    // Entering a goal must not create or launch anything: no mission id in the
    // URL and no mission detail surface rendered.
    expect(page.url()).not.toContain('mission=');
    await expect(page.getByTestId('mission-detail-tabs')).toHaveCount(0);
    await expect(page.getByText('Mission created')).toHaveCount(0);

    // ── Scenario 3: opt-in launch ──────────────────────────────────────────
    await page.getByTestId('run-mission-btn').click();
    await expect(page.getByTestId('mission-detail-tabs')).toBeVisible({ timeout: 120_000 });
    await expect(page).toHaveURL(/[?&]mission=/);
    const id = new URL(page.url()).searchParams.get('mission');
    expect(id, 'the launched mission must have a real backend id').toBeTruthy();
    missionId = id;

    // The state chip reads a real backend state (never fabricated).
    await expect(page.getByTestId('mission-state')).toHaveText(KNOWN_STATE, { timeout: 60_000 });
    expect(pageErrors).toHaveLength(0);
  });

  test('4. Progress reflects real backend status through the existing polling path', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    expect(missionId, 'scenario 1–3 must have created a mission').toBeTruthy();

    await page.goto(`${BASE_URL}/autonomous-builder?mission=${missionId}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId('mission-detail-tabs')).toBeVisible({ timeout: 120_000 });

    const state = page.getByTestId('mission-state');
    await expect(state).toBeVisible({ timeout: 60_000 });
    // The status chip is driven by the real MissionStatusView query; assert the
    // displayed state is one of the backend's own states.
    await expect(state).toHaveText(KNOWN_STATE);

    // The live view renders the real objective timeline and fact grid; a state
    // that is not yet terminal must say so honestly rather than fabricate a %.
    await expect(
      page.getByTestId('live-mission-view').getByRole('heading', { name: 'Objective timeline' }),
    ).toBeVisible();
    await expect(page.getByTestId('mission-facts')).toBeVisible();
    await expect(page.getByText(/%\s*(complete|done)/i)).toHaveCount(0);
  });

  test('5–6. Terminal result distinguishes verified/unverified and recovery is honest', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    expect(missionId, 'scenario 1–3 must have created a mission').toBeTruthy();

    await page.goto(`${BASE_URL}/autonomous-builder?mission=${missionId}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId('mission-detail-tabs')).toBeVisible({ timeout: 120_000 });

    // ── Scenario 6: cancellation is an explicit, confirmed governed action ──
    const cancel = page.getByTestId('cancel-btn');
    if (await cancel.isVisible()) {
      await cancel.click();
      // The control requires explicit confirmation — no one-click consequential
      // action without authorization.
      await expect(page.getByTestId('cancel-confirm-btn')).toBeVisible();
      await page.getByTestId('cancel-confirm-btn').click();
      await expect(page.getByTestId('mission-state')).toHaveText(/CANCELLED/, { timeout: 60_000 });
    }

    // ── Scenario 6: the terminal state is represented honestly ─────────────
    const stateText = (await page.getByTestId('mission-state').innerText()).trim();
    expect(['COMPLETED', 'FAILED', 'CANCELLED']).toContain(stateText);
    // The continuation affordance uses the existing governed path (Ask
    // VedMoulya), never a hidden second executor.
    await expect(page.getByTestId('overview-continue-panel')).toBeVisible();

    // ── Scenario 5: results distinguish verified vs unverified ─────────────
    await page.getByRole('tab', { name: 'Result' }).click();
    await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible();
    // A cancelled mission is reported as Cancelled — never mislabelled Failed
    // (only asserted when this run genuinely cancelled the mission).
    if (stateText === 'CANCELLED') {
      await expect(page.getByText('Mission Cancelled')).toBeVisible();
      await expect(page.getByText('Mission Failed')).toHaveCount(0);
    }
    // The verification summary is always rendered and honest about the count.
    await expect(page.getByText(/\d+\/\d+ objectives verified/).first()).toBeVisible();
    // Every objective is labelled Verified or Not yet verified — no ambiguous
    // "done" claim.
    const labels = page.locator('[data-testid^="objective-result-label-"]');
    const labelCount = await labels.count();
    if (labelCount > 0) {
      for (let i = 0; i < labelCount; i++) {
        await expect(labels.nth(i)).toHaveText(/^(Verified|Not yet verified)$/);
      }
    }
  });

  test('7. Safety — no consequential submission without a verified objective', async ({ page }) => {
    test.setTimeout(120_000);
    expect(missionId, 'scenario 1–3 must have created a mission').toBeTruthy();

    await page.goto(`${BASE_URL}/autonomous-builder?mission=${missionId}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId('mission-detail-tabs')).toBeVisible({ timeout: 120_000 });

    // The "Ready to submit" external-delivery surface is gated on at least one
    // VERIFIED objective. Without one, there is no submit control at all.
    const hasVerified = (await page.getByText(/verified/).count()) > 0;
    const delivery = page.getByTestId('revenue-delivery');
    if (await delivery.isVisible().catch(() => false)) {
      // If it IS present, it must be because a real objective was verified and
      // it must state that a human still submits externally.
      expect(hasVerified).toBeTruthy();
      await expect(page.getByText(/human still submits externally/i)).toBeVisible();
    } else {
      await expect(delivery).toHaveCount(0);
    }
    // No external submission/deployment control exists on this surface.
    await expect(
      page.getByRole('button', { name: /deploy|submit externally|publish/i }),
    ).toHaveCount(0);
  });
});
