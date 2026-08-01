// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Cache unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, afterEach } from 'vitest';
import { DecisionCache } from '../DecisionCache.js';

describe('DecisionCache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values with the default TTL', () => {
    const cache = new DecisionCache(1000);
    cache.set('k', { answer: 42 });
    expect(cache.get('k')).toEqual({ answer: 42 });
    expect(cache.size).toBe(1);
  });

  it('honours a custom TTL per entry', () => {
    vi.useFakeTimers();
    const cache = new DecisionCache(1000);
    cache.set('k', 'v', 100);
    vi.advanceTimersByTime(101);
    expect(cache.get('k')).toBeUndefined();
  });

  it('expires entries after the TTL and counts them as misses', () => {
    vi.useFakeTimers();
    const cache = new DecisionCache(100);
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
    vi.advanceTimersByTime(101);
    expect(cache.get('k')).toBeUndefined();
    expect(cache.getStats().misses).toBe(1);
  });

  it('counts misses for missing keys', () => {
    const cache = new DecisionCache();
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.getStats().misses).toBe(1);
  });

  it('tracks hits and computes the hit rate', () => {
    const cache = new DecisionCache(1000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.get('b');
    cache.get('missing');
    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
  });

  it('reports a zero hit rate when no lookups happened', () => {
    const cache = new DecisionCache();
    expect(cache.getStats().hitRate).toBe(0);
  });

  it('deletes individual keys', () => {
    const cache = new DecisionCache();
    cache.set('a', 1);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
  });

  it('clears all entries and resets stats', () => {
    const cache = new DecisionCache();
    cache.set('a', 1);
    cache.get('a');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.getStats()).toEqual({ size: 0, hits: 0, misses: 0, hitRate: 0 });
  });

  it('invalidates entries by prefix', () => {
    const cache = new DecisionCache();
    cache.set('decision:1', 'a');
    cache.set('decision:2', 'b');
    cache.set('options:1', 'c');
    cache.invalidateByPrefix('decision:');
    expect(cache.get('decision:1')).toBeUndefined();
    expect(cache.get('decision:2')).toBeUndefined();
    expect(cache.get('options:1')).toBe('c');
  });
});
