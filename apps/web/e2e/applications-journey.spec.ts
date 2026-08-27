// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — E2E: Application Factory Real-User Journey (EPIC-008 Phase 19/20)
// A real authenticated user opens /applications and actually builds an
// ABAP Debugger Assistant through the real factory.* API:
//   login (real JWT session) → create → review plan → approve → build →
//   inspect files → diff → tests → deploy locally
// The UI renders ONLY persisted factory data (real EPIC-006/007 engine state)
// — nothing is faked or stubbed at the UI layer. The gateway runs in dev with
// the deterministic MockProvider (NODE_ENV !== production) and, on a
// Docker-less machine, the documented in-memory repository (the hermetic test
// double — production always uses Postgres).
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { injectSession } from './helpers/auth.js';
import { createAndBuildAbap, openDirectFactory } from './helpers/factory-journey.js';

test.describe('Application Factory — Real-User Journey (EPIC-008)', () => {
  // The journey tests share ONE dev-server gateway (single in-memory registry
  // + MockProvider). They must run in order — never in parallel — so test 1
  // (create → build → deploy) cannot race test 2 (QUALITY) or test 3 (reload +
  // reopen from the persisted list) over the same application registry.
  test.describe.configure({ mode: 'serial' });

  // ── Real auth (BLD-016C convention): every test runs authenticated ────────
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  test('login → create ABAP debugger → approve → build → files → deploy', async ({ page }) => {
    test.setTimeout(240_000);

    // SPRINT-090A: /health/ready readiness gate in Playwright webServer
    // ensures the gateway is initialized before tests begin.

    // ── Capture console errors ──────────────────────────────────────────
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ── 1. Build the deterministic ABAP acceptance application through the
    //        real factory (create → approve → build → READY). ───────────────
    await createAndBuildAbap(page);

    // Real validation results are attached (Tests tab shows the persisted
    // validation report — not a mock).
    await page.getByRole('button', { name: 'Tests', exact: true }).click();
    await expect(page.getByText(/Build validation — overall/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('PASS').first()).toBeVisible();

    // ── 5. Inspect the generated files (Phase 7 file explorer) ──────────────
    await page.getByRole('button', { name: 'Files', exact: true }).click();
    await expect(page.getByText(/^Files \(\d+\)$/)).toBeVisible({ timeout: 60_000 });

    // Deterministic generator output: build manifest + entry point + tests.
    await page.getByRole('button', { name: /package\.json/ }).click();
    await expect(page.locator('pre')).toContainText('scripts', { timeout: 10_000 });

    await page.getByRole('button', { name: /src\/index\.ts/ }).click();
    await expect(page.locator('pre')).toContainText('export', { timeout: 10_000 });

    // ── 6. Every AI change is explainable in the Diff tab (Phase 8) ────────
    await page.getByRole('button', { name: 'Diff', exact: true }).click();
    await expect(page.getByText(/Change review \(\d+\)/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/via /).first()).toBeVisible();

    // ── 6b. Preview (Phase 13): the real generated UI renders in a sandboxed
    // iframe (sandbox="allow-scripts", no same-origin, inline CSP) and is
    // genuinely interactive — not a placeholder.
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const previewFrame = page.frameLocator('iframe[title*="preview"]');
    await expect(
      previewFrame.getByRole('heading', { name: 'ABAP Debugger Assistant' }),
    ).toBeVisible({
      timeout: 60_000,
    });

    // Interact with the generated app inside the sandbox: paste ABAP source,
    // analyze it, read the real diagnosis from the bundled logic.
    await previewFrame.locator('textarea').fill('ASSIGN lv_ref.');
    await previewFrame.getByRole('button', { name: 'Analyze', exact: true }).click();
    await expect(previewFrame.getByText(/Suspicious statements/)).toBeVisible({ timeout: 15_000 });
    await expect(previewFrame.getByText(/IS ASSIGNED/)).toBeVisible({ timeout: 15_000 });

    // Device toggle (desktop / tablet / mobile) re-frames the preview width.
    await page.getByRole('button', { name: 'Mobile', exact: true }).click();
    await expect(page.locator('div[style*="375px"] iframe')).toBeVisible();
    await page.getByRole('button', { name: 'Desktop', exact: true }).click();

    // ── 7. Explicit deployment authorization (Phase 16 — never silent) ─────
    await page.getByRole('button', { name: 'Deployment', exact: true }).click();
    await expect(page.getByText(/Deployment \(explicit authorization required\)/)).toBeVisible();
    await page.getByRole('button', { name: /Deploy locally \(authorize\)/ }).click();
    await expect(page.getByText(/Deployed locally/)).toBeVisible({ timeout: 60_000 });

    // ── 8. No raw stack traces / console errors during the whole journey ───
    expect(consoleErrors).toHaveLength(0);
  });

  test('QUALITY tab end-to-end: quality center → targeted refinement → diff → validation (EPIC-010)', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    // SPRINT-090A: /health/ready readiness gate in Playwright webServer
    // ensures the gateway is initialized before tests begin.

    // ── Capture console errors ──────────────────────────────────────────
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ── 1. Build the same deterministic ABAP application as the other
    //        journeys (create → approve → build → READY). ──────────────────
    await createAndBuildAbap(page);

    // ── 2. Open the QUALITY center (EPIC-010 Phase 15). The real persisted
    //        evaluation renders: overall verdict, 10 dimensions, critic
    //        findings with evidence classes — never faked. ──────────────────
    await page.getByRole('button', { name: 'Quality', exact: true }).click();
    await expect(page.getByText(/Application quality center/)).toBeVisible({ timeout: 60_000 });
    // The deterministic critic finds the primary-color token mismatch in the
    // generated UI (the template hardcodes #2b5fd9 while the ABAP design
    // system declares #1D4ED8) plus accessibility-audit findings — all
    // auto-fixable MEDIUM findings. Evidence classes are rendered.
    await expect(page.getByText(/Critic findings \(\d+\)/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('CONFIRMED').first()).toBeVisible();
    // The overall verdict + score card is real (deterministic QualityEvaluator).
    await expect(page.getByText(/overall score/)).toBeVisible();

    // ── 3. Trigger a TARGETED refinement (Phase 12/13): clicking "Fix
    //        automatically" on an auto-fixable finding must produce a change-
    //        impact PLAN — never silently apply files. The ABAP findings are
    //        MEDIUM, so this exercises the no-approval path (the plan still
    //        renders the affected file + untouched guarantee; CRITICAL/HIGH
    //        plans additionally demand approval before applying). ───────────
    await page.getByRole('button', { name: 'Fix automatically' }).first().click();
    await expect(page.getByText(/Targeted refinement \(change impact\)/)).toBeVisible({
      timeout: 60_000,
    });
    // The deterministic planner maps the finding area (consistency) to the
    // owning file — src/ui/app.ts — and preserves everything else.
    await expect(page.getByText(/src\/ui\/app\.ts/).first()).toBeVisible();
    await expect(page.getByText(/Untouched: \d+ file\(s\) preserved\./)).toBeVisible();

    // ── 4. Verify the DIFF (Phase 8 change review): every generated file
    //        operation is persisted with kind · status · path · originating
    //        task — real factory engine evidence. ───────────────────────────
    await page.getByRole('button', { name: 'Diff', exact: true }).click();
    await expect(page.getByText(/Change review \(\d+\)/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/via /).first()).toBeVisible();
    await expect(page.getByText(/applied/).first()).toBeVisible();

    // ── 5. Re-run VALIDATION evidence (Phase 23/25): the Tests tab shows the
    //        persisted validation report — the refinement plan above did NOT
    //        mutate files (approval-gated plan only), so the application is
    //        still READY with a passing build validation. ───────────────────
    await page.getByRole('button', { name: 'Tests', exact: true }).click();
    await expect(page.getByText(/Build validation — overall/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('PASS').first()).toBeVisible();

    // ── 6. No raw stack traces / console errors during the whole journey ───
    expect(consoleErrors).toHaveLength(0);
  });

  test('applications persist across reload (EPIC-008 Phase 1)', async ({ page }) => {
    test.setTimeout(120_000);

    // Build a DRAFT ABAP project (create + plan only — never built).
    await openDirectFactory(page);
    await page.getByRole('button', { name: /Create application project/ }).click();
    // Workspace opens on Overview; the plan (and its approval gate) is in the
    // Plan tab. `factory.create` persists the project owner-scoped.
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(page.getByRole('button', { name: /Approve plan & build/ })).toBeVisible({
      timeout: 120_000,
    });

    // Full page reload — the application project must survive (owner-scoped
    // persistence through the gateway registry, not component state). After
    // reload the workspace re-opens from the persisted project: the StartPanel
    // lists it via factory.list, clicking it restores the workspace, and the
    // Plan tab still shows the plan + approval gate.
    await page.reload({ waitUntil: 'domcontentloaded' });
    // SPRINT-093: The factory page gates its heading on auth hydration
    // (hydrated + sessionReady). In the full parallel suite, the auth
    // store's restoreSession() fetch can take longer — wait for the
    // heading instead of a fixed timeout.
    await expect(page.getByRole('heading', { name: 'Application Factory' })).toBeVisible({
      timeout: 120_000,
    });
    // The mode toggle resets to Product Intelligence on reload — the persisted
    // applications live in the Direct Factory StartPanel.
    await page.getByRole('button', { name: /Direct Factory/ }).click();
    await expect(page.getByRole('heading', { name: 'Your applications' })).toBeVisible({
      timeout: 120_000,
    });
    // Open the persisted project from the list. The list rows are the buttons
    // that contain a status chip (e.g. "DRAFT") — the example cards never do.
    // ORDER-COUPLING (serial suite): tests 1–2 built their apps to READY/
    // DEPLOYED, so THIS test's freshly created DRAFT project is the only
    // DRAFT in the shared registry — first() is deterministic. Keep earlier
    // tests building to READY; if a future test leaves a DRAFT app before
    // this one, scope the selector to this project's name instead.
    const statusChip = page.locator('span', { hasText: /^DRAFT$/ }).first();
    await statusChip.click();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(page.getByRole('button', { name: /Approve plan & build/ })).toBeVisible({
      timeout: 120_000,
    });
  });
});
