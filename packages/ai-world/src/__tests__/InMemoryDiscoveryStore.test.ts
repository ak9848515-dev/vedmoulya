// ──────────────────────────────────────────────────────────────────
// VedMoulya — InMemoryDiscoveryStore tests
// EPIC-012C — bounded, owner-scoped discovery persistence (§9/§14)
//
// The store retains at most maxStoredItems (FIFO eviction — discovery
// can never become an unbounded memory sink). User attention state is
// keyed by owner — items are platform-wide, per-user state is
// isolated (IDOR-safe by construction).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryDiscoveryStore } from '../infrastructure/InMemoryDiscoveryStore.js';
import { item } from './fixtures.js';

describe('InMemoryDiscoveryStore — bounded storage', () => {
  it('adds items and returns the number actually added', async () => {
    const store = new InMemoryDiscoveryStore();
    const added = await store.addItems([item({ id: 'a' }), item({ id: 'b' })]);
    expect(added).toBe(2);
    expect((await store.listItems()).length).toBe(2);
  });

  it('dedupes re-additions by stable id', async () => {
    const store = new InMemoryDiscoveryStore();
    await store.addItems([item({ id: 'a' })]);
    const second = await store.addItems([item({ id: 'a' }), item({ id: 'b' })]);
    expect(second).toBe(1);
    expect((await store.listItems()).length).toBe(2);
  });

  it('evicts the oldest items beyond the bound (FIFO — bounded sink)', async () => {
    const store = new InMemoryDiscoveryStore({ maxStoredItems: 2 });
    await store.addItems([item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })]);
    const ids = (await store.listItems()).map((i) => i.id);
    expect(ids).toEqual(['b', 'c']);
    expect(await store.getItem('a')).toBeUndefined();
  });

  it('returns an item by id', async () => {
    const store = new InMemoryDiscoveryStore();
    await store.addItems([item({ id: 'x' })]);
    expect((await store.getItem('x'))?.id).toBe('x');
    expect(await store.getItem('missing')).toBeUndefined();
  });
});

describe('InMemoryDiscoveryStore — owner-scoped user state (ownership)', () => {
  it('defaults user state to unread + no action', async () => {
    const store = new InMemoryDiscoveryStore();
    const state = await store.getUserState('u1', 'a');
    expect(state).toEqual({ read: false, action: 'none' });
  });

  it('marks items read per owner', async () => {
    const store = new InMemoryDiscoveryStore();
    await store.markRead('u1', 'a');
    expect(await store.getUserState('u1', 'a')).toEqual({ read: true, action: 'none' });
    // Another owner is untouched.
    expect(await store.getUserState('u2', 'a')).toEqual({ read: false, action: 'none' });
  });

  it('stores owner-scoped actions (watch / dismiss)', async () => {
    const store = new InMemoryDiscoveryStore();
    await store.setAction('u1', 'a', 'dismissed');
    await store.setAction('u1', 'b', 'watching');
    expect((await store.getUserState('u1', 'a')).action).toBe('dismissed');
    expect((await store.getUserState('u1', 'b')).action).toBe('watching');
  });

  it('never shares state across owners (structural isolation)', async () => {
    const store = new InMemoryDiscoveryStore();
    await store.markRead('owner-a', 'item-1');
    await store.setAction('owner-b', 'item-1', 'dismissed');
    // Each owner reads back only their own state for the same item.
    expect(await store.getUserState('owner-a', 'item-1')).toEqual({ read: true, action: 'none' });
    expect(await store.getUserState('owner-b', 'item-1')).toEqual({
      read: false,
      action: 'dismissed',
    });
    expect(await store.getUserState('owner-c', 'item-1')).toEqual({ read: false, action: 'none' });
  });

  it('keeps read state when an action is updated (no clobbering)', async () => {
    const store = new InMemoryDiscoveryStore();
    await store.markRead('u1', 'a');
    await store.setAction('u1', 'a', 'watching');
    expect(await store.getUserState('u1', 'a')).toEqual({ read: true, action: 'watching' });
  });
});
