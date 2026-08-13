// ──────────────────────────────────────────────────────────────────
// VedMoulya — InMemoryCapabilityPlanStore tests
// EPIC-013 — bounded plan history + owner isolation (IDOR-safe).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryCapabilityPlanStore } from '../infrastructure/InMemoryCapabilityPlanStore.js';
import { plan } from './fixtures.js';

describe('InMemoryCapabilityPlanStore — bounded owner-scoped store', () => {
  it('saves and reads plans per owner', async () => {
    const store = new InMemoryCapabilityPlanStore();
    await store.save('user-a', plan({ id: 'p1' }));
    const read = await store.get('user-a', 'p1');
    expect(read?.id).toBe('p1');
  });

  it('refuses foreign-owner reads (IDOR by construction)', async () => {
    const store = new InMemoryCapabilityPlanStore();
    await store.save('user-a', plan({ id: 'p1' }));
    const foreign = await store.get('user-b', 'p1');
    expect(foreign).toBeUndefined();
  });

  it('lists only the caller’s own plans', async () => {
    const store = new InMemoryCapabilityPlanStore();
    await store.save('user-a', plan({ id: 'p1' }));
    await store.save('user-b', plan({ id: 'p2' }));
    const a = await store.list('user-a');
    expect(a.map((p) => p.id)).toEqual(['p1']);
  });

  it('evicts oldest plans beyond the per-owner cap (FIFO)', async () => {
    const store = new InMemoryCapabilityPlanStore({ maxPlansPerOwner: 2 });
    await store.save('user-a', plan({ id: 'p1' }));
    await store.save('user-a', plan({ id: 'p2' }));
    await store.save('user-a', plan({ id: 'p3' }));
    const list = await store.list('user-a');
    expect(list.map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(await store.get('user-a', 'p1')).toBeUndefined();
  });
});
