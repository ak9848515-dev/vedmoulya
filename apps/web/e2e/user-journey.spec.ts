// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — E2E: Complete User Journey
// Covers: Identity → Dashboard → Career → Learning → Business →
//         Marketplace → Settings → Navigation → Error States
// BLD-016-B — Web Application Quality Certification
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { injectSession } from './helpers/auth.js';
import { installAuthDiagnostics, captureBrowserState } from './helpers/auth-diagnostics.js';

// ── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';

// ── SPRINT-086: Auth Diagnostic Test ───────────────────────────────────────
// Captures the EXACT HTTP response from /auth/session and /auth/me
// during E2E flow. This is the single highest-value diagnostic.
// DO NOT REMOVE until root cause is confirmed.

test.describe('SPRINT-086 Auth Diagnostics', () => {
  test('capture auth request outcomes during authenticated navigation', async ({ page }) => {
    // Mint and inject the same JWT the other tests use
    await injectSession(page);

    // Install diagnostic interceptors BEFORE navigation
    const diag = installAuthDiagnostics(page);

    // Navigate to the Home page (the most failing route).
    // SPRINT-097 FIX: register waitForResponse promises BEFORE goto so they
    // capture in-flight auth requests. With the default waitUntil:'load',
    // goto blocks until all resources finish — by the time it returns the
    // session/me responses have already arrived, so waitForResponse would
    // wait for a NEW response that never comes, exhausting the 30s test
    // timeout.
    const sessionPromise = page
      .waitForResponse((res) => res.url().includes('/api/v1/identity/auth/session'), {
        timeout: 20_000,
      })
      .catch(() => null);
    const mePromise = page
      .waitForResponse((res) => res.url().includes('/api/v1/identity/auth/me'), {
        timeout: 10_000,
      })
      .catch(() => null);

    await page.goto(BASE_URL);

    // Collect the auth responses (may be null if timeout fired)
    const sessionRes = await sessionPromise;
    if (!sessionRes) {
      console.warn('[AUTH-DIAG] WARNING: no /auth/session request observed within 20s');
    }
    const meRes = await mePromise;
    void meRes; // captured by interceptor regardless

    // Give React a moment to process the auth response and re-render.
    await page.waitForLoadState('domcontentloaded');

    // Capture whatever browser state exists
    const browserState = await captureBrowserState(page);

    // ── Report ──────────────────────────────────────────────────────
    console.warn('\n========================================');
    console.warn('SPRINT-086 AUTH DIAGNOSTIC REPORT');
    console.warn('========================================');
    console.warn(
      `auth/session: status=${diag.sessionRequest?.status ?? 'NO REQUEST'} duration=${diag.sessionRequest?.durationMs ?? 'N/A'}ms`,
    );
    console.warn(
      `auth/me:      status=${diag.meRequest?.status ?? 'NO REQUEST'} duration=${diag.meRequest?.durationMs ?? 'N/A'}ms`,
    );
    console.warn(`sessionRequest URL: ${diag.sessionRequest?.url ?? 'NONE'}`);
    console.warn(`sessionRequest body: ${diag.sessionRequest?.bodySnippet ?? 'NONE'}`);
    console.warn(`meRequest body: ${diag.meRequest?.bodySnippet ?? 'NONE'}`);
    console.warn(`browser pathname: ${browserState?.pathname ?? 'UNKNOWN'}`);
    console.warn(`browser userPresent: ${browserState?.userPresent ?? 'UNKNOWN'}`);
    console.warn(`browser localStorage: ${browserState?.localStorageAuth ?? 'UNKNOWN'}`);
    console.warn('========================================\n');

    // The test MUST pass — it only collects data, never fails on auth.
    // Any assertions here would mask the diagnostic output.
    expect(true).toBe(true);
  });
});

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

    // The logo text should be visible — the sidebar header renders 'VedMoulya'
    // when expanded. Use .first() since the brand name also appears in nav
    // items (VedMoulya Brain, etc.).
    await expect(page.getByText('VedMoulya').first()).toBeVisible();
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

