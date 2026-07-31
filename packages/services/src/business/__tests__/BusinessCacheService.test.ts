import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessCacheService } from '../BusinessCacheService.js';

describe('BusinessCacheService', () => {
  let cache: BusinessCacheService;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new BusinessCacheService(5000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('set stores data and get retrieves it', () => {
    cache.set('key1', { value: 42 });
    const result = cache.get<{ value: number }>('key1');
    expect(result.hit).toBe(true);
    expect(result.data?.value).toBe(42);
  });

  it('get returns miss for nonexistent key', () => {
    const result = cache.get('nonexistent');
    expect(result.hit).toBe(false);
  });

  it('get returns miss for expired entry and deletes it', () => {
    cache.set('key1', 'data', 1000);
    vi.advanceTimersByTime(1500);
    const result = cache.get<string>('key1');
    expect(result.hit).toBe(false);
    expect(cache.has('key1')).toBe(false);
  });

  it('invalidate removes key', () => {
    cache.set('key1', 'data');
    cache.invalidate('key1');
    expect(cache.get('key1').hit).toBe(false);
  });

  it('invalidateByPrefix removes matching keys only', () => {
    cache.set('user_1', 'a');
    cache.set('user_2', 'b');
    cache.set('config_1', 'c');
    cache.invalidateByPrefix('user_');
    expect(cache.get('user_1').hit).toBe(false);
    expect(cache.get('user_2').hit).toBe(false);
    expect(cache.get('config_1').hit).toBe(true);
  });

  it('clear resets all state', () => {
    cache.set('key1', 'a');
    cache.set('key2', 'b');
    cache.clear();
    expect(cache.get('key1').hit).toBe(false);
    expect(cache.get('key2').hit).toBe(false);
    const m = cache.getMetrics();
    expect(m.totalEntries).toBe(0);
    expect(m.hitRate).toBe(0);
  });

  it('has returns true for existing non-expired key', () => {
    cache.set('key1', 'data');
    expect(cache.has('key1')).toBe(true);
  });

  it('has returns false for missing key', () => {
    expect(cache.has('missing')).toBe(false);
  });

  it('has returns false and deletes expired entry', () => {
    cache.set('key1', 'data', 1000);
    vi.advanceTimersByTime(1500);
    expect(cache.has('key1')).toBe(false);
    expect(cache.get('key1').hit).toBe(false);
  });

  it('getMetrics returns correct stats', () => {
    cache.set('k1', 1, 100_000);
    cache.get('k1'); // hit
    cache.get('k1'); // hit
    cache.get('missing'); // miss
    const m = cache.getMetrics();
    expect(m.totalEntries).toBe(1);
    expect(m.hitRate).toBeCloseTo(2 / 3);
    expect(m.missRate).toBeCloseTo(1 / 3);
    expect(m.memoryUsage).toBe(1);
  });

  it('set uses provided ttl instead of default', () => {
    cache.set('k1', 'data', 100);
    vi.advanceTimersByTime(150);
    expect(cache.get('k1').hit).toBe(false);
  });

  it('invalidateByPrefix on empty prefix deletes everything (startsWith("") always true)', () => {
    cache.set('k1', 'a');
    cache.set('k2', 'b');
    cache.invalidateByPrefix('');
    expect(cache.has('k1')).toBe(false);
    expect(cache.has('k2')).toBe(false);
  });
});
