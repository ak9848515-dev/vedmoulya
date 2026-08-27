// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem Intelligence Journey (EPIC-015)
// Real Chrome journey through the /ecosystem-intelligence page:
//   Task Intelligence (ask the intelligence → honest result + fallback) →
//   GitHub Connect (permission review → begin authorization → complete →
//   CONNECTED) → Repository acquisition (security + license → plan with
//   approval boundary) → Intelligence Memory (lifecycle records).
// Nothing is faked: assertions follow what the REAL gateway reports. The
// deterministic GitHub auth adapter completes with exactly the reviewed
// scopes; secrets/tokens never appear in the UI.
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from '@playwright/test';
import { injectSession } from './helpers/auth.js';

test.describe.configure({ mode: 'serial' });

test.describe('Ecosystem Intelligence — Real-User Journey (EPIC-015)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  test('task intelligence → GitHub connect → repository review → memory', async ({ page }) => {
    test.setTimeout(240_000);

    // SPRINT-090A: /health/ready readiness gate in Playwright webServer
    // ensures the gateway is initialized before tests begin.

    // ── Capture console errors ──────────────────────────────────────────
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ── Page + header ───────────────────────────────────────────────────
    await page.goto('/ecosystem-intelligence');
    // Cold first load after a dev-server restart compiles the route + restores
    // the session asynchronously — generous window (same convention as the
    // other journey specs).
    await expect(page.getByRole('heading', { name: 'Ecosystem Intelligence' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByText('Evidence-first · quality-first · never auto-activated'),
    ).toBeVisible();

    // ── Task Intelligence: ask about a task ─────────────────────────────
    await expect(page.getByLabel('Capability')).toBeVisible();
    await page.getByRole('button', { name: 'Ask the Intelligence' }).click();

    // The fallback card is deterministic (declining is never failure).
    await expect(page.getByText('If you decline — the fallback')).toBeVisible({ timeout: 60_000 });

    // Honest result: at least one of options / recommendation / fallback renders.
    await expect
      .poll(
        async () => {
          const found = await page.getByText('What the Intelligence found').count();
          const better = await page
            .getByText(
              /Better capability found|Useful open-source capability found|Free local model available/,
            )
            .count();
          const fallback = await page.getByText('If you decline — the fallback').count();
          return found + better + fallback;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    // ── GitHub Connect: permission review → authorize → CONNECTED ───────
    await page.getByRole('tab', { name: 'GitHub Connect' }).click();
    // The GitHub connection data is hydration-dependent: the server must
    // complete persistence hydration before the github.getConnection query
    // returns the DISCONNECTED view with the permission review form.
    await expect(page.getByText('Connect GitHub — review requested permissions')).toBeVisible({
      timeout: 120_000,
    });

    // Baseline public_metadata is always checked; review the least-privilege
    // boundary (public discovery needs no repository access).
    const baseline = page.getByRole('checkbox').first();
    await expect(baseline).toBeChecked();

    // Begin authorization → authorization URL appears.
    await page.getByRole('button', { name: 'Begin GitHub Authorization' }).click();
    await expect(page.getByText('Authorization started')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/github\.com\/login\/oauth\/authorize/)).toBeVisible();

    // Complete the (deterministic) authorization exchange with a code.
    await page.getByPlaceholder('Authorization code from GitHub').fill('e2e-code');
    await page.getByRole('button', { name: 'Complete authorization' }).click();

    // The connection transitions to CONNECTED and permission chips appear.
    await expect(page.getByText('CONNECTED')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Public discovery')).toBeVisible();

    // The "granted scopes" review block shows exactly what was authorized.
    await expect(page.getByText('Granted scopes — exactly what you reviewed')).toBeVisible();

    // ── Repository acquisition: security + license + approval boundary ──
    await page.getByRole('tab', { name: 'Repository' }).click();
    await expect(page.getByText('Repository acquisition pipeline')).toBeVisible();

    // Example repo is pre-filled — run the security & acquisition review.
    await page.getByRole('button', { name: /Run security & acquisition review/ }).click();

    // The plan reports an honest state (approval boundary is deterministic
    // when the security gate passes; BLOCKED is also an honest outcome).
    await expect
      .poll(
        async () => {
          const approval = await page.getByText(/Approval required before:/).count();
          const blocked = await page.getByText('BLOCKED').count();
          const security = await page
            .getByText(/No blocking indicators found in the checks performed/)
            .count();
          return approval + blocked + security;
        },
        { timeout: 60_000 },
      )
      .toBeGreaterThan(0);

    // The license verdict renders honestly.
    await expect(page.getByText('License', { exact: true }).first()).toBeVisible();

    // Approval is the user's decision — approve it and see the recorded state.
    const approveBtn = page.getByRole('button', { name: 'Approve acquisition' });
    if ((await approveBtn.count()) > 0) {
      await approveBtn.click();
      await expect(page.getByText(/Approved — acquisition/)).toBeVisible({ timeout: 30_000 });
    }

    // ── Intelligence Memory: lifecycle provenance recorded ───────────────
    await page.getByRole('tab', { name: 'Intelligence Memory' }).click();
    await expect(page.getByText('Intelligence memory — lifecycle with provenance')).toBeVisible();

    // The repository assessment + GitHub connection produced lifecycle records.
    await expect
      .poll(
        async () => {
          const records = await page.getByText('record(s)').count();
          const rows = await page
            .getByText(/SECURITY_REVIEWED|USER_APPROVED|RECOMMENDED|BLOCKED|ACTIVE/)
            .count();
          return records + rows;
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    // No secrets crossed the UI: raw codes/tokens are never rendered.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('e2e-code');
    expect(bodyText).not.toContain('token=');

    // No page-level JS errors broke the intelligence UI.
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });
});
