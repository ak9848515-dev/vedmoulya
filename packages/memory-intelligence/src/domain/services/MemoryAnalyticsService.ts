// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Analytics Service
// EI-010 — Enterprise Memory Intelligence Platform
// Aggregates the memory registry into the Memory Analytics aggregate:
// totals, per-type / source / lifecycle / compression distributions,
// importance bands, usage tops, consumer tops, and a 14-day trend.
// Powers the Usage Analytics view and the Memory Center dashboard.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed Record lookups keyed by the closed
   MemoryType / MemoryLifecycleStatus / MemorySourceType unions — no runtime
   attacker-controlled keys. */

import type { MemoryAnalytics, MemoryItem } from '../../types/memory-types.js';
import {
  MEMORY_COMPRESSION_STATES,
  MEMORY_LIFECYCLE_STATUSES,
  MEMORY_SOURCE_TYPES,
  MEMORY_TYPES,
} from '../../types/memory-types.js';

export class MemoryAnalyticsService {
  aggregate(items: MemoryItem[]): MemoryAnalytics {
    const byType = this.countBy(items, (m) => m.type, MEMORY_TYPES);
    const bySourceType = this.countBy(items, (m) => m.sourceType, MEMORY_SOURCE_TYPES);
    const byLifecycle = this.countBy(items, (m) => m.lifecycleStatus, MEMORY_LIFECYCLE_STATUSES);
    const byCompression = this.countBy(items, (m) => m.compressionState, MEMORY_COMPRESSION_STATES);

    const importanceDistribution = [
      { band: '0.0–0.2', count: items.filter((m) => m.importance.score < 0.2).length },
      {
        band: '0.2–0.4',
        count: items.filter((m) => m.importance.score >= 0.2 && m.importance.score < 0.4).length,
      },
      {
        band: '0.4–0.6',
        count: items.filter((m) => m.importance.score >= 0.4 && m.importance.score < 0.6).length,
      },
      {
        band: '0.6–0.8',
        count: items.filter((m) => m.importance.score >= 0.6 && m.importance.score < 0.8).length,
      },
      { band: '0.8–1.0', count: items.filter((m) => m.importance.score >= 0.8).length },
    ];

    const usageTop = [...items]
      .sort(
        (a, b) =>
          b.usage.totalRetrievals - a.usage.totalRetrievals ||
          b.importance.score - a.importance.score,
      )
      .slice(0, 10)
      .map((m) => ({
        memoryId: m.memoryId,
        title: m.title,
        retrievals: m.usage.totalRetrievals,
        importance: m.importance.score,
      }));

    const consumersMap = new Map<string, MemoryAnalytics['consumersTop'][number]>();
    for (const memory of items) {
      for (const consumer of memory.consumers) {
        const existing = consumersMap.get(consumer.consumerId);
        if (existing) {
          existing.usageCount += consumer.usageCount;
        } else {
          consumersMap.set(consumer.consumerId, { ...consumer });
        }
      }
    }
    const consumersTop = [...consumersMap.values()]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    return {
      totals: {
        memories: items.length,
        active: byLifecycle.active,
        archived: byLifecycle.archived,
        expired: byLifecycle.expired,
        relationships: items.reduce((s, m) => s + m.relationships.length, 0),
        citations: items.reduce((s, m) => s + m.citations.length, 0),
        consumers: new Set(items.flatMap((m) => m.consumers.map((c) => c.consumerId))).size,
        totalRetrievals: items.reduce((s, m) => s + m.usage.totalRetrievals, 0),
        avgImportance: this.avg(items.map((m) => m.importance.score)),
        avgConfidence: this.avg(items.map((m) => m.confidence.score)),
        avgRecency: this.avg(items.map((m) => m.usage.recency)),
      },
      byType,
      bySourceType,
      byLifecycle,
      byCompression,
      importanceDistribution,
      usageTop,
      consumersTop,
      trend: this.trend(items),
    };
  }

  private countBy<K extends string>(
    items: MemoryItem[],
    key: (m: MemoryItem) => K,
    allKeys: readonly K[],
  ): Record<K, number> {
    const result = Object.fromEntries(allKeys.map((k) => [k, 0])) as Record<K, number>;
    for (const item of items) {
      const k = key(item);
      if (k in result) result[k] += 1;
    }
    return result;
  }

  private avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  /** 14-day growth trend (memories + active). */
  private trend(items: MemoryItem[]): MemoryAnalytics['trend'] {
    const points: MemoryAnalytics['trend'] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const label = date.toISOString().slice(0, 10);
      const dayItems = items.filter((m) => m.createdAt.slice(0, 10) === label);
      points.push({
        date: label,
        memories: dayItems.length,
        active: dayItems.filter((m) => m.lifecycleStatus === 'active').length,
      });
    }
    return points;
  }
}
