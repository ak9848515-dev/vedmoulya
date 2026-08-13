// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: AI World namespace tests
// EPIC-012C — AI World Discovery, Provider Catalog & Market Intelligence
//
// Exercises the aiWorld.* procedures through the REAL tRPC pipeline (auth +
// rate-limit middleware + RouterRegistry handler closures):
//   getWorld     — the bell panel (important / recommended / github / updates +
//                  unread badge)
//   getDigest    — the concise daily digest
//   list/getItem — per-user discovery views
//   markRead / markAllRead — the unread badge lifecycle
//   setAction    — owner-scoped watch/dismiss
//   runDiscovery — bounded refresh respecting the rate-limit interval
// Plus IDOR: a foreign userId must be refused by the gateway guard.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  DiscoveryApplicationService,
  InMemoryDiscoveryStore,
  StaticCatalogDiscoverySource,
} from '@vedmoulya/ai-world';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

// Minimal service object: only the aiWorld service is exercised; other
// namespaces' handlers are lazy closures that never run in this suite.
// The deterministic curated catalog + fixed clock keep the suite hermetic.
const services = {
  aiWorld: new DiscoveryApplicationService({
    sources: [new StaticCatalogDiscoverySource()],
    store: new InMemoryDiscoveryStore(),
    now: () => new Date('2026-08-10T12:00:00Z'),
    autoSeed: true,
  }),
} as unknown as ApiApplicationService;

const router = createAppRouter(services);
const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

