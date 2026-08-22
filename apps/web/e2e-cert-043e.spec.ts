// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-043E Phase A: Real-Browser Experience Certification
// Real Chrome journey over the LIVE local runtime (Postgres + Redis + Next
// gateway on :3000). Exercises the REAL signup/login flows (no JWT minting),
// the Dashboard, Command Center List↔Radar toggle, Opportunity Radar,
// Digital Twin FORMING→POPULATED (D1 regression), evidence entry, responsive
// and reduced-motion behaviour. Console/page errors are captured throughout.
//
// NOT part of `npm run test:e2e` (testDir=./e2e): CI runs without Postgres.
// Run explicitly against a live stack:
//   cd apps/web && npx playwright test e2e-cert-043e.spec.ts --workers=1
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://localhost:3000';

interface JourneyErrors {
  consoleErrors: string[];
  pageErrors: string[];
}

/** Capture console + page errors for the whole page lifetime. */
function watchErrors(page: Page): JourneyErrors {
  const errors: JourneyErrors = { consoleErrors: [], pageErrors: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.pageErrors.push(String(err));
  });
  return errors;
}

/**
 * Wait until the Next.js app has hydrated on the current page. Under `next
 * dev` the server-rendered HTML is interactive only after React hydration;
 * clicking a submit button before the form's onSubmit handler is attached
 * silently does nothing (no POST). `window.next.router` exists only after
 * hydration — a deterministic barrier that works on every route.
 */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { next?: { router?: unknown } };
      return w.next?.router !== null && w.next?.router !== undefined;
    },
    undefined,
    { timeout: 30_000 },
  );
}

/**
 * Fill a label-matched input and VERIFY the value stuck. Under `next dev` the
 * React app hydrates after domcontentloaded; filling before hydration can be
 * wiped when the controlled input re-renders. Retrying until the value sticks
 * (or timeout) makes the journey robust without changing app behaviour.
 */
async function fillSticky(page: Page, label: string, value: string): Promise<void> {
  const input = page.getByLabel(label, { exact: true });
  for (let attempt = 0; attempt < 20; attempt++) {
    await input.fill(value);
    const current = await input.inputValue().catch(() => '');
    if (current === value) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`fill did not stick for label "${label}"`);
}

/** A clearly-marked LOCAL TEST account; timestamped to avoid duplicate email. */
function localTestUser(): { email: string; password: string; displayName: string } {
  const stamp = Date.now().toString(36);
  return {
    displayName: `E2E Cert ${stamp}`,
    email: `e2e-cert-043e-${stamp}@local.test`,
    password: 'CertPass123!',
  };
}

