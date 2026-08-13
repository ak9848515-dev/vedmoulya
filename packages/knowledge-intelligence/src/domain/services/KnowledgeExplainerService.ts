// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Explainer Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Explainability is a hard requirement for the Knowledge Layer: every
// item must be able to explain WHY it is trusted and WHY it ranks
// where it does. This pure service derives the `KnowledgeExplanation`
// from the item's trust factors, confidence factors, and composite
// ranking contributions — deterministic, no I/O.
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeExplanation, KnowledgeItem } from '../../types/knowledge-types.js';
import { KnowledgeRankingService } from './KnowledgeRankingService.js';

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export class KnowledgeExplainerService {
  private readonly ranking: KnowledgeRankingService;

  constructor(ranking: KnowledgeRankingService = new KnowledgeRankingService()) {
    this.ranking = ranking;
  }

  /** Explain one item: why it is trusted and why it ranks where it does. */
  explain(item: KnowledgeItem): KnowledgeExplanation {
    const ranked = this.ranking.rankOne(item);
    const trustLevel = item.trust.level.toUpperCase();
    const validation = item.validationStatus;

    const why =
      `"${item.title}" is ${trustLevel} trust (${round(item.trust.score)}) from a ${item.sourceType} source, ` +
      `${validation} validation, ${item.citations.length} citation(s), ${item.consumers.length} consumer(s), ` +
      `${item.usage.totalReads} read(s), and ranks ${round(ranked.score)} on the composite knowledge score.`;

    return {
      knowledgeId: item.knowledgeId,
      title: item.title,
      why,
      trustFactors: [...item.trust.factors],
      confidenceFactors: [...item.confidence.factors],
      rankingScore: ranked.score,
      rankingContributions: ranked.contributions,
      retrievedAt: new Date().toISOString(),
    };
  }
}
