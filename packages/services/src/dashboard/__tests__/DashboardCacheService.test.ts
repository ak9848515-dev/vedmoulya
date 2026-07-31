import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardCacheService } from '../DashboardCacheService.js';

describe('DashboardCacheService', () => {
  let cache: DashboardCacheService;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new DashboardCacheService(1000); // 1 second TTL
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Basic Operations ───────────────────────────────────────────

  describe('get/set', () => {
    it('stores and retrieves values', () => {
      cache.set('key1', { value: 'test' });
      const result = cache.get<{ value: string }>('key1');
      expect(result.hit).toBe(true);
      expect(result.data?.value).toBe('test');
    });

    it('returns miss for missing keys', () => {
      const result = cache.get('nonexistent');
      expect(result.hit).toBe(false);
      expect(result.data).toBeUndefined();
    });

    it('returns miss after TTL expiry', () => {
      cache.set('key1', 'value', 500);
      vi.advanceTimersByTime(600);
      const result = cache.get('key1');
      expect(result.hit).toBe(false);
    });

    it('custom TTL overrides default', () => {
      cache.set('key1', 'value', 2000);
      vi.advanceTimersByTime(1500);
      // Should still be valid with 2000ms TTL
      expect(cache.get('key1').hit).toBe(true);
    });
  });

  // ── Invalidation ───────────────────────────────────────────────

  describe('invalidate', () => {
    it('invalidates specific key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.invalidate('key1');
      expect(cache.get('key1').hit).toBe(false);
      expect(cache.get('key2').hit).toBe(true);
    });

    it('invalidates by prefix', () => {
      cache.set('user_1_snapshot', 'data1');
      cache.set('user_1_config', 'data2');
      cache.set('user_2_snapshot', 'data3');
      cache.invalidateByPrefix('user_1');
      expect(cache.get('user_1_snapshot').hit).toBe(false);
      expect(cache.get('user_1_config').hit).toBe(false);
      expect(cache.get('user_2_snapshot').hit).toBe(true);
    });

    it('clears all entries', () => {
      cache.set('key1', 'v1');
      cache.set('key2', 'v2');
      cache.clear();
      expect(cache.get('key1').hit).toBe(false);
      expect(cache.get('key2').hit).toBe(false);
      expect(cache.getMetrics().totalEntries).toBe(0);
    });
  });

  // ── has / getTtl ───────────────────────────────────────────────

  describe('has', () => {
    it('returns true for valid entries', () => {
      cache.set('key1', 'value');
      expect(cache.has('key1')).toBe(true);
    });

    it('returns false for expired entries', () => {
      cache.set('key1', 'value', 100);
      vi.advanceTimersByTime(200);
      expect(cache.has('key1')).toBe(false);
    });

    it('returns false for missing keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });
  });

  describe('getTtl', () => {
    it('returns remaining TTL for valid entries', () => {
      cache.set('key1', 'value', 1000);
      const ttl = cache.getTtl('key1');
      expect(ttl).toBeDefined();
      expect(ttl!).toBeGreaterThan(0);
      expect(ttl!).toBeLessThanOrEqual(1000);
    });

    it('returns undefined for missing keys', () => {
      expect(cache.getTtl('nonexistent')).toBeUndefined();
    });
  });

  // ── Metrics ────────────────────────────────────────────────────

  describe('getMetrics', () => {
    it('returns correct metrics', () => {
      cache.set('key1', 'v1');
      cache.set('key2', 'v2');
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('missing'); // miss

      const metrics = cache.getMetrics();
      expect(metrics.totalEntries).toBe(2);
      expect(metrics.hitRate).toBeCloseTo(2 / 3);
      expect(metrics.missRate).toBeCloseTo(1 / 3);
    });

    it('rounds average latency', () => {
      cache.set('k', 'v');
      cache.get('k');
      const metrics = cache.getMetrics();
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
    });
  });
});
