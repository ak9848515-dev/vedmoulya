import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryMetrics, MetricNames } from '../MemoryMetrics.js';
import { metrics } from '@vedmoulya/core';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MemoryMetrics', () => {
  it('increments the captured counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryCaptured();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_CAPTURED);
  });

  it('increments the recalled counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryRecalled();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_RECALLED);
  });

  it('increments the updated counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryUpdated();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_UPDATED);
  });

  it('increments the strengthened counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryStrengthened();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_STRENGTHENED);
  });

  it('increments the weakened counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryWeakened();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_WEAKENED);
  });

  it('increments the merged counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryMerged();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_MERGED);
  });

  it('increments the archived counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryArchived();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_ARCHIVED);
  });

  it('increments the restored counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryRestored();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_RESTORED);
  });

  it('increments the forgotten counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryForgotten();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_FORGOTTEN);
  });

  it('increments the decayed counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryDecayed();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_DECAYED);
  });

  it('increments the expired counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordMemoryExpired();
    expect(spy).toHaveBeenCalledWith(MetricNames.MEMORIES_EXPIRED);
  });

  it('increments the search counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordSearchExecuted();
    expect(spy).toHaveBeenCalledWith(MetricNames.SEARCHES_EXECUTED);
  });

  it('increments the timeline counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordTimelineRetrieved();
    expect(spy).toHaveBeenCalledWith(MetricNames.TIMELINE_RETRIEVED);
  });

  it('increments the reflection counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordReflectionGenerated();
    expect(spy).toHaveBeenCalledWith(MetricNames.REFLECTIONS_GENERATED);
  });

  it('increments the cache hit counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordCacheHit();
    expect(spy).toHaveBeenCalledWith(MetricNames.CACHE_HITS);
  });

  it('increments the cache miss counter', () => {
    const spy = vi.spyOn(metrics, 'increment').mockImplementation(() => {});
    new MemoryMetrics().recordCacheMiss();
    expect(spy).toHaveBeenCalledWith(MetricNames.CACHE_MISSES);
  });

  it('swallows registry failures for every record method', () => {
    vi.spyOn(metrics, 'increment').mockImplementation(() => {
      throw new Error('registry down');
    });
    const m = new MemoryMetrics();
    expect(() => m.recordMemoryCaptured()).not.toThrow();
    expect(() => m.recordMemoryRecalled()).not.toThrow();
    expect(() => m.recordMemoryUpdated()).not.toThrow();
    expect(() => m.recordMemoryStrengthened()).not.toThrow();
    expect(() => m.recordMemoryWeakened()).not.toThrow();
    expect(() => m.recordMemoryMerged()).not.toThrow();
    expect(() => m.recordMemoryArchived()).not.toThrow();
    expect(() => m.recordMemoryRestored()).not.toThrow();
    expect(() => m.recordMemoryForgotten()).not.toThrow();
    expect(() => m.recordMemoryDecayed()).not.toThrow();
    expect(() => m.recordMemoryExpired()).not.toThrow();
    expect(() => m.recordSearchExecuted()).not.toThrow();
    expect(() => m.recordTimelineRetrieved()).not.toThrow();
    expect(() => m.recordReflectionGenerated()).not.toThrow();
    expect(() => m.recordCacheHit()).not.toThrow();
    expect(() => m.recordCacheMiss()).not.toThrow();
  });

  it('exposes the full metric name catalog', () => {
    expect(MetricNames.MEMORIES_CAPTURED).toBe('memory.captured');
    expect(MetricNames.MEMORIES_RECALLED).toBe('memory.recalled');
    expect(MetricNames.CACHE_HITS).toBe('memory.cache.hits');
    expect(MetricNames.CACHE_MISSES).toBe('memory.cache.misses');
    expect(MetricNames.SEARCHES_EXECUTED).toBe('memory.searches.executed');
  });
});
