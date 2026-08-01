// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: UserCache
// Covers get, set, invalidate, invalidateMany, clear, and stats.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import { UserCache } from '../src/infrastructure/cache/UserCache.js';

describe('UserCache', () => {
  let cache: UserCache;

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a missing key', () => {
    cache = new UserCache();
    expect(cache.get('usr_missing' as never)).toBeNull();
  });

  it('stores and retrieves a value', () => {
    cache = new UserCache();
    cache.set('usr_1' as never, '{"id":"usr_1"}');
    expect(cache.get('usr_1' as never)).toBe('{"id":"usr_1"}');
  });

  it('returns null for an expired entry', () => {
    vi.useFakeTimers();
    cache = new UserCache();
    cache.set('usr_2' as never, 'value');
    // Advance beyond the default TTL (config.redis.ttl ?? 3600s).
    vi.advanceTimersByTime(3600 * 1000 + 1);
    expect(cache.get('usr_2' as never)).toBeNull();
  });

  it('invalidates a single key', () => {
    cache = new UserCache();
    cache.set('usr_3' as never, 'v');
    cache.invalidate('usr_3' as never);
    expect(cache.get('usr_3' as never)).toBeNull();
  });

  it('invalidates many keys', () => {
    cache = new UserCache();
    cache.set('usr_a' as never, '1');
    cache.set('usr_b' as never, '2');
    cache.invalidateMany(['usr_a' as never, 'usr_b' as never]);
    expect(cache.get('usr_a' as never)).toBeNull();
    expect(cache.get('usr_b' as never)).toBeNull();
  });

  it('clears the entire cache', () => {
    cache = new UserCache();
    cache.set('usr_c' as never, '3');
    cache.clear();
    expect(cache.get('usr_c' as never)).toBeNull();
    expect(cache.getStats().size).toBe(0);
  });

  it('reports cache size statistics', () => {
    cache = new UserCache();
    expect(cache.getStats().size).toBe(0);
    cache.set('usr_d' as never, 'x');
    cache.set('usr_e' as never, 'y');
    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });
});
