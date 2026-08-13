// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — E2E Shared Factory Journey Helpers
// Used by the EPIC-008 applications journey and the EPIC-011 visual
// validation spec. Both build the SAME deterministic ABAP application through
// the real factory.* API (MockProvider in dev), so the shared server-side
// application registry is exercised consistently and the specs must run
// serially (never in parallel) against one dev server.
// ─────────────────────────────────────────────────────────────────────────────

import { expect, type Page } from '@playwright/test';

export const BASE_URL = 'http://localhost:3000';

/** The acceptance examples exposed by the Direct Factory StartPanel (page.tsx
 *  EXAMPLES) — each maps to a deterministic factory archetype and its real
 *  generated UI title (src/ui/app.ts uiTitle in packages/app-factory). */
export interface FactoryExample {
  /** The example-card label to click in the StartPanel (exact text). */
  label: string;
  /** The generated UI <h1> title that must render inside the preview. */
  uiTitle: string;
  /** The deterministic factory archetype the goal maps to. */
  archetype: string;
}

export const FACTORY_EXAMPLES: Record<'abap' | 'restaurant' | 'ai-app', FactoryExample> = {
  abap: {
    label: 'ABAP Debugger Assistant',
    uiTitle: 'ABAP Debugger Assistant',
    archetype: 'abap-debugger',
  },
  restaurant: {
    label: 'Modern Restaurant App',
    uiTitle: 'Restaurant App',
    archetype: 'restaurant-app',
  },
  'ai-app': {
    label: 'AI Application Builder',
    uiTitle: 'AI App Builder',
    archetype: 'ai-app-builder',
  },
};

/** Open /applications and toggle to the Direct Factory StartPanel. The page
 *  defaults to the EPIC-009 Product Intelligence builder (Phase 28), so the
 *  acceptance examples live one click behind the Direct Factory toggle. */
export async function openDirectFactory(page: Page, example?: FactoryExample): Promise<void> {
  await page.goto(`${BASE_URL}/applications`, { waitUntil: 'domcontentloaded' });
  // Cold `next dev` compiles the identity + tRPC + factory routes on first
  // request, and the startup session-restore fetch must complete before the
  // page renders — generous wait, especially on a slow machine.
  await expect(page.getByRole('heading', { name: 'Application Factory' })).toBeVisible({
    timeout: 120_000,
  });
  await page.getByRole('button', { name: /Direct Factory/ }).click();
  // Seed the goal with an acceptance application (Phase 19). ABAP is the
  // default for backward compatibility with the EPIC-008 journey spec.
  // Playwright string `name` matching is case-insensitive substring — no
  // dynamic RegExp constructor needed (labels are fixed internal constants).
  await page.getByRole('button', { name: example?.label ?? FACTORY_EXAMPLES.abap.label }).click();
}

/** Drive create → approve → build → READY for a StartPanel example through
 *  the real factory.* API (deterministic MockProvider). */
export async function createAndBuildExample(page: Page, example: FactoryExample): Promise<void> {
  await openDirectFactory(page, example);
  await page.getByRole('button', { name: /Create application project/ }).click();
  // The workspace opens on the Overview tab; the approval gate lives in the
  // Plan tab. `factory.create` already ran UNDERSTAND → SPECIFY → ARCHITECT
  // → PLAN through the real runtime (first request also compiles the
  // gateway bundle — generous wait on a slow machine).
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.getByRole('button', { name: /Approve plan & build/ })).toBeVisible({
    timeout: 120_000,
  });
  // The plan preview must expose the real goal-derived requirements.
  await expect(page.getByText(/Plan preview ready/)).toBeVisible();
  await page.getByRole('button', { name: /Approve plan & build/ }).click();
  await expect(page.getByText(/Plan approved/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByRole('button', { name: /Start build \(requires approved plan\)/ }).click();
  // The workspace polls the real factory status until READY. The
  // deterministic build completes in seconds once the bundle is warm; keep
  // the ceiling generous for the cold-compile first run.
  await expect(page.getByText('READY', { exact: true }).first()).toBeVisible({
    timeout: 180_000,
  });
}

/** Drive create → approve → build → READY for the ABAP acceptance app
 *  through the real factory.* API (deterministic MockProvider). */
export async function createAndBuildAbap(page: Page): Promise<void> {
  await createAndBuildExample(page, FACTORY_EXAMPLES.abap);
}
