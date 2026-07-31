import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { KnowledgeCache } from '../cache/KnowledgeCache.js';

describe('KnowledgeCache', () => {
  let cache: KnowledgeCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new KnowledgeCache(5000); // 5 second default TTL
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('respects TTL expiry', () => {
    cache.set('key1', 'value1', 100); // 100ms TTL
    expect(cache.get('key1')).toBe('value1');

    vi.advanceTimersByTime(200);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('uses default TTL when not specified', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');

    vi.advanceTimersByTime(4000);
    expect(cache.get('key1')).toBe('value1');

    vi.advanceTimersByTime(2000);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('deletes specific keys', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.delete('key1');
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
  });

  it('clears all entries and resets stats', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.getStats().hits).toBe(0);
    expect(cache.getStats().misses).toBe(0);
  });

  it('invalidateByPrefix removes matching entries', () => {
    cache.set('user:1', 'alice');
    cache.set('user:2', 'bob');
    cache.set('config:1', 'dark');

    cache.invalidateByPrefix('user:');
    expect(cache.get('user:1')).toBeUndefined();
    expect(cache.get('user:2')).toBeUndefined();
    expect(cache.get('config:1')).toBe('dark');
  });

  describe('stats tracking', () => {
    it('tracks hits and misses', () => {
      cache.set('k', 'v');

      cache.get('k'); // hit
      cache.get('k'); // hit
      cache.get('x'); // miss
      cache.get('y'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
    });

    it('counts expired entries as misses', () => {
      cache.set('k', 'v', 100);
      cache.get('k'); // hit

      vi.advanceTimersByTime(200);
      cache.get('k'); // miss (expired)

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('calculates hit rate correctly', () => {
      cache.set('k', 'v');

      cache.get('k'); // hit
      cache.get('x'); // miss
      cache.get('y'); // miss

      expect(cache.getStats().hitRate).toBeCloseTo(0.333, 2);
    });

    it('returns 0 hit rate when no lookups', () => {
      expect(cache.getStats().hitRate).toBe(0);
    });
  });

  it('reports correct size', () => {
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    expect(cache.size).toBe(1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
    cache.delete('a');
    expect(cache.size).toBe(1);
  });
});
