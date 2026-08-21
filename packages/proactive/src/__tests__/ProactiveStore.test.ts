import { describe, it, expect } from 'vitest';
import { InMemoryProactiveStore } from '../infrastructure/InMemoryProactiveStore.js';
import type { ProactiveRecommendation } from '../types/proactive-types.js';

function rec(id: string, ownerId = 'u1', title = `R ${id}`): ProactiveRecommendation {
  return {
    id,
    ownerId,
    category: 'OPPORTUNITY',
    title,
    description: 'd',
    evidence: ['e'],
    confidence: 0.5,
    urgency: 'LOW',
    riskLevel: 'LOW',
    status: 'NEW',
    source: 'system',
    createdAt: '2026-08-13T00:00:00.000Z',
  };
}

describe('InMemoryProactiveStore', () => {
  it('saves and lists owner-scoped recommendations', () => {
    const store = new InMemoryProactiveStore();
    store.save(rec('a', 'u1'));
    store.save(rec('b', 'u2'));
    expect(store.list('u1').map((r) => r.id)).toEqual(['a']);
    expect(store.list('u2').map((r) => r.id)).toEqual(['b']);
  });

  it('lists newest first', () => {
    const store = new InMemoryProactiveStore();
    store.save({ ...rec('old'), createdAt: '2026-08-01T00:00:00.000Z' });
    store.save({ ...rec('new'), createdAt: '2026-08-13T00:00:00.000Z' });
    expect(store.list('u1').map((r) => r.id)).toEqual(['new', 'old']);
  });

  it('get and update are owner-scoped', () => {
    const store = new InMemoryProactiveStore();
    store.save(rec('a', 'u1'));
    expect(store.get('u2', 'a')).toBeUndefined();
    expect(store.update('u2', 'a', { status: 'ACCEPTED' })).toBeUndefined();
    expect(store.get('u1', 'a')?.status).toBe('NEW');
    store.update('u1', 'a', { status: 'ACCEPTED' });
    expect(store.get('u1', 'a')?.status).toBe('ACCEPTED');
  });

  it('saveWithKey is idempotent — same key keeps one record', () => {
    const store = new InMemoryProactiveStore();
    store.saveWithKey('u1:OPPORTUNITY:R', rec('x1', 'u1', 'R'));
    store.saveWithKey('u1:OPPORTUNITY:R', rec('x2', 'u1', 'R'));
    expect(store.list('u1').length).toBe(1);
  });

  it('delete removes a record', () => {
    const store = new InMemoryProactiveStore();
    store.save(rec('a', 'u1'));
    store.delete('u1', 'a');
    expect(store.list('u1')).toEqual([]);
  });
});
