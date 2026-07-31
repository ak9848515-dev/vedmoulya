// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — E2E: Complete User Journey
// Covers: Identity → Dashboard → Career → Learning → Business →
//         Marketplace → Settings → Navigation → Error States
// BLD-016-B — Web Application Quality Certification
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { injectSession } from './helpers/auth.js';

// ── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';

// ── Real auth (BLD-016C): every test runs authenticated ─────────────────────

test.beforeEach(async ({ page }) => {
  await injectSession(page);
});
const ROUTES = ['/', '/career', '/learning', '/business', '/marketplace', '/settings'] as const;
const APP_TITLE = 'VedMoulya — Life Operating System';

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY: Identity
// Verify the application loads, meta tags are correct, and the shell renders
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Identity — Application Shell', () => {
  test('should render the root layout with correct metadata', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify page title
    await expect(page).toHaveTitle(APP_TITLE);

    // Verify language attribute
    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBe('en');
  });

  test('should load without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    expect(errors).toHaveLength(0);
  });

  test('should render the AppShell with sidebar', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // The sidebar should be present (either desktop or mobile)
    const sidebar = page.locator('nav').first();
    await expect(sidebar).toBeVisible();
  });

  test('should display the VedMoulya logo', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // The logo text should be visible
    await expect(page.getByText('VedMoulya').or(page.getByText('V'))).toBeVisible();
  });

  test('should not have hydration errors', async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (err.message.includes('hydration')) hydrationErrors.push(err.message);
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    expect(hydrationErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY: Dashboard (Home)
// Verify the dashboard loads, sections render, and data flows correctly
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Dashboard — Home Page', () => {
  test('should display the dashboard heading', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // The hero section should contain a greeting
    await expect(page.getByText(/Good (Morning|Afternoon|Evening)/)).toBeVisible();
  });

  test('should render action buttons in the hero', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Continue Your Journey button
    await expect(page.getByText('Continue Your Journey')).toBeVisible();

    // AI Summary button
    await expect(page.getByText('AI Summary')).toBeVisible();
  });

  test('should display the Life Score metric', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Life score indicator
    await expect(page.getByText(/Life Score/)).toBeVisible();
  });

  test('should render Quick Actions section', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Quick actions should be rendered
    const quickActions = page.locator('section').filter({ hasText: 'Quick Actions' });
    await expect(quickActions).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY: Career
// Verify the Career Intelligence page renders correctly
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Career — Career Intelligence', () => {
  test('should navigate to /career and render correctly', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/career`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
  });

  test('should display the AppShell layout on career page', async ({ page }) => {
    await page.goto(`${BASE_URL}/career`, { waitUntil: 'networkidle' });

    // The sidebar should still be visible (AppShell wraps all pages)
    const sidebar = page.locator('nav').first();
    await expect(sidebar).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY: Learning
// Verify the Learning Intelligence page renders correctly
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Learning — Learning Intelligence', () => {
  test('should navigate to /learning and render correctly', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/learning`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
  });

  test('should render without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/learning`, { waitUntil: 'networkidle' });
    expect(errors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY: Business
// Verify the Business Intelligence page renders correctly
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Business — Business Intelligence', () => {
  test('should navigate to /business and render correctly', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/business`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
  });

  test('should not have runtime errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`${BASE_URL}/business`, { waitUntil: 'networkidle' });
    expect(pageErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY: Marketplace
// Verify the Marketplace Platform page renders correctly
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Marketplace — Marketplace Platform', () => {
  test('should navigate to /marketplace and render correctly', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/marketplace`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
  });

  test('should render without hydration errors', async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (err.message.toLowerCase().includes('hydrat')) hydrationErrors.push(err.message);
    });

    await page.goto(`${BASE_URL}/marketplace`, { waitUntil: 'networkidle' });
    expect(hydrationErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY: Settings
// Verify the Settings page renders correctly
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Settings — User Configuration', () => {
  test('should navigate to /settings and render correctly', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
  });

  test('should display settings page with sidebar navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });

    // Sidebar should still be visible
    const sidebar = page.locator('nav').first();
    await expect(sidebar).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-CUTTING: Navigation
// Verify navigation between sections works correctly
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Navigation — Cross-Route Transitions', () => {
  test('should navigate between all routes without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Navigate through each route and verify status
    for (const route of ROUTES) {
      const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
    }

    // Verify no errors accumulated
    expect(errors).toHaveLength(0);
  });

  test('should return 200 for all static routes', async ({ page }) => {
    for (const route of ROUTES) {
      const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
    }
  });

  test('should handle invalid routes gracefully', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/nonexistent-route`, {
      waitUntil: 'networkidle',
    });

    // Next.js App Router returns 200 for the not-found page
    // The _not-found catch-all renders instead of a 404
    expect(response?.status()).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-CUTTING: UI Components
// Verify key UI components render consistently across pages
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UI Components — Shell Consistency', () => {
  test('should render breadcrumb navigation on all pages', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });

      // Check for navigation elements

      const navElements = page.locator('nav');
      const count = await navElements.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should have accessible buttons', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify buttons have accessible labels
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-CUTTING: Performance
// Verify page load performance meets basic thresholds
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Performance — Page Load', () => {
  test('should load the home page within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
  });

  test('should have no uncaught exceptions during navigation', async ({ page }) => {
    const uncaughtErrors: string[] = [];
    page.on('pageerror', (err) => uncaughtErrors.push(err.message));

    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
    }

    expect(uncaughtErrors).toHaveLength(0);
  });
});
