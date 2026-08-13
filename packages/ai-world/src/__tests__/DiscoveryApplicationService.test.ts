// ──────────────────────────────────────────────────────────────────
// VedMoulya — DiscoveryApplicationService tests
// EPIC-012C — the aiWorld.* contract (§8/§10/§9/§14)
//
// Verifies: the AI WORLD bell view (important / recommended / github /
// updates sections + unread badge), the concise digest, owner-scoped
// read/action state, the refresh-interval rate limit (bounded daily
// evolution), caching via the store, and ownership isolation.
// Uses deterministic fixtures — no live external services.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { DiscoveryApplicationService } from '../application/DiscoveryApplicationService.js';
import { InMemoryDiscoveryStore } from '../infrastructure/InMemoryDiscoveryStore.js';
import { StaticCatalogDiscoverySource } from '../infrastructure/StaticCatalogDiscoverySource.js';
import { DEFAULT_DISCOVERY_BUDGET } from '../types/discovery-types.js';
import type { DiscoveryBudget } from '../types/discovery-types.js';
import { fixedNow } from './fixtures.js';

function appService(
  budget?: Partial<DiscoveryBudget>,
  autoSeed = true,
): DiscoveryApplicationService {
  return new DiscoveryApplicationService({
    sources: [new StaticCatalogDiscoverySource()],
    store: new InMemoryDiscoveryStore(),
    budget: { ...DEFAULT_DISCOVERY_BUDGET, minRefreshIntervalMs: 0, ...budget },
    now: fixedNow,
    autoSeed,
  });
}

describe('DiscoveryApplicationService — the AI World bell view (§8)', () => {
  it('builds the world sections from the curated catalog (notification generation)', async () => {
    const svc = appService();
    const { world } = await svc.getWorld('u1');

    expect(world.generatedAt).toBe(fixedNow().toISOString());
    // 🔥 Important: the configurable OpenRouter provider leads.
    const importantTitles = world.important.map((i) => i.title);
    expect(importantTitles).toContain('OpenRouter — model aggregator with free variants');
    expect(world.important.some((i) => i.recommendation === 'CONFIGURE')).toBe(true);
    // ⭐ Recommended: medium-relevance items worth attention.
    expect(world.recommended.length).toBeGreaterThan(0);
    // 🧩 GitHub projects.
    expect(world.github.length).toBeGreaterThanOrEqual(2);
    // Unread badge counts every retained item for a fresh user.
    expect(world.unreadCount).toBeGreaterThan(0);
  });

  it('high-relevance actionable items are NOT drowned out by volume', async () => {
    const svc = appService();
    const { world } = await svc.getWorld('u1');
    // Only CONFIGURE/INTEGRATE/TRY + high-relevance items make the
    // "important" section — quality over volume.
    for (const item of world.important) {
      expect(['CONFIGURE', 'INTEGRATE', 'TRY']).toContain(item.recommendation);
      expect(item.relevanceLabel).toBe('high');
    }
  });
});

describe('DiscoveryApplicationService — digest (§10)', () => {
  it('produces a concise digest with no IGNORE items and honest summaries', async () => {
    const svc = appService();
    const digest = await svc.getDigest('u1');
    expect(digest.date).toBe('2026-08-10');
    expect(digest.entries.length).toBeGreaterThan(0);
    expect(digest.entries.length).toBeLessThanOrEqual(5);
    for (const entry of digest.entries) {
      expect(entry.item.recommendation).not.toBe('IGNORE');
      expect(entry.why.length).toBeGreaterThan(0);
    }
  });
});

describe('DiscoveryApplicationService — owner-scoped actions (§14)', () => {
  it('markRead reduces the unread badge for that owner only', async () => {
    const svc = appService();
    const before = await svc.getWorld('u1');
    const target = before.world.important[0];
    expect(target).toBeDefined();
    await svc.markRead('u1', target.id);

    const after = await svc.getWorld('u1');
    expect(after.world.unreadCount).toBe(before.world.unreadCount - 1);
    // A different owner's badge is unchanged.
    const other = await svc.getWorld('u2');
    expect(other.world.unreadCount).toBe(before.world.unreadCount);
  });

  it('dismissing an item hides it from that owner only (ownership isolation)', async () => {
    const svc = appService();
    const target = (await svc.getWorld('u1')).world.important[0];
    await svc.setAction('u1', target.id, 'dismissed');

    const forU1 = await svc.getWorld('u1');
    expect(forU1.world.important.map((i) => i.id)).not.toContain(target.id);
    // User B still sees it (never a shared read surface).
    const forU2 = await svc.getWorld('u2');
    expect(forU2.world.important.map((i) => i.id)).toContain(target.id);
  });

  it('list returns per-user views with read/action state; getItem is owner-scoped', async () => {
    const svc = appService();
    const views = await svc.listItems('u1');
    expect(views.length).toBeGreaterThan(0);
    expect(views[0]).toMatchObject({ read: false, action: 'none' });
    const detail = await svc.getItem('u1', views[0].item.id);
    expect(detail?.item.id).toBe(views[0].item.id);
    expect(await svc.getItem('u1', 'does-not-exist')).toBeUndefined();
  });

  it('watching an item marks it without hiding it', async () => {
    const svc = appService();
    const target = (await svc.getWorld('u1')).world.important[0];
    await svc.setAction('u1', target.id, 'watching');
    const views = await svc.listItems('u1');
    const watched = views.find((v) => v.item.id === target.id);
    expect(watched?.action).toBe('watching');
  });
});

describe('DiscoveryApplicationService — bounded refresh & rate limiting (§9)', () => {
  it('seeds the store from sources on first access (autoSeed, bounded run)', async () => {
    const svc = appService();
    const { world, lastRunAt } = await svc.getWorld('u1');
    expect(world.unreadCount).toBeGreaterThan(0);
    expect(lastRunAt).toBeTruthy();
  });

  it('runDiscovery respects the refresh interval — a second run within the window is skipped', async () => {
    const svc = appService(
      { minRefreshIntervalMs: DEFAULT_DISCOVERY_BUDGET.minRefreshIntervalMs },
      false,
    );
    const first = await svc.runDiscovery();
    expect(first.totalAdded).toBeGreaterThan(0);
    // Immediately after, the refresh interval has not elapsed → rate-limited.
    const second = await svc.runDiscovery();
    expect(second.sources).toEqual([]);
    expect(second.totalAdded).toBe(0);
  });

  it('runDiscovery after the interval re-runs and skips known duplicates (caching)', async () => {
    const svc = appService({ minRefreshIntervalMs: 0 }, false);
    await svc.runDiscovery();
    const again = await svc.runDiscovery();
    expect(again.totalAdded).toBe(0);
    const totalSkipped = again.sources.reduce((sum, s) => sum + s.duplicatesSkipped, 0);
    expect(totalSkipped).toBeGreaterThan(0);
  });

  it('exposes when the next refresh becomes available', async () => {
    const svc = appService({ minRefreshIntervalMs: 60_000 }, false);
    await svc.runDiscovery();
    const { runAvailableAt } = await svc.getWorld('u1');
    expect(runAvailableAt).toBeTruthy();
    expect(Date.parse(runAvailableAt as string)).toBeGreaterThan(fixedNow().getTime());
  });
});
