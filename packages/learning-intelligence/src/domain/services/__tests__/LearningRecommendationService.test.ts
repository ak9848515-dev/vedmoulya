// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Learning Recommendation Service
// EI-007 — Enterprise Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { LearningRecommendationService } from '../LearningRecommendationService.js';
import { DEFAULT_SAFETY_THRESHOLDS } from '../../rules/LearningRules.js';
import type { LearningEngines } from '../../../contracts/learning-engines.js';
import type { LearningModel } from '../../../types/learning-types.js';

const service = new LearningRecommendationService();

function model(overrides: Partial<LearningModel>): LearningModel {
  return {
    category: 'provider',
    entityType: 'provider',
    entityId: 'openai',
    entityLabel: 'OpenAI',
    sampleCount: 8,
    successCount: 7,
    failureCount: 1,
    successRate: 0.875,
    avgCostUsd: 0.01,
    avgLatencyMs: 400,
    avgAccuracy: 0.95,
    avgRetries: 0.2,
    avgQuality: 0.92,
    avgFeedback: 0.9,
    avgBusinessOutcome: 0.8,
    confidence: 0.9,
    trend: 0.1,
    lastSeen: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Engines with deterministic marketplaces for label enrichment. */
const engines: LearningEngines = {
  goals: {
    getSummary: async () => ({ success: true, data: { totalGoals: 1, activeGoals: 1 } as never }),
  },
  capabilities: {
    getMarketplace: async () => ({
      success: true,
      data: {
        capabilities: [{ id: 'research', name: 'Research' }],
        total: 1,
        activeCount: 1,
        compositionCount: 0,
        countByStatus: {} as never,
        countByCategory: {} as never,
        countByBusinessModule: {} as never,
      },
    }),
  },
  providers: {
    getMarketplace: async () => ({
      success: true,
      data: {
        providers: [{ id: 'openai', name: 'OpenAI' }],
        total: 1,
        activeCount: 1,
        healthyCount: 1,
        countByLifecycleStatus: {} as never,
        countByFamily: {} as never,
        countByCapability: {} as never,
      },
    }),
  },
  context: {
    getContextSummary: async () => ({ success: true, data: { total: 1 } as never }),
  },
  strategies: {
    getSummary: async () => ({ success: true, data: { total: 1 } as never }),
  },
  orchestrator: {
    getSummary: async () => ({ success: true, data: { totalSessions: 1 } as never }),
  },
};

describe('LearningRecommendationService — scoring', () => {
  it('scores a strong provider above a weak one', () => {
    const strong = model({
      entityId: 'openai',
      successRate: 0.95,
      avgQuality: 0.95,
      avgCostUsd: 0.005,
      avgLatencyMs: 200,
    });
    const weak = model({
      entityId: 'google',
      successRate: 0.4,
      avgQuality: 0.5,
      avgCostUsd: 0.02,
      avgLatencyMs: 2000,
    });
    expect(service.score(strong)).toBeGreaterThan(service.score(weak));
  });

  it('scores budget category without cost penalty', () => {
    const budget = model({
      category: 'budget',
      entityId: 'budget_standard',
      successRate: 0.9,
      avgQuality: 0.9,
      avgCostUsd: 100,
    });
    const score = service.score(budget);
    expect(score).toBeGreaterThan(0);
  });
});

describe('LearningRecommendationService — generateRecommendations', () => {
  it('generates all seven recommendation types from rich models', async () => {
    const models: LearningModel[] = [
      model({
        category: 'provider',
        entityId: 'openai',
        entityType: 'provider',
        entityLabel: 'OpenAI',
      }),
      model({
        category: 'context',
        entityId: 'ctx_1',
        entityType: 'context',
        entityLabel: 'Context 1',
      }),
      model({
        category: 'execution',
        entityId: 'strat_1',
        entityType: 'strategy',
        entityLabel: 'Strategy 1',
      }),
      model({
        category: 'capability',
        entityId: 'research',
        entityType: 'capability',
        entityLabel: 'Research',
      }),
      model({
        category: 'budget',
        entityId: 'budget_standard',
        entityType: 'budget',
        entityLabel: 'Standard budget',
      }),
      model({
        category: 'prompt',
        entityId: 'prompt_v2',
        entityType: 'prompt',
        entityLabel: 'Prompt v2',
      }),
      model({
        category: 'execution',
        entityId: 'hybrid',
        entityType: 'execution_pattern',
        entityLabel: 'Hybrid',
      }),
    ];
    const recommendations = await service.generateRecommendations(
      models,
      engines,
      DEFAULT_SAFETY_THRESHOLDS,
    );
    expect(recommendations).toHaveLength(7);
    const types = recommendations.map((r) => r.type).sort();
    expect(types).toEqual([
      'best_budget',
      'best_capability',
      'best_context',
      'best_execution_pattern',
      'best_prompt',
      'best_provider',
      'best_strategy',
    ]);
    for (const recommendation of recommendations) {
      expect(recommendation.status).toBe('pending');
      expect(recommendation.version).toBe(1);
      expect(recommendation.sampleCount).toBe(8);
      expect(recommendation.rationale.length).toBeGreaterThan(0);
      expect(recommendation.recommendationId).toContain(recommendation.type);
    }
  });

  it('skips categories below the minimum sample threshold', async () => {
    const models: LearningModel[] = [
      model({ category: 'provider', entityId: 'openai', sampleCount: 2 }),
    ];
    const recommendations = await service.generateRecommendations(
      models,
      engines,
      DEFAULT_SAFETY_THRESHOLDS,
    );
    expect(recommendations).toHaveLength(0);
  });

  it('enriches provider and capability labels from the live registries', async () => {
    const models: LearningModel[] = [
      model({ category: 'provider', entityId: 'openai', entityLabel: '' }),
      model({
        category: 'capability',
        entityType: 'capability',
        entityId: 'research',
        entityLabel: '',
      }),
    ];
    const recommendations = await service.generateRecommendations(
      models,
      engines,
      DEFAULT_SAFETY_THRESHOLDS,
    );
    const provider = recommendations.find((r) => r.type === 'best_provider');
    const capability = recommendations.find((r) => r.type === 'best_capability');
    expect(provider?.targetEntity.entityLabel).toBe('OpenAI');
    expect(capability?.targetEntity.entityLabel).toBe('Research');
  });

  it('survives engine failures (label enrichment is best-effort)', async () => {
    const failingEngines: LearningEngines = {
      ...engines,
      providers: { getMarketplace: async () => ({ success: false, error: 'down' }) },
      capabilities: {
        getMarketplace: async () => {
          throw new Error('boom');
        },
      },
    };
    const models: LearningModel[] = [
      model({ category: 'provider', entityId: 'openai', entityLabel: 'OpenAI' }),
    ];
    const recommendations = await service.generateRecommendations(
      models,
      failingEngines,
      DEFAULT_SAFETY_THRESHOLDS,
    );
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.targetEntity.entityLabel).toBe('OpenAI');
  });

  it('sorts recommendations by value descending', async () => {
    const models: LearningModel[] = [
      model({ category: 'provider', entityId: 'openai', successRate: 0.95 }),
      model({ category: 'provider', entityId: 'anthropic', successRate: 0.7 }),
    ];
    const recommendations = await service.generateRecommendations(
      models,
      engines,
      DEFAULT_SAFETY_THRESHOLDS,
    );
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.targetEntity.entityId).toBe('openai');
  });

  it('describes budgets with the observed average', async () => {
    const models: LearningModel[] = [
      model({
        category: 'budget',
        entityType: 'budget',
        entityId: 'budget_standard',
        entityLabel: 'Standard',
        avgCostUsd: 0.55,
      }),
    ];
    const recommendations = await service.generateRecommendations(
      models,
      engines,
      DEFAULT_SAFETY_THRESHOLDS,
    );
    expect(recommendations[0]?.description).toContain('0.5500');
  });
});
