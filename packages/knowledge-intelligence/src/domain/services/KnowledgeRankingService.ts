// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Ranking Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Ranks knowledge items by a composite score so searches, explorers,
// and the Trust Dashboard present the most reliable, most relevant,
// most used knowledge first. Deterministic and pure.
//
//   composite = 0.5·trust + 0.2·confidence + 0.15·usage + 0.15·recency
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeItem } from '../../types/knowledge-types.js';

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export interface RankedKnowledgeItem {
  item: KnowledgeItem;
  /** Composite ranking score in [0, 1]. */
  score: number;
  contributions: Array<{ factor: string; weight: number; value: number }>;
}

export class KnowledgeRankingService {
  /** Rank items descending by composite score. */
  rank(items: readonly KnowledgeItem[]): RankedKnowledgeItem[] {
    return items.map((item) => this.rankOne(item)).sort((a, b) => b.score - a.score);
  }

  /** Composite score for one item with per-factor contributions (for Explain). */
  rankOne(item: KnowledgeItem): RankedKnowledgeItem {
    const usage = clamp01(Math.log1p(item.usage.totalReads) / Math.log(11));
    const ageDays = Math.max(0, (Date.now() - new Date(item.updatedAt).getTime()) / 86_400_000);
    const recency = clamp01(1 - ageDays / 365);

    const trust = item.trust.score;
    const confidence = item.confidence.score;

    const score = round(clamp01(0.5 * trust + 0.2 * confidence + 0.15 * usage + 0.15 * recency));
    return {
      item,
      score,
      contributions: [
        { factor: 'trust', weight: 0.5, value: round(trust) },
        { factor: 'confidence', weight: 0.2, value: round(confidence) },
        { factor: 'usage', weight: 0.15, value: round(usage) },
        { factor: 'recency', weight: 0.15, value: round(recency) },
      ],
    };
  }

  /** The highest-trusted items (for the Trust Dashboard / top-trusted lists). */
  topByTrust(items: readonly KnowledgeItem[], limit = 10): KnowledgeItem[] {
    return [...items]
      .sort((a, b) => b.trust.score - a.trust.score || b.usage.totalReads - a.usage.totalReads)
      .slice(0, limit);
  }

  /** The most-consumed items (for the Consumers / Analytics views). */
  topByConsumption(items: readonly KnowledgeItem[], limit = 10): KnowledgeItem[] {
    return [...items]
      .sort(
        (a, b) =>
          b.usage.totalReads - a.usage.totalReads || b.consumers.length - a.consumers.length,
      )
      .slice(0, limit);
  }
}
