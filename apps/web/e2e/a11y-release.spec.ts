import { expect, test } from '@playwright/test';

const routes = ['/', '/career', '/learning', '/business', '/marketplace', '/settings'];

test.describe('Accessibility release gate', () => {
  for (const route of routes) {
    test(`${route} has accessible structure`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem(
          'vedmoulya-auth',
          JSON.stringify({
            state: {
              accessToken: 'accessibility-test-token',
              refreshToken: 'accessibility-test-refresh-token',
              expiresAt: Date.now() + 3600000,
              user: { userId: 'a11y-user', email: 'a11y@example.test', role: 'user' },
              offline: false,
              sessionReady: true,
            },
            version: 0,
          }),
        );
      });
      await page.goto(route);
      await expect(page.locator('h1, h2, h3').first()).toBeAttached();
      await expect(page.locator('main, [role="main"]').first()).toBeAttached();
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
