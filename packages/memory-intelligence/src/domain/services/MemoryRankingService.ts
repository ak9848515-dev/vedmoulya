// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Ranking Service
// EI-010 — Enterprise Memory Intelligence Platform
// The Memory Pipeline stage: Ranking. Produces the composite retrieval
// score for each memory — the weighted blend of importance, confidence,
// recency, frequency, and retention urgency that the Retrieval Console
// sorts by. Pure function over a memory item (no persistence).
// ──────────────────────────────────────────────────────────────────

import type { MemoryItem } from '../../types/memory-types.js';

export interface MemoryRankingWeights {
  importance: number;
  confidence: number;
  recency: number;
  frequency: number;
}

export const DEFAULT_MEMORY_RANKING_WEIGHTS: MemoryRankingWeights = {
  importance: 0.4,
  confidence: 0.2,
  recency: 0.25,
  frequency: 0.15,
};

export interface RankedMemory {
  memory: MemoryItem;
  score: number;
  contributions: Array<{ factor: string; weight: number; value: number }>;
}

export class MemoryRankingService {
  private readonly weights: MemoryRankingWeights;

  constructor(weights: MemoryRankingWeights = DEFAULT_MEMORY_RANKING_WEIGHTS) {
    this.weights = weights;
  }

  /** Normalize the weights to sum to 1 (defensive against bad input). */
  private normalized(): MemoryRankingWeights {
    const total =
      this.weights.importance +
      this.weights.confidence +
      this.weights.recency +
      this.weights.frequency;
    if (total <= 0) return DEFAULT_MEMORY_RANKING_WEIGHTS;
    return {
      importance: this.weights.importance / total,
      confidence: this.weights.confidence / total,
      recency: this.weights.recency / total,
      frequency: this.weights.frequency / total,
    };
  }

  /**
   * Rank one memory: importance · w_i + confidence · w_c +
   * recency · w_r + frequencyNormalized · w_f.
   * Frequency is normalized to [0, 1] by a saturating curve so runaway
   * reinforcement cannot dominate the ranking.
   */
  rank(memory: MemoryItem): RankedMemory {
    const w = this.normalized();
    const frequency = Math.max(0, Math.min(1, memory.usage.frequency / 10));
    const contributions = [
      { factor: 'importance', weight: w.importance, value: memory.importance.score },
      { factor: 'confidence', weight: w.confidence, value: memory.confidence.score },
      { factor: 'recency', weight: w.recency, value: memory.usage.recency },
      { factor: 'frequency', weight: w.frequency, value: frequency },
    ];
    const score = contributions.reduce((sum, c) => sum + c.weight * c.value, 0);
    return { memory, score: Math.max(0, Math.min(1, score)), contributions };
  }

  /** Rank a list, descending score (used by the Retrieval Console). */
  rankAll(memories: MemoryItem[]): RankedMemory[] {
    return memories.map((memory) => this.rank(memory)).sort((a, b) => b.score - a.score);
  }
}
