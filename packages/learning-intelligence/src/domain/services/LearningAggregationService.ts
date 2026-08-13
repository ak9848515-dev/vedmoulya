// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Aggregation Service
// EI-007 — Enterprise Learning Intelligence Platform
// Pure aggregation: learning events → per-entity `LearningModel`s plus
// dashboard statistics (category stats + daily trend). No I/O, no engine
// calls — deterministic and fully unit-testable.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below indexes closed-union records (learning
   categories) — never attacker-controlled input. */

import type {
  LearningCategory,
  LearningCategoryStats,
  LearningEvent,
  LearningModel,
  LearningTrendPoint,
} from '../../types/learning-types.js';
import { LEARNING_CATEGORIES } from '../../types/learning-types.js';

export interface AggregationOptions {
  /** Sample count that maps to model confidence 1.0 (default 20). */
  fullConfidenceSamples?: number;
  /** Model confidence scale (default 0.95 max). */
  maxConfidence?: number;
}

const DEFAULT_OPTIONS: Required<AggregationOptions> = {
  fullConfidenceSamples: 20,
  maxConfidence: 0.95,
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Confidence grows with sample count toward `maxConfidence`. */
function confidenceForSamples(sampleCount: number, options: Required<AggregationOptions>): number {
  if (sampleCount === 0) return 0;
  return round(
    Math.min(
      options.maxConfidence,
      (sampleCount / options.fullConfidenceSamples) * options.maxConfidence,
    ),
  );
}

export class LearningAggregationService {
  private readonly options: Required<AggregationOptions>;

  constructor(options: AggregationOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** Group events by (category, entityType, entityId) preserving first label. */
  private groupByEntity(events: LearningEvent[]): Map<string, LearningEvent[]> {
    const groups = new Map<string, LearningEvent[]>();
    for (const event of events) {
      const key = `${event.category}::${event.entityType}::${event.entityId}`;
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(event);
      } else {
        groups.set(key, [event]);
      }
    }
    return groups;
  }

  /** Success-rate delta between the most recent and earlier halves of a series. */
  private computeTrend(events: LearningEvent[]): number {
    const sorted = [...events].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
    const mid = Math.floor(sorted.length / 2);
    if (mid === 0) return 0;
    const earlier = sorted.slice(0, mid);
    const recent = sorted.slice(mid);
    const rate = (bucket: LearningEvent[]): number =>
      bucket.filter((e) => e.outcome === 'success').length / bucket.length;
    return round(rate(recent) - rate(earlier));
  }

  /** Build a LearningModel for one entity from its events (newest first). */
  private buildModel(
    category: LearningCategory,
    entityType: string,
    entityId: string,
    entityLabel: string,
    events: LearningEvent[],
  ): LearningModel {
    const sorted = [...events].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    const successCount = events.filter((e) => e.outcome === 'success').length;
    const sampleCount = events.length;
    return {
      category,
      entityType,
      entityId,
      entityLabel,
      sampleCount,
      successCount,
      failureCount: sampleCount - successCount,
      successRate: round(successCount / sampleCount),
      avgCostUsd: round(average(events.map((e) => e.costUsd))),
      avgLatencyMs: round(average(events.map((e) => e.latencyMs))),
      avgAccuracy: round(average(events.map((e) => e.accuracy))),
      avgRetries: round(average(events.map((e) => e.retries))),
      avgQuality: round(average(events.map((e) => e.quality))),
      avgFeedback: round(
        average(events.filter((e) => e.feedback !== undefined).map((e) => e.feedback as number)),
      ),
      avgBusinessOutcome: round(
        average(
          events
            .filter((e) => e.businessOutcome !== undefined)
            .map((e) => e.businessOutcome as number),
        ),
      ),
      confidence: confidenceForSamples(sampleCount, this.options),
      trend: this.computeTrend(events),
      lastSeen: sorted[0]?.occurredAt ?? new Date().toISOString(),
    };
  }

  /** Aggregate all events into per-entity models (sorted by sample count). */
  aggregate(events: LearningEvent[]): LearningModel[] {
    const models: LearningModel[] = [];
    for (const [key, bucket] of this.groupByEntity(events)) {
      const [category, entityType, entityId] = key.split('::') as [
        LearningCategory,
        string,
        string,
      ];
      const entityLabel = bucket[0]?.entityLabel ?? entityId;
      models.push(this.buildModel(category, entityType, entityId, entityLabel, bucket));
    }
    return models.sort((a, b) => b.sampleCount - a.sampleCount);
  }

  /** Category-level stats for the dashboard. */
  categoryStats(
    events: LearningEvent[],
    models: LearningModel[],
  ): Record<LearningCategory, LearningCategoryStats> {
    const byCategory = new Map<LearningCategory, LearningEvent[]>();
    for (const category of LEARNING_CATEGORIES) byCategory.set(category, []);
    for (const event of events) {
      byCategory.get(event.category)?.push(event);
    }
    const result = {} as Record<LearningCategory, LearningCategoryStats>;
    for (const category of LEARNING_CATEGORIES) {
      const bucket = byCategory.get(category) ?? [];
      const failures = bucket.filter((e) => e.outcome === 'failure').length;
      const avgCostUsd = average(bucket.map((e) => e.costUsd));
      result[category] = {
        events: bucket.length,
        successRate:
          bucket.length === 0
            ? 0
            : round(bucket.filter((e) => e.outcome === 'success').length / bucket.length),
        models: models.filter((m) => m.category === category).length,
        failures,
        avgCostUsd: round(avgCostUsd),
      };
    }
    return result;
  }

  /**
   * Daily trend buckets for the last `days` days (most recent first).
   * Buckets are always present (zero-filled) so charts render a continuous axis.
   */
  trend(events: LearningEvent[], days = 14): LearningTrendPoint[] {
    const now = new Date();
    const buckets: LearningTrendPoint[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const day = new Date(now.getTime() - offset * 86_400_000);
      const key = day.toISOString().slice(0, 10);
      const bucketEvents = events.filter((e) => e.occurredAt.slice(0, 10) === key);
      buckets.push({
        date: key,
        events: bucketEvents.length,
        successRate:
          bucketEvents.length === 0
            ? 0
            : round(
                bucketEvents.filter((e) => e.outcome === 'success').length / bucketEvents.length,
              ),
      });
    }
    return buckets.reverse();
  }
}
