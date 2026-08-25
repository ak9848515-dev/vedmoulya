// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Accessibility Audit Tests
// Uses Playwright's built-in accessibility snapshot API for WCAG compliance
// BLD-016-B — Web Application Quality
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { injectSession } from './helpers/auth.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── Real auth (BLD-016C): every test runs authenticated ─────────────────────

test.beforeEach(async ({ page }) => {
  await injectSession(page);
});

const ROUTES = [
  { path: '/', name: 'Home / Dashboard' },
  { path: '/career', name: 'Career' },
  { path: '/learning', name: 'Learning' },
  { path: '/business', name: 'Business' },
  { path: '/marketplace', name: 'Marketplace' },
  { path: '/settings', name: 'Settings' },
];

test.describe('Accessibility: Keyboard Navigation', () => {
  test('skip-to-content link is focusable on home page', async ({ page }) => {
    await page.goto(BASE_URL);
    // Press Tab to focus the skip-to-content link
    await page.keyboard.press('Tab');
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('Tab key navigates through interactive elements', async ({ page }) => {
    await page.goto(BASE_URL);
    // Verify that pressing Tab moves focus forward
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});

test.describe('Accessibility: Page Structure', () => {
  for (const route of ROUTES) {
    test(`${route.name} has a proper heading structure`, async ({ page }) => {
      await page.goto(route.path);

      // SPRINT-088 — wait for the ACTUAL invariants instead of racing
      // networkidle: under load the SPA mounts headings/landmarks after the
      // network goes quiet, so counting immediately was non-deterministic.
      // Web-first assertions bound the wait to the assertion itself.
      await expect(page.locator('h1, h2, h3').first()).toBeAttached();

      // Check that the page has at least one heading
      const headingCount = await page.locator('h1, h2, h3').count();
      expect(headingCount).toBeGreaterThan(0);

      // Check that the page has a <main> or [role="main"] element
      const mainCount = await page.locator('main, [role="main"]').count();
      expect(mainCount).toBeGreaterThan(0);
    });

    test(`${route.name} has no empty or broken interactive elements`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      // SPRINT-082: During SSR streaming and early hydration, Next.js App
      // Router <Link> components may briefly render <a> elements without
      // the href HTML attribute.  Wait for hydration to finish so the DOM
      // reflects the final state before we audit it.
      await page.waitForFunction(
        () => document.querySelectorAll('a:not([href])').length === 0,
        undefined,
        { timeout: 5_000 },
      );

      // SPRINT-088 — accessible-name audit: every button MUST have an
      // accessible name (text content, aria-label or aria-labelledby).
      // The previous heuristic (`:not(:has(> *))`) flagged text-named
      // buttons as "suspicious" while silently SKIPPING icon-only buttons
      // that contain an <svg> child without any label — false positives
      // AND false negatives. This check is exact and stricter: zero
      // unnamed buttons allowed.
      const unnamedButtons = await page.locator('button').evaluateAll(
        (buttons) =>
          buttons.filter((b) => {
            const labelled =
              b.getAttribute('aria-label') !== null || b.getAttribute('aria-labelledby') !== null;
            const text = (b.textContent || '').trim();
            return !labelled && text.length === 0;
          }).length,
      );
      expect(unnamedButtons).toBe(0);

      // Check for links with empty or missing href
      const brokenLinks = await page.locator('a[href=""], a:not([href])').count();
      expect(brokenLinks).toBe(0);

      // Check for images without alt text
      const missingAlt = await page.locator('img:not([alt]):not([role="presentation"])').count();
      expect(missingAlt).toBe(0);
    });
  }
});

test.describe('Accessibility: Focus Management', () => {
  test('no focus trap on home page', async ({ page }) => {
    await page.goto(BASE_URL);
    // Tab through many elements to ensure focus doesn't get stuck
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
    }
    // We just verify no crash — focus should move through elements
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeAttached();
  });
});

test.describe('Accessibility: Reduced Motion', () => {
  test('prefers-reduced-motion does not break layout', async ({ page }) => {
    // Emulate prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Verify the page renders correctly
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
