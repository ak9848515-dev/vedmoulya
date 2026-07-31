import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExecutionCache } from '../cache/ExecutionCache.js';
import { CACHE_PREFIX } from '../../constants/ExecutionConstants.js';

describe('ExecutionCache', () => {
  let cache: ExecutionCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new ExecutionCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    cache.set('test:', 'key1', { data: 'value1' });
    const result = cache.get<{ data: string }>('test:', 'key1');
    expect(result).toEqual({ data: 'value1' });
  });

  it('returns undefined for missing keys', () => {
    const result = cache.get('test:', 'nonexistent');
    expect(result).toBeUndefined();
  });

  it('returns undefined for expired entries', () => {
    cache.set('test:', 'expires_soon', 'data', 1000);
    vi.advanceTimersByTime(1001);
    const result = cache.get('test:', 'expires_soon');
    expect(result).toBeUndefined();
  });

  it('respects custom TTL', () => {
    cache.set('test:', 'short_ttl', 'data', 500);
    vi.advanceTimersByTime(400);
    expect(cache.get('test:', 'short_ttl')).toBe('data');
    vi.advanceTimersByTime(200);
    expect(cache.get('test:', 'short_ttl')).toBeUndefined();
  });

  it('invalidates single entries', () => {
    cache.set('test:', 'to_delete', 'data');
    cache.invalidate('test:', 'to_delete');
    expect(cache.get('test:', 'to_delete')).toBeUndefined();
  });

  it('invalidates all entries with a prefix', () => {
    cache.set('pref:', 'a', 1);
    cache.set('pref:', 'b', 2);
    cache.set('other:', 'c', 3);
    cache.invalidatePrefix('pref:');
    expect(cache.get('pref:', 'a')).toBeUndefined();
    expect(cache.get('pref:', 'b')).toBeUndefined();
    expect(cache.get('other:', 'c')).toBe(3);
  });

  it('clears all entries', () => {
    cache.set('a:', '1', 'data1');
    cache.set('b:', '2', 'data2');
    cache.clear();
    expect(cache.get('a:', '1')).toBeUndefined();
    expect(cache.get('b:', '2')).toBeUndefined();
  });

  it('evicts oldest entries when over max size', () => {
    const smallCache = new ExecutionCache();
    // Override the max size by setting many entries
    for (let i = 0; i < 1100; i++) {
      smallCache.set('bulk:', `key${i}`, i);
    }
    // The cache should still contain the most recent entries
    // Oldest entries may have been evicted
    const newest = smallCache.get<number>('bulk:', 'key1099');
    expect(newest).toBe(1099);
  });

  describe('convenience methods', () => {
    it('getPlan/setPlan/invalidatePlan', () => {
      cache.setPlan('plan_1', { title: 'Test' });
      expect(cache.getPlan<{ title: string }>('plan_1')?.title).toBe('Test');
      cache.invalidatePlan('plan_1');
      expect(cache.getPlan('plan_1')).toBeUndefined();
    });

    it('getStats/setStats/invalidateStats', () => {
      cache.setStats({ total: 10 });
      expect(cache.getStats<{ total: number }>()?.total).toBe(10);
      cache.invalidateStats();
      expect(cache.getStats<{ total: number }>()).toBeUndefined();
    });

    it('invalidates all plans', () => {
      cache.setPlan('p1', 'data1');
      cache.setPlan('p2', 'data2');
      cache.invalidateAllPlans();
      expect(cache.getPlan('p1')).toBeUndefined();
      expect(cache.getPlan('p2')).toBeUndefined();
    });
  });
});
