import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CareerCacheService } from '../CareerCacheService.js';

describe('CareerCacheService', () => {
  let cache: CareerCacheService;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new CareerCacheService(1000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns miss for non-existent key', () => {
    const result = cache.get('nonexistent');
    expect(result.hit).toBe(false);
  });

  it('returns cached value on hit', () => {
    cache.set('key1', { data: 'test' });
    const result = cache.get('key1');
    expect(result.hit).toBe(true);
    expect(result.data).toEqual({ data: 'test' });
  });

  it('expires entry after TTL', () => {
    cache.set('key1', 'value', 100);
    vi.advanceTimersByTime(101);
    const result = cache.get('key1');
    expect(result.hit).toBe(false);
  });

  it('invalidates specific key', () => {
    cache.set('key1', 'v1');
    cache.invalidate('key1');
    expect(cache.get('key1').hit).toBe(false);
  });

  it('invalidates by prefix', () => {
    cache.set('career_user1', 'v1');
    cache.set('career_user2', 'v2');
    cache.invalidateByPrefix('career_user1');
    expect(cache.get('career_user1').hit).toBe(false);
    expect(cache.get('career_user2').hit).toBe(true);
  });

  it('clears all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a').hit).toBe(false);
    expect(cache.get('b').hit).toBe(false);
  });

  it('has returns true for valid keys', () => {
    cache.set('k', 'v');
    expect(cache.has('k')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('has returns false for expired keys', () => {
    cache.set('k', 'v', 100);
    vi.advanceTimersByTime(101);
    expect(cache.has('k')).toBe(false);
  });

  it('getMetrics returns correct stats', () => {
    cache.set('k', 'v');
    cache.get('k'); // hit
    cache.get('missing'); // miss
    const m = cache.getMetrics();
    expect(m.totalEntries).toBe(1);
    expect(m.hitRate).toBe(0.5);
    expect(m.missRate).toBe(0.5);
  });

  it('uses default TTL when not specified', () => {
    const c = new CareerCacheService(5000);
    c.set('k', 'v');
    vi.advanceTimersByTime(4000);
    expect(c.has('k')).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(c.has('k')).toBe(false);
  });
});
