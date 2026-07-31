// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Mapper
// Domain-to-DTO mapping for the Decision Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { Decision } from '@vedmoulya/domain';
import type {
  DecisionDTO,
  DecisionListDTO,
  DecisionStatsDTO,
  DecisionOptionDTO,
  DecisionEvidenceDTO,
  RankingDTO,
  RecommendationDTO,
  TradeoffDTO,
  DecisionContractEvent,
} from './DecisionDTO.js';

export const DecisionMapper = {
  /** Map a Decision entity to a DecisionDTO */
  toDTO(decision: Decision): DecisionDTO {
    return {
      id: decision.id,
      title: decision.title,
      description: decision.description,
      category: decision.category,
      status: decision.status.toString(),
      priority: { level: decision.priority.level, score: decision.priority.score },
      confidence: { level: decision.confidence.level, score: decision.confidence.score },
      version: decision.version.label,
      initiator: decision.initiator,
      request: decision.request
        ? {
            requester: decision.request.requester,
            reason: decision.request.reason,
            context: decision.request.context,
          }
        : undefined,
      options: decision.options.map((o) => DecisionMapper.toOptionDTO(o)),
      selectedOptionId: decision.selectedOptionId,
      evidence: decision.evidence.map((e) => DecisionMapper.toEvidenceDTO(e)),
      constraints: decision.constraints.map((c) => c.toString()),
      reasoning: decision.reasoning
        ? {
            method: decision.reasoning.method,
            summary: decision.reasoning.summary,
            assumptions: [...decision.reasoning.assumptions],
            pros: [...decision.reasoning.pros],
            cons: [...decision.reasoning.cons],
          }
        : undefined,
      outcome: decision.outcome
        ? {
            result: decision.outcome.result,
            description: decision.outcome.description,
            actualImpact: decision.outcome.actualImpact,
            lessons: decision.outcome.lessons ? [...decision.outcome.lessons] : undefined,
          }
        : undefined,
      knowledgeNodeIds: [...decision.knowledgeNodeIds],
      memoryIds: [...decision.memoryIds],
      tags: [...decision.tags],
      createdAt: decision.createdAt.toISOString(),
      updatedAt: decision.updatedAt.toISOString(),
      completedAt: decision.completedAt?.toISOString(),
    };
  },

  /** Map a DecisionOption to OptionDTO */
  toOptionDTO(option: import('@vedmoulya/domain').Decision['options'][number]): DecisionOptionDTO {
    return {
      id: option.id,
      label: option.label,
      description: option.description,
      score: option.score
        ? {
            overall: option.score.overall,
            criteria: option.score.criteria.map((c) => ({
              criterion: c.criterion,
              score: c.score,
              weight: c.weight,
              weightedScore: c.weightedScore,
            })),
          }
        : undefined,
      risk: option.risk
        ? {
            level: option.risk.level,
            score: option.risk.score,
            description: option.risk.description,
            mitigation: option.risk.mitigation,
          }
        : undefined,
      opportunity: option.opportunity
        ? {
            level: option.opportunity.level,
            score: option.opportunity.score,
            description: option.opportunity.description,
            expectedValue: option.opportunity.expectedValue,
          }
        : undefined,
      pros: [...option.pros],
      cons: [...option.cons],
      estimatedEffort: option.estimatedEffort,
      estimatedCost: option.estimatedCost,
    };
  },

  /** Map DecisionEvidence to EvidenceDTO */
  toEvidenceDTO(
    evidence: import('@vedmoulya/domain').Decision['evidence'][number],
  ): DecisionEvidenceDTO {
    return {
      id: evidence.id,
      type: evidence.type,
      source: evidence.source,
      content: evidence.content,
      relevanceScore: evidence.relevanceScore,
      timestamp: evidence.timestamp.toISOString(),
    };
  },

  /** Map paginated results to DecisionListDTO */
  toListDTO(data: Decision[], total: number, page: number, limit: number): DecisionListDTO {
    return {
      data: data.map((d) => DecisionMapper.toDTO(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /** Map stats to DecisionStatsDTO */
  toStatsDTO(params: {
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    linkedCount: number;
  }): DecisionStatsDTO {
    return params;
  },

  /** Map rankings to DTO */
  toRankingDTO(
    rankings: Array<{
      optionId: string;
      label: string;
      score: number;
      riskLevel: string;
      opportunityLevel: string;
      rank: number;
    }>,
  ): RankingDTO[] {
    return rankings;
  },

  /** Map recommendation to DTO */
  toRecommendationDTO(recommendation: {
    decisionId: string;
    title: string;
    recommendedOptionId: string;
    recommendedOptionLabel: string;
    confidence: number;
    reasons: string[];
  }): RecommendationDTO {
    return recommendation;
  },

  /** Map tradeoff analysis to DTO */
  toTradeoffDTO(tradeoff: {
    optionA: string;
    optionB: string;
    scoreDiff: number;
    riskDiff: number;
    opportunityDiff: number;
    recommendation: string;
  }): TradeoffDTO {
    return tradeoff;
  },

  /** Map a Decision entity to a contract event */
  toContractEvent(decision: Decision, eventType: string): DecisionContractEvent {
    return {
      type: `decision.${eventType}` as DecisionContractEvent['type'],
      decisionId: decision.id,
      timestamp: new Date().toISOString(),
      data: {
        title: decision.title,
        category: decision.category,
        status: decision.status.toString(),
        confidence: decision.confidence.score,
      },
    };
  },
};
