import { describe, it, expect } from 'vitest';
import { LearningCacheService } from '../LearningCacheService.js';

describe('LearningCacheService', () => {
  it('returns miss for non-existent key', () => {
    const svc = new LearningCacheService();
    const result = svc.get('nonexistent');
    expect(result.hit).toBe(false);
    expect(result.data).toBeUndefined();
  });

  it('stores and retrieves data', () => {
    const svc = new LearningCacheService();
    svc.set('key1', { value: 42 });
    const result = svc.get<{ value: number }>('key1');
    expect(result.hit).toBe(true);
    expect(result.data?.value).toBe(42);
  });

  it('respects custom TTL', async () => {
    const svc = new LearningCacheService(100);
    svc.set('key1', 'data', 50);
    await new Promise((r) => setTimeout(r, 60));
    const result = svc.get('key1');
    expect(result.hit).toBe(false);
  });

  it('expires entries after default TTL', async () => {
    const svc = new LearningCacheService(50);
    svc.set('key1', 'data');
    await new Promise((r) => setTimeout(r, 60));
    const result = svc.get('key1');
    expect(result.hit).toBe(false);
  });

  it('invalidate removes single key', () => {
    const svc = new LearningCacheService();
    svc.set('key1', 'data');
    svc.invalidate('key1');
    expect(svc.get('key1').hit).toBe(false);
  });

  it('invalidateByPrefix removes matching keys', () => {
    const svc = new LearningCacheService();
    svc.set('user_1', 'a');
    svc.set('user_2', 'b');
    svc.set('other', 'c');
    svc.invalidateByPrefix('user_');
    expect(svc.get('user_1').hit).toBe(false);
    expect(svc.get('user_2').hit).toBe(false);
    expect(svc.get('other').hit).toBe(true);
  });

  it('clear removes all entries and resets metrics', () => {
    const svc = new LearningCacheService();
    svc.set('a', 1);
    svc.set('b', 2);
    svc.clear();
    expect(svc.get('a').hit).toBe(false);
    expect(svc.get('b').hit).toBe(false);
    const m = svc.getMetrics();
    expect(m.totalEntries).toBe(0);
    expect(m.hitRate).toBe(0);
  });

  it('has returns true for existing key', () => {
    const svc = new LearningCacheService();
    svc.set('k', 'v');
    expect(svc.has('k')).toBe(true);
  });

  it('has returns false for expired key', async () => {
    const svc = new LearningCacheService(50);
    svc.set('k', 'v');
    await new Promise((r) => setTimeout(r, 60));
    expect(svc.has('k')).toBe(false);
  });

  it('getMetrics returns correct stats', () => {
    const svc = new LearningCacheService();
    svc.set('a', 1);
    svc.get('a'); // hit
    svc.get('b'); // miss
    const m = svc.getMetrics();
    expect(m.totalEntries).toBe(1);
    expect(m.hitRate).toBeCloseTo(0.5);
    expect(m.missRate).toBeCloseTo(0.5);
    expect(m.memoryUsage).toBe(1);
  });

  it('uses default TTL when not specified', () => {
    const svc = new LearningCacheService(5000);
    expect((svc as any).defaultTtlMs).toBe(5000);
  });
});
