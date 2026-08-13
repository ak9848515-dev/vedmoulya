// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Analytics Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Pure aggregation over the registry: totals, per-category /
// per-source / per-lifecycle / per-validation counts, trust
// distribution bands, top-consumed items, top consumers, and a
// zero-filled 14-day creation trend. No I/O — deterministic and fully
// unit-testable (same convention as BrainMetricsService).
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below indexes closed-union records (categories /
   source types / lifecycle / validation from the domain constants) — never
   attacker-controlled input. */

import type {
  KnowledgeAnalytics,
  KnowledgeCategory,
  KnowledgeConsumer,
  KnowledgeItem,
  KnowledgeLifecycleStatus,
  KnowledgeSourceType,
  KnowledgeTrendPoint,
  KnowledgeValidationStatus,
} from '../../types/knowledge-types.js';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_LIFECYCLE_STATUSES,
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_VALIDATION_STATUSES,
} from '../../types/knowledge-types.js';

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export class KnowledgeAnalyticsService {
  /** Aggregate the registry into KnowledgeAnalytics. */
  aggregate(items: readonly KnowledgeItem[], days = 14): KnowledgeAnalytics {
    const byCategory = {} as Record<KnowledgeCategory, number>;
    for (const category of KNOWLEDGE_CATEGORIES) byCategory[category] = 0;

    const bySourceType = {} as Record<KnowledgeSourceType, number>;
    for (const sourceType of KNOWLEDGE_SOURCE_TYPES) bySourceType[sourceType] = 0;

    const byLifecycle = {} as Record<KnowledgeLifecycleStatus, number>;
    for (const status of KNOWLEDGE_LIFECYCLE_STATUSES) byLifecycle[status] = 0;

    const byValidation = {} as Record<KnowledgeValidationStatus, number>;
    for (const status of KNOWLEDGE_VALIDATION_STATUSES) byValidation[status] = 0;

    let trustSum = 0;
    let confidenceSum = 0;
    let totalReads = 0;
    let citations = 0;
    let relationships = 0;
    let consumers = 0;
    const allConsumers: KnowledgeConsumer[] = [];

    for (const item of items) {
      byCategory[item.category] += 1;
      bySourceType[item.sourceType] += 1;
      byLifecycle[item.lifecycleStatus] += 1;
      byValidation[item.validationStatus] += 1;
      trustSum += item.trust.score;
      confidenceSum += item.confidence.score;
      totalReads += item.usage.totalReads;
      citations += item.citations.length;
      relationships += item.relationships.length;
      consumers += item.consumers.length;
      allConsumers.push(...item.consumers);
    }

    const consumerCounts = new Map<string, KnowledgeConsumer>();
    for (const consumer of allConsumers) {
      const existing = consumerCounts.get(consumer.consumerId);
      if (existing) {
        existing.usageCount += consumer.usageCount;
      } else {
        consumerCounts.set(consumer.consumerId, { ...consumer });
      }
    }

    const usageTop = [...items]
      .sort((a, b) => b.usage.totalReads - a.usage.totalReads)
      .slice(0, 10)
      .map((item) => ({
        knowledgeId: item.knowledgeId,
        title: item.title,
        reads: item.usage.totalReads,
        trust: item.trust.score,
      }));

    const consumersTop = [...consumerCounts.values()]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10)
      .map((c) => ({
        consumerId: c.consumerId,
        consumerType: c.consumerType,
        consumerLabel: c.consumerLabel,
        usageCount: c.usageCount,
      }));

    return {
      totals: {
        items: items.length,
        active: byLifecycle.active,
        validated: byValidation.validated,
        relationships,
        citations,
        consumers,
        totalReads,
        avgTrust: round(items.length > 0 ? trustSum / items.length : 0),
        avgConfidence: round(items.length > 0 ? confidenceSum / items.length : 0),
      },
      byCategory,
      bySourceType,
      byLifecycle,
      byValidation,
      trustDistribution: this.trustDistribution(items),
      usageTop,
      consumersTop,
      trend: this.trend(items, days),
    };
  }

  /** Zero-filled daily buckets (oldest → newest). */
  trend(items: readonly KnowledgeItem[], days = 14): KnowledgeTrendPoint[] {
    const now = new Date();
    const buckets: KnowledgeTrendPoint[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const day = new Date(now.getTime() - offset * 86_400_000);
      const key = day.toISOString().slice(0, 10);
      const dayItems = items.filter((item) => item.createdAt.slice(0, 10) === key);
      buckets.push({
        date: key,
        items: dayItems.length,
        active: dayItems.filter((item) => item.lifecycleStatus === 'active').length,
      });
    }
    return buckets;
  }

  /** Four trust bands: low (<0.5), medium (0.5–0.7), strong (0.7–0.85), high (≥0.85). */
  trustDistribution(items: readonly KnowledgeItem[]): Array<{ band: string; count: number }> {
    const counts = { low: 0, medium: 0, strong: 0, high: 0 };
    for (const item of items) {
      const score = item.trust.score;
      if (score < 0.5) counts.low += 1;
      else if (score < 0.7) counts.medium += 1;
      else if (score < 0.85) counts.strong += 1;
      else counts.high += 1;
    }
    return [
      { band: 'low', count: counts.low },
      { band: 'medium', count: counts.medium },
      { band: 'strong', count: counts.strong },
      { band: 'high', count: counts.high },
    ];
  }
}
