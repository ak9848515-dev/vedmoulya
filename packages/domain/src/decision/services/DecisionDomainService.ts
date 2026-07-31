// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Domain Service
// ARC-003/ARC-004 — Domain operations for decision lifecycle,
// scoring, ranking, and recommendation logic
// ──────────────────────────────────────────────────────────────────

import type { DecisionRepository } from '../repository/DecisionRepository.js';
import type { Decision } from '../entities/Decision.js';
import type { DecisionOption } from '../entities/Decision.js';
import { DecisionConfidence } from '../value-objects/DecisionConfidence.js';
import { DecisionPriority } from '../value-objects/DecisionPriority.js';

export interface DomainOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface OptionRanking {
  optionId: string;
  label: string;
  score: number;
  riskLevel: string;
  opportunityLevel: string;
  rank: number;
}

export interface Recommendation {
  decisionId: string;
  title: string;
  recommendedOptionId: string;
  recommendedOptionLabel: string;
  confidence: number;
  reasons: string[];
}

export interface TradeoffAnalysis {
  optionA: string;
  optionB: string;
  scoreDiff: number;
  riskDiff: number;
  opportunityDiff: number;
  recommendation: string;
}

/**
 * DecisionDomainService — domain service for decision operations.
 * Implements scoring, ranking, recommendation, and analysis logic.
 */
export class DecisionDomainService {
  private readonly repository: DecisionRepository;

  constructor(repository: DecisionRepository) {
    this.repository = repository;
  }

  /** Score and rank all options for a decision */
  rankOptions(decision: Decision): DomainOperationResult<OptionRanking[]> {
    try {
      const options = decision.getRankedOptions();
      if (options.length === 0) {
        return { success: true, data: [] };
      }

      const rankings: OptionRanking[] = options
        .filter(
          (o): o is DecisionOption & { score: NonNullable<DecisionOption['score']> } =>
            o.score !== undefined,
        )
        .map((option, index) => ({
          optionId: option.id,
          label: option.label,
          score: option.score.overall,
          riskLevel: option.risk?.level ?? 'unknown',
          opportunityLevel: option.opportunity?.level ?? 'unknown',
          rank: index + 1,
        }));

      return { success: true, data: rankings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ranking error',
      };
    }
  }

  /** Generate a recommendation based on scoring and risk assessment */
  recommend(decision: Decision): DomainOperationResult<Recommendation> {
    try {
      const ranked = decision.getRankedOptions();
      if (ranked.length === 0) {
        return { success: false, error: 'No scored options to recommend from' };
      }

      // Score-based with risk penalty
      const scored = ranked.map((option) => {
        const score = option.score?.overall ?? 0;
        const riskPenalty = option.risk?.isCritical()
          ? score * 0.5
          : option.risk?.score
            ? score * 0.1
            : 0;
        const opportunityBonus = option.opportunity?.isSignificant() ? score * 0.2 : 0;
        return { option, adjustedScore: score - riskPenalty + opportunityBonus };
      });

      scored.sort((a, b) => b.adjustedScore - a.adjustedScore);
      const best = scored[0] as { option: DecisionOption; adjustedScore: number };

      const reasons: string[] = [];
      if (best.option.score) {
        reasons.push(`Highest overall score: ${String(best.option.score.overall)}/10`);
      }
      if (best.option.risk?.isAcceptable()) {
        reasons.push('Acceptable risk level');
      }
      if (best.option.opportunity?.isSignificant()) {
        reasons.push('Significant opportunity');
      }

      const confidence = DecisionConfidence.fromScore(
        scored.length > 1
          ? (best.adjustedScore -
              (scored[1] as { option: DecisionOption; adjustedScore: number }).adjustedScore) /
              10 +
              0.5
          : 0.7,
      );

      return {
        success: true,
        data: {
          decisionId: decision.id,
          title: decision.title,
          recommendedOptionId: best.option.id,
          recommendedOptionLabel: best.option.label,
          confidence: confidence.score,
          reasons,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Recommendation error',
      };
    }
  }

  /** Compare two options and provide trade-off analysis */
  compareOptions(
    decision: Decision,
    optionAId: string,
    optionBId: string,
  ): DomainOperationResult<TradeoffAnalysis> {
    try {
      const optionA = decision.options.find((o) => o.id === optionAId);
      const optionB = decision.options.find((o) => o.id === optionBId);

      if (!optionA || !optionB) {
        return { success: false, error: 'One or both options not found' };
      }

      const scoreDiff = (optionA.score?.overall ?? 0) - (optionB.score?.overall ?? 0);
      const riskDiff = (optionA.risk?.score ?? 0) - (optionB.risk?.score ?? 0);
      const opportunityDiff = (optionA.opportunity?.score ?? 0) - (optionB.opportunity?.score ?? 0);

      let recommendation: string;
      if (Math.abs(scoreDiff) > 2) {
        recommendation =
          scoreDiff > 0
            ? `Option A (${optionA.label}) has significantly higher score`
            : `Option B (${optionB.label}) has significantly higher score`;
      } else if (riskDiff < -1) {
        recommendation = `Option B (${optionB.label}) has lower risk`;
      } else if (opportunityDiff > 1) {
        recommendation = `Option A (${optionA.label}) has higher opportunity`;
      } else {
        recommendation = 'Options are comparable — further analysis recommended';
      }

      return {
        success: true,
        data: {
          optionA: optionA.label,
          optionB: optionB.label,
          scoreDiff: Math.round(scoreDiff * 10) / 10,
          riskDiff: Math.round(riskDiff * 10) / 10,
          opportunityDiff: Math.round(opportunityDiff * 10) / 10,
          recommendation,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compare error',
      };
    }
  }

  /** Calculate decision confidence based on evidence, reasoning, and constraints */
  static calculateConfidence(decision: Decision): DecisionConfidence {
    let score = 0.3; // Base

    // Evidence quality
    score += Math.min(0.2, decision.evidence.length * 0.05);

    // Reasoning completeness
    if (decision.reasoning) {
      score += 0.15;
      if (decision.reasoning.pros.length > 0) score += 0.05;
      if (decision.reasoning.cons.length > 0) score += 0.05;
    }

    // Multiple options
    if (decision.options.length >= 3) score += 0.1;
    else if (decision.options.length >= 2) score += 0.05;

    // Priority boost
    if (decision.priority.isAtLeast('high')) score += 0.1;

    // Knowledge Graph linkage
    if (decision.knowledgeNodeIds.length > 0) score += 0.05;

    // Memory references
    if (decision.memoryIds.length > 0) score += 0.05;

    return DecisionConfidence.fromScore(Math.min(1, score));
  }

  /** Calculate priority based on urgency and impact factors */
  static calculatePriority(params: {
    urgency: number; // 0–10
    impact: number; // 0–10
    timeSensitivity: number; // 0–10
    strategicAlignment: number; // 0–10
    stakeholderPressure: number; // 0–10
  }): DecisionPriority {
    const score =
      Math.round(
        (params.urgency * 0.3 +
          params.impact * 0.25 +
          params.timeSensitivity * 0.2 +
          params.strategicAlignment * 0.15 +
          params.stakeholderPressure * 0.1) *
          10,
      ) / 10;
    return DecisionPriority.fromScore(score);
  }
}
