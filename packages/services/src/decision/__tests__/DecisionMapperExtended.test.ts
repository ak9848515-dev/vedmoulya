// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — DecisionMapper extended unit tests
// Covers toOptionDTO / toEvidenceDTO with optional fields and the
// passthrough DTO helpers (toRankingDTO, toRecommendationDTO, toTradeoffDTO).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { DecisionScore } from '@vedmoulya/domain';
import { DecisionMapper } from '../DecisionMapper.js';

describe('DecisionMapper.toOptionDTO', () => {
  it('maps a fully-scored option with risk and opportunity', () => {
    const score = DecisionScore.compute([{ criterion: 'cost', score: 8, weight: 0.5 }]);
    const dto = DecisionMapper.toOptionDTO({
      id: 'opt-1',
      label: 'Option A',
      description: 'Desc',
      score,
      risk: {
        level: 'medium',
        score: 5,
        description: 'Some risk',
        mitigation: 'Mitigate',
      },
      opportunity: {
        level: 'high',
        score: 8,
        description: 'Big upside',
        expectedValue: '1000',
      },
      pros: ['p1'],
      cons: ['c1'],
      estimatedEffort: '3 days',
      estimatedCost: '$500',
    } as never);
    expect(dto.id).toBe('opt-1');
    expect(dto.score?.overall).toBe(score.overall);
    expect(dto.score?.criteria[0]?.criterion).toBe('cost');
    expect(dto.risk?.level).toBe('medium');
    expect(dto.opportunity?.level).toBe('high');
    expect(dto.pros).toEqual(['p1']);
    expect(dto.cons).toEqual(['c1']);
    expect(dto.estimatedEffort).toBe('3 days');
    expect(dto.estimatedCost).toBe('$500');
  });

  it('omits score, risk, and opportunity when absent', () => {
    const dto = DecisionMapper.toOptionDTO({
      id: 'opt-2',
      label: 'Option B',
      description: 'Desc',
      pros: [],
      cons: [],
    } as never);
    expect(dto.score).toBeUndefined();
    expect(dto.risk).toBeUndefined();
    expect(dto.opportunity).toBeUndefined();
    expect(dto.estimatedEffort).toBeUndefined();
    expect(dto.estimatedCost).toBeUndefined();
  });
});

describe('DecisionMapper.toEvidenceDTO', () => {
  it('maps evidence fields', () => {
    const when = new Date('2026-01-01T00:00:00Z');
    const dto = DecisionMapper.toEvidenceDTO({
      id: 'ev-1',
      type: 'document',
      source: 'source.md',
      content: 'content',
      relevanceScore: 0.9,
      timestamp: when,
    } as never);
    expect(dto.id).toBe('ev-1');
    expect(dto.type).toBe('document');
    expect(dto.relevanceScore).toBe(0.9);
    expect(dto.timestamp).toBe(when.toISOString());
  });
});

describe('DecisionMapper passthrough DTOs', () => {
  it('toRankingDTO passes rankings through', () => {
    const rankings = [
      { optionId: 'o1', label: 'A', score: 8, riskLevel: 'low', opportunityLevel: 'high', rank: 1 },
    ];
    expect(DecisionMapper.toRankingDTO(rankings)).toEqual(rankings);
  });

  it('toRecommendationDTO passes the recommendation through', () => {
    const recommendation = {
      decisionId: 'd1',
      title: 'T',
      recommendedOptionId: 'o1',
      recommendedOptionLabel: 'A',
      confidence: 0.8,
      reasons: ['r'],
    };
    expect(DecisionMapper.toRecommendationDTO(recommendation)).toEqual(recommendation);
  });

  it('toTradeoffDTO passes the tradeoff through', () => {
    const tradeoff = {
      optionA: 'A',
      optionB: 'B',
      scoreDiff: 1,
      riskDiff: 2,
      opportunityDiff: 3,
      recommendation: 'Pick A',
    };
    expect(DecisionMapper.toTradeoffDTO(tradeoff)).toEqual(tradeoff);
  });
});