describe('aiWorld namespace (EPIC-012C)', () => {
  it('getWorld returns the bell view with sections and an unread badge', async () => {
    const caller = router.createCaller(ctx('aw-1'));
    const result = await caller.aiWorld.getWorld({ userId: 'aw-1' });

    expect(result.success).toBe(true);
    const data = result.data as {
      world: {
        generatedAt: string;
        important: Array<{
          id: string;
          title: string;
          recommendation: string;
          relevanceLabel: string;
        }>;
        recommended: unknown[];
        github: unknown[];
        updates: unknown[];
        unreadCount: number;
      };
      lastRunAt?: string;
      runAvailableAt?: string;
    };
    expect(data.world.generatedAt).toBeTruthy();
    // The configurable OpenRouter provider lands in 🔥 Important with CONFIGURE.
    const openrouter = data.world.important.find((i) => i.title.includes('OpenRouter'));
    expect(openrouter).toBeDefined();
    expect(openrouter?.recommendation).toBe('CONFIGURE');
    expect(openrouter?.relevanceLabel).toBe('high');
    // 🔥 Important only carries actionable, high-relevance items — quality over volume.
    for (const item of data.world.important) {
      expect(['CONFIGURE', 'INTEGRATE', 'TRY']).toContain(item.recommendation);
      expect(item.relevanceLabel).toBe('high');
    }
    // GitHub + recommended sections populate from the curated catalog.
    expect(data.world.github.length).toBeGreaterThanOrEqual(2);
    expect(data.world.recommended.length).toBeGreaterThan(0);
    expect(data.world.unreadCount).toBeGreaterThan(0);
    // The refresh policy exposes when the next run becomes available.
    expect(data.lastRunAt).toBeTruthy();
    expect(data.runAvailableAt).toBeTruthy();
  });

  it('getDigest returns a concise, IGNORE-free digest', async () => {
    const caller = router.createCaller(ctx('aw-2'));
    const result = await caller.aiWorld.getDigest({ userId: 'aw-2' });

    expect(result.success).toBe(true);
    const data = result.data as {
      date: string;
      entries: Array<{ item: { recommendation: string }; why: string }>;
      summary: string;
    };
    expect(data.date).toBe('2026-08-10');
    expect(data.entries.length).toBeGreaterThan(0);
    expect(data.entries.length).toBeLessThanOrEqual(5);
    for (const entry of data.entries) {
      expect(entry.item.recommendation).not.toBe('IGNORE');
      expect(entry.why.length).toBeGreaterThan(0);
    }
  });

  it('list returns owner-scoped views; getItem resolves one by id', async () => {
    const caller = router.createCaller(ctx('aw-3'));
    const listed = await caller.aiWorld.list({ userId: 'aw-3' });
    expect(listed.success).toBe(true);
    const views = listed.data as Array<{ item: { id: string }; read: boolean; action: string }>;
    expect(views.length).toBeGreaterThan(0);
    expect(views[0]).toMatchObject({ read: false, action: 'none' });

    const detail = await caller.aiWorld.getItem({ userId: 'aw-3', itemId: views[0].item.id });
    expect(detail.success).toBe(true);
    expect((detail.data as { item: { id: string } }).item.id).toBe(views[0].item.id);
  });

  it('markRead and markAllRead drive the unread badge', async () => {
    const caller = router.createCaller(ctx('aw-4'));
    const before = (await caller.aiWorld.getWorld({ userId: 'aw-4' })).data as {
      world: { unreadCount: number };
    };
    const target = (
      (await caller.aiWorld.getWorld({ userId: 'aw-4' })).data as {
        world: { important: Array<{ id: string }> };
      }
    ).world.important[0];

    const marked = await caller.aiWorld.markRead({ userId: 'aw-4', itemId: target.id });
    expect(marked.success).toBe(true);
    const afterOne = (await caller.aiWorld.getWorld({ userId: 'aw-4' })).data as {
      world: { unreadCount: number };
    };
    expect(afterOne.world.unreadCount).toBe(before.world.unreadCount - 1);

    const all = await caller.aiWorld.markAllRead({ userId: 'aw-4' });
    expect(all.success).toBe(true);
    const afterAll = (await caller.aiWorld.getWorld({ userId: 'aw-4' })).data as {
      world: { unreadCount: number };
    };
    expect(afterAll.world.unreadCount).toBe(0);
  });

  it('setAction dismisses an item for that owner only', async () => {
    const callerA = router.createCaller(ctx('aw-5'));
    const callerB = router.createCaller(ctx('aw-6'));
    const target = (
      (await callerA.aiWorld.getWorld({ userId: 'aw-5' })).data as {
        world: { important: Array<{ id: string }> };
      }
    ).world.important[0];

    const dismissed = await callerA.aiWorld.setAction({
      userId: 'aw-5',
      itemId: target.id,
      action: 'dismissed',
    });
    expect(dismissed.success).toBe(true);

    const forA = (await callerA.aiWorld.getWorld({ userId: 'aw-5' })).data as {
      world: { important: Array<{ id: string }> };
    };
    expect(forA.world.important.map((i) => i.id)).not.toContain(target.id);
    // User B is never affected (owner-scoped at the service, IDOR-safe).
    const forB = (await callerB.aiWorld.getWorld({ userId: 'aw-6' })).data as {
      world: { important: Array<{ id: string }> };
    };
    expect(forB.world.important.map((i) => i.id)).toContain(target.id);
  });

  it('runDiscovery is bounded and rate-limited by the refresh interval', async () => {
    // A fresh service (no autoSeed) so the first run is observable.
    const freshServices = {
      aiWorld: new DiscoveryApplicationService({
        sources: [new StaticCatalogDiscoverySource()],
        store: new InMemoryDiscoveryStore(),
        now: () => new Date('2026-08-10T12:00:00Z'),
        autoSeed: false,
      }),
    } as unknown as ApiApplicationService;
    const freshRouter = createAppRouter(freshServices);
    const caller = freshRouter.createCaller(ctx('aw-7'));

    const first = await caller.aiWorld.runDiscovery({ userId: 'aw-7' });
    expect(first.success).toBe(true);
    const report = first.data as { totalAdded: number; sources: unknown[]; budget: unknown };
    expect(report.totalAdded).toBeGreaterThan(0);

    // The 6h refresh interval has not elapsed → the second run is skipped
    // (respects source/API rate limits — never an uncontrolled crawler).
    const second = await caller.aiWorld.runDiscovery({ userId: 'aw-7' });
    const skipped = second.data as { totalAdded: number; sources: unknown[] };
    expect(second.success).toBe(true);
    expect(skipped.totalAdded).toBe(0);
    expect(skipped.sources).toEqual([]);
  });

  it('refuses a foreign userId (IDOR) on every aiWorld procedure', async () => {
    const caller = router.createCaller(ctx('aw-owner'));
    await expect(caller.aiWorld.getWorld({ userId: 'aw-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller.aiWorld.getDigest({ userId: 'aw-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller.aiWorld.list({ userId: 'aw-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      caller.aiWorld.getItem({ userId: 'aw-attacker', itemId: 'abc123' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.aiWorld.markRead({ userId: 'aw-attacker', itemId: 'abc123' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.aiWorld.markAllRead({ userId: 'aw-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      caller.aiWorld.setAction({ userId: 'aw-attacker', itemId: 'abc123', action: 'watching' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.aiWorld.runDiscovery({ userId: 'aw-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
