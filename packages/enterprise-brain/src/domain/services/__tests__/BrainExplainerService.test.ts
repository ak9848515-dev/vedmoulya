// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Enterprise Brain Explainer
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Every decision must include WHY, EVIDENCE, CONFIDENCE, TRADE-OFFS,
// ALTERNATIVES, and RISKS — this suite pins that explainability
// contract for every one of the 14 decision types.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { BrainExplainerService } from '../BrainExplainerService.js';
import type { BrainEngineSnapshot } from '../BrainDecisionService.js';
import { BRAIN_DECISION_TYPES } from '../../../types/brain-types.js';

function snapshot(overrides: Partial<BrainEngineSnapshot> = {}): BrainEngineSnapshot {
  return {
    goal: undefined,
    tasks: [],
    learning: undefined,
    learningRecommendations: [],
    learningModels: [],
    capabilities: undefined,
    providers: undefined,
    context: undefined,
    strategies: undefined,
    orchestrator: undefined,
    ...overrides,
  };
}

describe('BrainExplainerService', () => {
  const service = new BrainExplainerService();

  it('produces a complete explanation for every decision type', () => {
    for (const type of BRAIN_DECISION_TYPES) {
      const reason = service.explain(type, undefined, snapshot(), {
        entityLabel: 'recommended entity',
        params: {},
      });
      expect(reason.why.length).toBeGreaterThan(0);
      expect(reason.evidence.length).toBeGreaterThan(0);
      expect(reason.tradeoffs.length).toBeGreaterThan(0);
      expect(reason.alternatives.length).toBeGreaterThan(0);
      expect(reason.risks.length).toBeGreaterThan(0);
    }
  });

  it('cites engine evidence when engines are present', () => {
    const reason = service.explain(
      'provider_selection',
      undefined,
      snapshot({
        providers: {
          providers: [],
          total: 0,
          activeCount: 0,
          healthyCount: 3,
          countByLifecycleStatus: {},
          countByFamily: {},
          countByCapability: {},
        },
        learningRecommendations: [
          {
            recommendationId: 'rec_1',
            type: 'best_provider',
            category: 'provider',
            title: 'Best Provider',
            description: '',
            targetEntity: { entityType: 'provider', entityId: 'openai', entityLabel: 'OpenAI' },
            value: 0.9,
            confidence: 0.9,
            sampleCount: 10,
            status: 'pending',
            version: 1,
            rationale: [],
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      }),
      { entityLabel: 'OpenAI', params: {} },
    );
    const all = [...reason.evidence, ...reason.why].join(' ');
    expect(all).toContain('Learning Intelligence recommends');
    expect(all).toContain('OpenAI');
  });

  it('surfaces registry availability in the evidence', () => {
    const withRegistry = service.explain(
      'capability_selection',
      undefined,
      snapshot({
        capabilities: {
          capabilities: [],
          total: 13,
          activeCount: 11,
          compositionCount: 0,
          countByStatus: {},
          countByCategory: {},
          countByBusinessModule: {},
        },
      }),
      { entityLabel: 'Research', params: {} },
    );
    expect(withRegistry.evidence.join(' ')).toContain('Capability Registry consulted');
    expect(withRegistry.evidence.join(' ')).toContain('13');
  });

  it('uses goal classification for risk explanations', () => {
    const reason = service.explain(
      'risk_assessment',
      {
        goalId: 'goal_x',
        title: 'Blog goal',
        description: '',
        category: 'business',
        business: ['blog'],
        priority: 'high',
        urgency: 0.5,
        importance: 0.9,
        complexity: 'standard',
        estimatedEffort: 5,
        status: 'active',
        confidence: 0.9,
        goalScore: 0.8,
        successCriteria: [],
        milestones: [],
        dependencies: [],
        childGoalIds: [],
        tags: [],
        classification: {
          businessDomain: [],
          requiredCapabilities: ['research'],
          requiredContext: [],
          riskScore: 0.4,
          riskLevel: 'medium',
          complexity: 'standard',
          estimatedTokenRange: { min: 100, max: 1000 },
          estimatedCostRangeUsd: { min: 0.5, max: 1 },
        },
        events: [],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      snapshot(),
      { entityLabel: 'medium risk posture', params: {} },
    );
    expect(reason.evidence.join(' ')).toContain('medium');
  });

  it('explains budget from the goal cost classification', () => {
    const reason = service.explain(
      'budget_strategy',
      {
        goalId: 'goal_x',
        title: 'Blog goal',
        description: '',
        category: 'business',
        business: [],
        priority: 'medium',
        urgency: 0.5,
        importance: 0.5,
        complexity: 'standard',
        estimatedEffort: 5,
        status: 'active',
        confidence: 0.9,
        goalScore: 0.8,
        successCriteria: [],
        milestones: [],
        dependencies: [],
        childGoalIds: [],
        tags: [],
        classification: {
          businessDomain: [],
          requiredCapabilities: [],
          requiredContext: [],
          riskScore: 0.5,
          riskLevel: 'medium',
          complexity: 'standard',
          estimatedTokenRange: { min: 100, max: 1000 },
          estimatedCostRangeUsd: { min: 0.5, max: 1 },
        },
        events: [],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      snapshot(),
      { entityLabel: 'envelope', params: {} },
    );
    expect(reason.evidence.join(' ')).toContain('$0.5');
  });
});
