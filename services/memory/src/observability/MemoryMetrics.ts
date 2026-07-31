// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Metrics
// Metrics instruments for memory engine operations monitoring
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { metrics } from '@vedmoulya/core';

export const MetricNames = {
  MEMORIES_CAPTURED: 'memory.captured',
  MEMORIES_RECALLED: 'memory.recalled',
  MEMORIES_UPDATED: 'memory.updated',
  MEMORIES_STRENGTHENED: 'memory.strengthened',
  MEMORIES_WEAKENED: 'memory.weakened',
  MEMORIES_MERGED: 'memory.merged',
  MEMORIES_ARCHIVED: 'memory.archived',
  MEMORIES_RESTORED: 'memory.restored',
  MEMORIES_FORGOTTEN: 'memory.forgotten',
  MEMORIES_DECAYED: 'memory.decayed',
  MEMORIES_EXPIRED: 'memory.expired',
  SEARCHES_EXECUTED: 'memory.searches.executed',
  TIMELINE_RETRIEVED: 'memory.timeline.retrieved',
  REFLECTIONS_GENERATED: 'memory.reflections.generated',
  CACHE_HITS: 'memory.cache.hits',
  CACHE_MISSES: 'memory.cache.misses',
} as const;

export class MemoryMetrics {
  recordMemoryCaptured(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_CAPTURED);
    } catch {
      /* noop */
    }
  }

  recordMemoryRecalled(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_RECALLED);
    } catch {
      /* noop */
    }
  }

  recordMemoryUpdated(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_UPDATED);
    } catch {
      /* noop */
    }
  }

  recordMemoryStrengthened(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_STRENGTHENED);
    } catch {
      /* noop */
    }
  }

  recordMemoryWeakened(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_WEAKENED);
    } catch {
      /* noop */
    }
  }

  recordMemoryMerged(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_MERGED);
    } catch {
      /* noop */
    }
  }

  recordMemoryArchived(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_ARCHIVED);
    } catch {
      /* noop */
    }
  }

  recordMemoryRestored(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_RESTORED);
    } catch {
      /* noop */
    }
  }

  recordMemoryForgotten(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_FORGOTTEN);
    } catch {
      /* noop */
    }
  }

  recordMemoryDecayed(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_DECAYED);
    } catch {
      /* noop */
    }
  }

  recordMemoryExpired(): void {
    try {
      metrics.increment(MetricNames.MEMORIES_EXPIRED);
    } catch {
      /* noop */
    }
  }

  recordSearchExecuted(): void {
    try {
      metrics.increment(MetricNames.SEARCHES_EXECUTED);
    } catch {
      /* noop */
    }
  }

  recordTimelineRetrieved(): void {
    try {
      metrics.increment(MetricNames.TIMELINE_RETRIEVED);
    } catch {
      /* noop */
    }
  }

  recordReflectionGenerated(): void {
    try {
      metrics.increment(MetricNames.REFLECTIONS_GENERATED);
    } catch {
      /* noop */
    }
  }

  recordCacheHit(): void {
    try {
      metrics.increment(MetricNames.CACHE_HITS);
    } catch {
      /* noop */
    }
  }

  recordCacheMiss(): void {
    try {
      metrics.increment(MetricNames.CACHE_MISSES);
    } catch {
      /* noop */
    }
  }
}