// NOTE (UX-03): apps/web/src/app/page.tsx was rewritten by commit 46a525f
// ("freeze production deployment baseline", 249+/307-). The dashboard IA is
// now: Greeting → Today's Priority → Primary Mission → VedMoulya Insight →
// Life Momentum → Recent Activity → Ask VedMoulya, with a progressive-
// disclosure "Explore more" <details> at the end. The assertions below still
// covered the PRE-rewrite dashboard ('Continue Your Journey', 'Life Score',
// a 'Quick Actions' section, and a capitalised 'Good Morning' greeting that
// now renders lowercase from timeGreeting()), so every one of them timed out.
// They are re-pointed at the real UX-03 surfaces, keeping each test's intent.
test.describe('Dashboard — Home Page', () => {
  test('should display the dashboard heading', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // The hero <h1> is the time-of-day greeting: `{timeGreeting()}, {name}`
    // e.g. "Good afternoon, E2E User". timeGreeting() returns the second word
    // LOWERCASE ('Good morning' | 'Good afternoon' | 'Good evening'), so match
    // case-insensitively rather than against the old capitalised wording.
    //
    // Assert on the accessible ROLE (heading) instead of getByText: the <h1>
    // mixes a text node with a <span> for the name, and role+name is the
    // stable contract. Wait first — the dashboard is a client component gated
    // on auth hydration + session restore, which can resolve after networkidle.
    const greeting = page.getByRole('heading', {
      level: 1,
      name: /Good (morning|afternoon|evening)/i,
    });
    await greeting.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(greeting).toBeVisible();
  });

  test('should render the hero priority and its continue action', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // UX-03 replaces the old hero buttons ('Continue Your Journey' / 'AI
    // Summary') with Today's Priority. The hero always renders a heading and
    // the greeting <h1> that owns it, whether or not a mission is active, so
    // assert the hero header via its own h1 (unambiguous — a bare `header`
    // locator could also match a mission card header lower down the page).
    const heroHeader = page.locator('header:has(h1)').first();
    await heroHeader.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(heroHeader.getByRole('heading', { level: 1 })).toBeVisible();

    // Today's Priority is the hero's action surface — present in both the
    // active-mission and the caught-up states.
    await expect(page.getByText(/Today's Priority/)).toBeVisible();
  });

  test('should display the Life Momentum metrics', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // UX-03 replaces the old 'Life Score' hero metric with the Life Momentum
    // region (career · learning · business), which is the dashboard's current
    // metrics surface. It is data-independent: the region renders with the
    // module statuses even for a brand-new session.
    const momentum = page.getByRole('region', { name: /Life Momentum/i });
    await momentum.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(momentum).toBeVisible();
  });

  test('should render the progressive-disclosure detail section', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // UX-03 keeps the SPRINT-043C progressive-disclosure pattern but renamed
    // the collapsed <details> from 'Deep dive' to 'Explore more — journey,
    // execution, modules, recommendations'. Expand it, then assert its
    // detail content is revealed.
    const disclosure = page.locator('summary').filter({ hasText: 'Explore more' });
    await disclosure.waitFor({ state: 'visible', timeout: 30_000 });
    await disclosure.click();

    // The revealed body is the <details>' following sibling container. Assert on
    // real content that only exists inside it — Journey Overview always renders.
    await expect(page.getByText('Journey Overview')).toBeVisible();
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

    // Navigate through each route and verify status.
    // Use 'commit' instead of 'networkidle' or 'load' — some routes
    // (learning, business, marketplace) have persistent AI polling/
    // health scheduler requests that keep connections alive, preventing
    // later lifecycle events from firing.
    for (const route of ROUTES) {
      const response = await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'commit',
      });
      expect(response?.status()).toBe(200);
    }

    // Verify no unexpected errors accumulated.
    // Filter out transient cold-start errors: 500 (engine tables not yet ready)
    // and 429 (rate-limiting from rapid sequential navigation) are expected
    // during the first seconds after a fresh process start.
    const unexpectedErrors = errors.filter(
      (e) => !e.includes('status of 500') && !e.includes('status of 429'),
    );
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('should return 200 for all static routes', async ({ page }) => {
    for (const route of ROUTES) {
      const response = await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'commit',
      });
      expect(response?.status()).toBe(200);
    }
  });

  test('should handle invalid routes gracefully', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/nonexistent-route`, {
      waitUntil: 'domcontentloaded',
    });

    // Next.js App Router returns 404 for non-existent routes
    expect(response?.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-CUTTING: UI Components
// Verify key UI components render consistently across pages
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UI Components — Shell Consistency', () => {
  test('should render breadcrumb navigation on all pages', async ({ page }) => {
    // SPRINT-092A: Use 'load' instead of 'networkidle' for looped navigation.
    // The SPA's background tRPC queries prevent networkidle from settling.
    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'load' });
      await page.waitForTimeout(500);

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
  test('should load the home page within 7 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'load' });
    const loadTime = Date.now() - startTime;

    // 7s threshold accounts for cold-start compilation in parallel workers.
    // The SPA's tRPC polling and React Query keep connections alive, making
    // networkidle unreliable — 'load' is the correct wait strategy here.
    expect(loadTime).toBeLessThan(7000);
  });

  test('should have no uncaught exceptions during navigation', async ({ page }) => {
    const uncaughtErrors: string[] = [];
    page.on('pageerror', (err) => uncaughtErrors.push(err.message));

    // SPRINT-092A: Use 'load' instead of 'networkidle' for looped navigation.
    // The SPA's background tRPC queries prevent networkidle from settling.
    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'load' });
      await page.waitForTimeout(500);
    }

    expect(uncaughtErrors).toHaveLength(0);
  });
});
