import { expect, test } from '@playwright/test';

import { injectSession } from './helpers/auth.js';

const routes = ['/', '/career', '/learning', '/business', '/marketplace', '/settings'];

test.describe('Accessibility release gate', () => {
  for (const route of routes) {
    test(`${route} has accessible structure`, async ({ page }) => {
      // BLD-016C — authenticate with a REAL signed JWT via the shared helper
      // (same contract as a11y.spec). The previously injected static
      // placeholder token was rejected by the identity service seconds into
      // the audit (ERR_JWS_INVALID → 401 → refresh 401 → clearSession), so
      // protected routes unmounted their content via SignInRedirect and
      // re-rendered as the full-screen /login screen — which intentionally
      // renders without the AppShell chrome.
      await injectSession(page);
      await page.goto(route);

      // BLD-016C — wait for the route to settle into its final renderable
      // state. This gate asserts a heading + <main> landmark, and that is also
      // the deterministic signal to wait on:
      //   - Loading skeletons/error/empty states each carry their own heading
      //     (or the /login fallback does), so the web-first assertion retries
      //     until the route's content has actually mounted.
      //   - `waitForLoadState('networkidle')` is unusable here: the dashboard
      //     polls health/cadence endpoints continuously, so the network NEVER
      //     goes idle and the wait consumed the entire test timeout.
      //   - `role="status"` is likewise not a loading signal: the dashboard's
      //     cached-data notice and the offline banner legitimately keep a
      //     role="status" element mounted inside <main>.
      await expect(page.locator('h1, h2, h3').first()).toBeAttached({ timeout: 20_000 });
      await expect(page.locator('main, [role="main"]').first()).toBeAttached();

      // SPRINT-082 — the scans below are instantaneous (no auto-retry), so
      // wait for hydration to settle first: App Router <Link> components
      // briefly render <a> elements without the href attribute during SSR
      // streaming and early hydration. Same deterministic wait the
      // interactive-elements audit in a11y.spec applies before scanning.
      await page.waitForFunction(
        () => document.querySelectorAll('a:not([href])').length === 0,
        undefined,
        { timeout: 5_000 },
      );
      expect(
        await page.locator('button').evaluateAll(
          (buttons) =>
            buttons.filter((button) => {
              const labelled =
                button.getAttribute('aria-label') || button.getAttribute('aria-labelledby');
              return !labelled && !(button.textContent || '').trim();
            }).length,
        ),
      ).toBe(0);
      expect(await page.locator('a[href=""], a:not([href])').count()).toBe(0);
      expect(await page.locator('img:not([alt]):not([role="presentation"])').count()).toBe(0);
    });
  }
});
