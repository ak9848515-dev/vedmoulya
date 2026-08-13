// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Domain Service: Context Ranking
// Scores every context item across 5 dimensions to produce a final
// composite score. No execution decisions are made — ranking is
// purely informational for downstream assembly.
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { ContextItem, ContextPriority, ContextScore } from '../../types/context-types.js';

// ── Priority → numeric weight ───────────────────────────────────────────────

const PRIORITY_WEIGHTS: Record<ContextPriority, number> = {
  critical: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.3,
  background: 0.1,
};

// ── Default scoring weights ─────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  priority: 0.25,
  relevance: 0.3,
  freshness: 0.15,
  business: 0.15,
  confidence: 0.15,
};

// ── Service ─────────────────────────────────────────────────────────────────

export class ContextRankingService {
  /**
   * Score a single context item against the request capability.
   * Returns the 5-dimensional score with a weighted final composite.
   */
  scoreItem(
    item: ContextItem,
    requestCapability: CapabilityType,
    requestIntent?: string,
    businessContext?: string[],
    weights?: Partial<typeof DEFAULT_WEIGHTS>,
  ): ContextScore {
    const w = { ...DEFAULT_WEIGHTS, ...weights };

    const priorityScore = this.computePriorityScore(item.priority);
    const relevanceScore = this.computeRelevanceScore(item, requestCapability, requestIntent);
    const freshnessScore = this.computeFreshnessScore(item);
    const businessScore = this.computeBusinessScore(item, businessContext);
    const confidenceScore = item.confidence;

    const finalScore =
      w.priority * priorityScore +
      w.relevance * relevanceScore +
      w.freshness * freshnessScore +
      w.business * businessScore +
      w.confidence * confidenceScore;

    return {
      priorityScore,
      relevanceScore,
      freshnessScore,
      businessScore,
      confidenceScore,
      finalScore: Math.max(0, Math.min(1, finalScore)),
    };
  }

  /**
   * Score multiple items and return their scores keyed by contextId.
   */
  scoreItems(
    items: ContextItem[],
    requestCapability: CapabilityType,
    requestIntent?: string,
    businessContext?: string[],
  ): Map<string, ContextScore> {
    const scores = new Map<string, ContextScore>();
    for (const item of items) {
      scores.set(
        item.contextId,
        this.scoreItem(item, requestCapability, requestIntent, businessContext),
      );
    }
    return scores;
  }

  /**
   * Rank items by their final score (highest first).
   */
  rankItems(
    items: ContextItem[],
    scores: Map<string, ContextScore>,
    maxResults?: number,
  ): ContextItem[] {
    const sorted = [...items].sort((a, b) => {
      const scoreA = scores.get(a.contextId)?.finalScore ?? 0;
      const scoreB = scores.get(b.contextId)?.finalScore ?? 0;
      return scoreB - scoreA;
    });
    return maxResults !== undefined ? sorted.slice(0, maxResults) : sorted;
  }

  // ── Individual score components ───────────────────────────────────────────

  private computePriorityScore(priority: ContextPriority): number {
    // PRIORITY_WEIGHTS is keyed by every ContextPriority — no untrusted keys reach this lookup.
    // eslint-disable-next-line security/detect-object-injection
    return PRIORITY_WEIGHTS[priority];
  }

  /**
   * Relevance score measures how well the item's capability matches the
   * request capability, plus optional intent matching via tag overlap.
   */
  private computeRelevanceScore(
    item: ContextItem,
    requestCapability: CapabilityType,
    requestIntent?: string,
  ): number {
    // Exact capability match is the strongest signal
    const capabilityMatch = item.capability.includes(requestCapability) ? 1.0 : 0.0;

    // If the item has the matching capability, score is high
    if (capabilityMatch >= 1.0) return 0.9;

    // Partial match: check if any capability is related (same broad category)
    const partialMatch = item.capability.some((c) =>
      this.areRelatedCapabilities(c, requestCapability),
    );
    const baseScore = partialMatch ? 0.5 : 0.2;

    // Intent boost: if request intent is provided, check tag overlap
    if (requestIntent) {
      const intentWords = requestIntent.toLowerCase().split(/\s+/);
      const tagOverlap = item.tags.filter((t) =>
        intentWords.some((w) => t.toLowerCase().includes(w) || w.includes(t.toLowerCase())),
      ).length;
      const boost = Math.min(0.3, tagOverlap * 0.1);
      return Math.min(1, baseScore + boost);
    }

    return baseScore;
  }

  /**
   * Freshness score: decays from 1.0 (now) to 0.0 (beyond max age).
   * Uses a logarithmic decay so recent items are strongly favored but
   * old items still have some signal.
   */
  private computeFreshnessScore(item: ContextItem): number {
    const now = Date.now();
    const created = new Date(item.createdAt).getTime();
    const ageMs = Math.max(0, now - created);

    // Max age: 90 days (7,776,000 seconds)
    const maxAgeMs = 90 * 24 * 60 * 60 * 1000;
    const ratio = Math.min(1, ageMs / maxAgeMs);

    // Logarithmic decay: quick drop in first week, then gradual
    return Math.max(0, 1 - Math.log(1 + ratio * 9) / Math.log(10));
  }

  /**
   * Business score: how well the item's business tags align with the
   * current business context.
   */
  private computeBusinessScore(item: ContextItem, businessContext?: string[]): number {
    if (!businessContext || businessContext.length === 0) {
      return 0.5; // Neutral when no business context
    }

    const matchCount = businessContext.filter((b) =>
      item.business.some((ib) => ib.toLowerCase() === b.toLowerCase()),
    ).length;

    if (matchCount === 0) return 0.2;
    return Math.min(1, 0.3 + matchCount * 0.35);
  }

  /**
   * Check if two capabilities are broadly related (e.g., reasoning and coding).
   */
  private areRelatedCapabilities(a: CapabilityType, b: CapabilityType): boolean {
    // Related capability groups
    const groups: CapabilityType[][] = [
      ['reasoning', 'coding', 'classification'],
      ['vision', 'image_understanding'],
      ['summarization', 'content_generation', 'general_conversation'],
      ['translation', 'speech'],
      ['embeddings', 'classification'],
    ];
    return groups.some((group) => group.includes(a) && group.includes(b));
  }
}