test.describe('SPRINT-043E real-browser certification', () => {
  test('full founder journey: signup → onboarding → dashboard → command center → radar → twin → evidence → logout/login → mobile → reduced-motion', async ({
    browser,
  }) => {
    // ── Fresh context: no session, mobile-capable default desktop viewport ──
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = watchErrors(page);

    const user = localTestUser();

    // ── 1. Open the application unauthenticated → protected redirect ───────
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    // Unauthenticated users must NOT see the dashboard — they land on /login
    // (SignInRedirect) with a next back-reference.
    await expect(page).toHaveURL(/\/login(\?next=.*)?$/, { timeout: 20000 });

    // ── 2. Signup (real UI form, real identity service) ────────────────────
    await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);
    await fillSticky(page, 'Display Name', user.displayName);
    await fillSticky(page, 'Email', user.email);
    await fillSticky(page, 'Password', user.password);
    await fillSticky(page, 'Confirm Password', user.password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // ── 3. First authenticated screen → onboarding gate (profileComplete=false)
    // The OnboardingRedirect gate must send the fresh user to /onboarding/profile.
    await expect(page).toHaveURL(/\/onboarding\/profile/, { timeout: 30000 });
    await waitForHydration(page);
    await expect(page.getByText('Complete your profile')).toBeVisible({ timeout: 20000 });

    // ── 4. Complete the profile (server-authoritative) ─────────────────────
    await page.getByLabel('Age', { exact: true }).fill('34');
    await page.getByLabel('Gender', { exact: true }).selectOption('male');
    await page.getByLabel('Purpose', { exact: true }).selectOption('business');
    await page
      .getByLabel('Primary Goal', { exact: true })
      .fill('Certify the founder evidence loop locally.');
    await page.getByRole('button', { name: 'Save profile' }).click();

    // Lands on the destination (default '/') — the dashboard.
    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 30000 });
    await waitForHydration(page);
    // Dashboard is real: wait for the authenticated shell to settle.
    await page.waitForLoadState('domcontentloaded');

    // ── 5. Open the AI Companion → Founder Command Center ──────────────────
    await page.getByRole('button', { name: 'Open AI Companion' }).click();
    await expect(page.getByRole('button', { name: 'Founder command center' })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: 'Founder command center' }).click();

    // Command Center tabs (Today/Portfolio/Intelligence/Automation/Approvals)
    const commandCenter = page.getByRole('tablist', { name: 'Command center sections' });
    await expect(commandCenter).toBeVisible({ timeout: 15000 });
    await expect(commandCenter.getByRole('tab', { name: 'Intelligence' })).toBeVisible();

    // ── 6. Intelligence tab: Digital Twin + Opportunity Radar ───────────────
    await commandCenter.getByRole('tab', { name: 'Intelligence' }).click();

    // Digital Twin — FORMING for a new user (honest empty state, never a fake
    // populated twin). data-testid="twin-forming" with the forming copy.
    await expect(page.getByTestId('twin-forming')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Your Digital Twin is forming.')).toBeVisible();

    // ── 7. List ↔ Radar toggle (same data, no new fetch) ───────────────────
    const viewGroup = page.getByRole('group', { name: 'Opportunity radar view' });
    await expect(viewGroup).toBeVisible();
    await expect(viewGroup.getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Opportunity Radar — EMPTY for a new user in List mode (never fabricated).
    await expect(page.getByText(/No radar entries yet/)).toBeVisible({ timeout: 20000 });

    await viewGroup.getByRole('button', { name: 'Radar' }).click();
    await expect(viewGroup.getByRole('button', { name: 'Radar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The empty radar still renders (no fabricated nodes), just in spatial mode.
    await expect(page.getByTestId('radar-empty')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Your opportunity field is forming.')).toBeVisible();

    // ── 8. Evidence entry (LOCAL TEST record, clearly marked) ───────────────
    await page.getByRole('button', { name: 'Add Evidence' }).click();
    await expect(page.getByRole('dialog', { name: 'Record founder evidence' })).toBeVisible({
      timeout: 15000,
    });

    // Problem mode (default): a problem REQUIRES evidence — no fabricated facts.
    await page
      .getByLabel('Problem statement')
      .fill('Local clinics reconcile invoices manually and lose hours weekly.');
    await page
      .getByLabel('What is the evidence?')
      .fill(
        'LOCAL TEST: two clinic owners described reconciliation as a weekly time sink during a call.',
      );
    await page.getByRole('button', { name: 'Register problem' }).click();
    await expect(page.getByText(/Problem registered\. Evidence recorded\./)).toBeVisible({
      timeout: 20000,
    });

    // Drawer closes; radar refreshes via the existing onSaved() path.
    await expect(page.getByRole('dialog', { name: 'Record founder evidence' })).toBeHidden({
      timeout: 15000,
    });

    // Radar is now POPULATED — the empty state must be replaced by real nodes.
    await expect(page.getByTestId('radar-empty')).toBeHidden({ timeout: 20000 });
    // The radar SVG is present in spatial mode with its semantic label.
    const radarSvg = page.getByRole('img', { name: /Opportunity radar/ });
    await expect(radarSvg).toBeVisible({ timeout: 15000 });

    // ── 9. Radar node selection (click + detail) ───────────────────────────
    // Every opportunity node is a semantic button with a descriptive label.
    const node = radarSvg.getByRole('button').first();
    await expect(node).toBeVisible({ timeout: 15000 });
    const nodeLabel = await node.getAttribute('aria-label');
    expect(nodeLabel).toBeTruthy();
    await node.click();
    // Selected detail must expose the existing authoritative fields.
    await expect(page.getByText(/reconcile invoices manually/i).first()).toBeVisible({
      timeout: 15000,
    });

    // ── 10. Digital Twin FORMING → POPULATED (D1 regression) ────────────────
    // The twin started FORMING (empty dimensions); after evidence arrives the
    // SAME component must transition to POPULATED without a rules-of-hooks
    // crash ("Rendered more hooks..."). The forming marker disappears and the
    // dimension rings render.
    await expect(page.getByTestId('twin-forming')).toBeHidden({ timeout: 20000 });
    const twinSvg = page.getByRole('img', { name: /Digital Twin/ });
    await expect(twinSvg).toBeVisible({ timeout: 15000 });
    // Dimensions exist as interactive rings.
    await expect(twinSvg.getByRole('button').first()).toBeVisible({ timeout: 15000 });

    // ── 11. Keyboard selection (a11y: selection must not require hover) ─────
    await node.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/reconcile invoices manually/i).first()).toBeVisible();

    // ── 12. List fallback remains usable ────────────────────────────────────
    await viewGroup.getByRole('button', { name: 'List' }).click();
    await expect(viewGroup.getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The dense list exposes the opportunity row.
    await expect(page.getByText(/reconcile invoices manually/i).first()).toBeVisible();

    // ── 13. Logout → Login → refresh persistence → protected route ──────────
    // Close the AI Companion drawer first — it overlays the header's sign-out.
    await page.getByRole('button', { name: 'Close AI Companion' }).click();
    await expect(page.getByRole('button', { name: 'Close AI Companion' })).toBeHidden({
      timeout: 10000,
    });
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 });
    await waitForHydration(page);

    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 });

    // Refresh keeps the session.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 });

    // ── 14. Console + page errors across the entire journey ─────────────────
    // Any hydration error, failed chunk, or uncaught exception fails the cert.
    expect(errors.pageErrors, `page errors: ${errors.pageErrors.join(' | ')}`).toEqual([]);
    const fatalConsole = errors.consoleErrors.filter(
      (e) =>
        !e.includes('Download the React DevTools') &&
        !e.includes('favicon') &&
        !e.includes('ERR_CONNECTION') &&
        !e.includes('Failed to load resource') &&
        !e.includes('404'),
    );
    expect(fatalConsole, `console errors: ${fatalConsole.join(' | ')}`).toEqual([]);

    await context.close();
  });

  test('mobile viewport: dashboard + command center + radar remain usable (list fallback)', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = watchErrors(page);
    const user = localTestUser();

    await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);
    await fillSticky(page, 'Display Name', user.displayName);
    await fillSticky(page, 'Email', user.email);
    await fillSticky(page, 'Password', user.password);
    await fillSticky(page, 'Confirm Password', user.password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/onboarding\/profile/, { timeout: 30000 });
    await waitForHydration(page);
    await page.getByLabel('Age', { exact: true }).fill('31');
    await page.getByLabel('Gender', { exact: true }).selectOption('prefer_not_to_say');
    await page.getByLabel('Purpose', { exact: true }).selectOption('personal');
    await page.getByLabel('Primary Goal', { exact: true }).fill('Verify the mobile experience.');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 30000 });
    await waitForHydration(page);

    // No horizontal overflow on the dashboard (document.scrollingElement).
    const overflowX = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflowX).toBeLessThanOrEqual(0);

    // Command Center reachable on mobile; list fallback works in a small viewport.
    await page.getByRole('button', { name: 'Open AI Companion' }).click();
    await page.getByRole('button', { name: 'Founder command center' }).click();
    const commandCenter = page.getByRole('tablist', { name: 'Command center sections' });
    await expect(commandCenter).toBeVisible({ timeout: 15000 });
    await commandCenter.getByRole('tab', { name: 'Intelligence' }).click();
    await expect(page.getByText(/No radar entries yet/)).toBeVisible({ timeout: 20000 });

    // Mobile must prefer the list (information-dense, touch-friendly) — it is
    // the default view and remains reachable.
    const viewGroup = page.getByRole('group', { name: 'Opportunity radar view' });
    await expect(viewGroup.getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Spatial mode also reachable on mobile with its honest empty state.
    await viewGroup.getByRole('button', { name: 'Radar' }).click();
    await expect(page.getByTestId('radar-empty')).toBeVisible({ timeout: 20000 });
    await viewGroup.getByRole('button', { name: 'List' }).click();

    expect(errors.pageErrors, `page errors: ${errors.pageErrors.join(' | ')}`).toEqual([]);

    await context.close();
  });

  test('protected-route ?next= preservation (SPRINT-043E D1 regression)', async ({ browser }) => {
    // D1: the login page captured ?next= in a mount-time useMemo([]), so the
    // protected-route soft navigation (SignInRedirect → router.replace to
    // /login?next=...) could land the page with the query settling after first
    // render. The stale capture kept next='/' and the user landed on the
    // dashboard after signing in. Verified failing pre-fix; the destination is
    // now resolved at the point of use.
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = watchErrors(page);
    const user = localTestUser();

    // Create + complete the profile.
    await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);
    await fillSticky(page, 'Display Name', user.displayName);
    await fillSticky(page, 'Email', user.email);
    await fillSticky(page, 'Password', user.password);
    await fillSticky(page, 'Confirm Password', user.password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/onboarding\/profile/, { timeout: 30000 });
    await waitForHydration(page);
    await page.getByLabel('Age', { exact: true }).fill('36');
    await page.getByLabel('Gender', { exact: true }).selectOption('prefer_not_to_say');
    await page.getByLabel('Purpose', { exact: true }).selectOption('business');
    await page.getByLabel('Primary Goal', { exact: true }).fill('Verify next param preservation.');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 30000 });
    await waitForHydration(page);

    // Logout, then hit a protected page while logged out → /login?next=...
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 });
    await waitForHydration(page);
    await page.goto(`${BASE}/intelligence`, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);
    await expect(page).toHaveURL(/\/login\?next=/, { timeout: 20000 });

    // Sign in → must land on the PRESERVED destination, not the dashboard.
    await fillSticky(page, 'Email', user.email);
    await fillSticky(page, 'Password', user.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/intelligence/, { timeout: 30000 });

    expect(errors.pageErrors, `page errors: ${errors.pageErrors.join(' | ')}`).toEqual([]);
    await context.close();
  });

  test('reduced motion: radar + twin honour prefers-reduced-motion (no perpetual motion)', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = watchErrors(page);
    const user = localTestUser();

    await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);
    await fillSticky(page, 'Display Name', user.displayName);
    await fillSticky(page, 'Email', user.email);
    await fillSticky(page, 'Password', user.password);
    await fillSticky(page, 'Confirm Password', user.password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/onboarding\/profile/, { timeout: 30000 });
    await waitForHydration(page);
    await page.getByLabel('Age', { exact: true }).fill('29');
    await page.getByLabel('Gender', { exact: true }).selectOption('prefer_not_to_say');
    await page.getByLabel('Purpose', { exact: true }).selectOption('learning');
    await page.getByLabel('Primary Goal', { exact: true }).fill('Verify reduced motion.');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 30000 });
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Open AI Companion' }).click();
    await page.getByRole('button', { name: 'Founder command center' }).click();
    const commandCenter = page.getByRole('tablist', { name: 'Command center sections' });
    await commandCenter.getByRole('tab', { name: 'Intelligence' }).click();

    // Twin + radar still render under reduced motion (no motion dependency).
    await expect(page.getByTestId('twin-forming')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/No radar entries yet/)).toBeVisible({ timeout: 20000 });
    const viewGroup = page.getByRole('group', { name: 'Opportunity radar view' });
    await viewGroup.getByRole('button', { name: 'Radar' }).click();
    await expect(page.getByTestId('radar-empty')).toBeVisible({ timeout: 20000 });

    // The global 043B policy applies: computed transition/animation durations
    // collapse to ~0 under prefers-reduced-motion.
    const reducedMotionApplied = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.transition = 'all 2s ease';
      document.body.appendChild(probe);
      const duration = parseFloat(getComputedStyle(probe).transitionDuration || '0');
      probe.remove();
      return duration < 0.1;
    });
    expect(reducedMotionApplied).toBe(true);

    expect(errors.pageErrors, `page errors: ${errors.pageErrors.join(' | ')}`).toEqual([]);
    await context.close();
  });
});
