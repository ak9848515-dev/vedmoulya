import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryMetrics, MetricNames } from '../../observability/MemoryMetrics.js';

// Mock @vedmoulya/core metrics
const mockIncrement = vi.hoisted(() => vi.fn());

vi.mock('@vedmoulya/core', () => ({
  metrics: {
    increment: mockIncrement,
  },
}));

describe('MemoryMetrics', () => {
  let memoryMetrics: MemoryMetrics;

  beforeEach(() => {
    memoryMetrics = new MemoryMetrics();
    vi.clearAllMocks();
  });

  it('records captured metric', () => {
    memoryMetrics.recordMemoryCaptured();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_CAPTURED);
  });

  it('records recalled metric', () => {
    memoryMetrics.recordMemoryRecalled();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_RECALLED);
  });

  it('records updated metric', () => {
    memoryMetrics.recordMemoryUpdated();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_UPDATED);
  });

  it('records strengthened metric', () => {
    memoryMetrics.recordMemoryStrengthened();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_STRENGTHENED);
  });

  it('records weakened metric', () => {
    memoryMetrics.recordMemoryWeakened();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_WEAKENED);
  });

  it('records merged metric', () => {
    memoryMetrics.recordMemoryMerged();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_MERGED);
  });

  it('records archived metric', () => {
    memoryMetrics.recordMemoryArchived();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_ARCHIVED);
  });

  it('records restored metric', () => {
    memoryMetrics.recordMemoryRestored();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_RESTORED);
  });

  it('records forgotten metric', () => {
    memoryMetrics.recordMemoryForgotten();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_FORGOTTEN);
  });

  it('records decayed metric', () => {
    memoryMetrics.recordMemoryDecayed();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_DECAYED);
  });

  it('records expired metric', () => {
    memoryMetrics.recordMemoryExpired();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.MEMORIES_EXPIRED);
  });

  it('records search executed metric', () => {
    memoryMetrics.recordSearchExecuted();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.SEARCHES_EXECUTED);
  });

  it('records timeline retrieved metric', () => {
    memoryMetrics.recordTimelineRetrieved();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.TIMELINE_RETRIEVED);
  });

  it('records reflection generated metric', () => {
    memoryMetrics.recordReflectionGenerated();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.REFLECTIONS_GENERATED);
  });

  it('records cache hit metric', () => {
    memoryMetrics.recordCacheHit();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.CACHE_HITS);
  });

  it('records cache miss metric', () => {
    memoryMetrics.recordCacheMiss();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.CACHE_MISSES);
  });

  it('does not throw when core metrics fails', () => {
    mockIncrement.mockImplementationOnce(() => {
      throw new Error('metrics error');
    });

    expect(() => memoryMetrics.recordMemoryCaptured()).not.toThrow();
  });
});
