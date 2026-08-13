// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: In-Memory Enterprise Brain Repository
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { InMemoryBrainRepository } from '../InMemoryBrainRepository.js';
import { createCatalogBrainPlan } from '../../catalog/brain-catalog.js';
import type { BrainDecision, BrainDecisionPlan } from '../../types/brain-types.js';

function decision(overrides: Partial<BrainDecision> = {}): BrainDecision {
  return {
    decisionId: 'bd_test',
    planId: 'plan_test',
    goalId: 'goal_test',
    type: 'provider_selection',
    title: 'Provider Selection',
    description: '',
    recommendation: {
      entityType: 'provider',
      entityId: 'openai',
      entityLabel: 'OpenAI',
      action: 'use',
      params: {},
    },
    confidence: { score: 0.8, level: 'high', factors: [] },
    reason: { why: '', evidence: [], tradeoffs: [], alternatives: [], risks: [] },
    context: {
      goalId: 'goal_test',
      goalTitle: 'G',
      goalCategory: 'business',
      goalPriority: 'high',
      business: [],
      engineSources: [],
      observedAt: '2026-08-01T00:00:00.000Z',
    },
    status: 'proposed',
    version: 1,
    actor: 'enterprise-brain',
    history: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function plan(overrides: Partial<BrainDecisionPlan> = {}): BrainDecisionPlan {
  return {
    planId: 'plan_test',
    goalId: 'goal_test',
    goalTitle: 'G',
    status: 'proposed',
    decisions: [decision()],
    overallConfidence: 0.8,
    pipeline: [],
    version: 1,
    actor: 'enterprise-brain',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryBrainRepository', () => {
  it('seeds from the catalog and reports counts', async () => {
    const { plan, decisions } = createCatalogBrainPlan();
    const repo = new InMemoryBrainRepository({ plans: [plan], decisions });
    expect(await repo.countDecisions()).toBe(14);
    expect(await repo.countPlans()).toBe(1);
  });

  it('saves and finds decisions', async () => {
    const repo = new InMemoryBrainRepository();
    const d = decision();
    await repo.saveDecision(d);
    expect((await repo.findDecisionById('bd_test'))?.status).toBe('proposed');
    expect(await repo.findDecisionById('missing')).toBeNull();
  });

  it('lists decisions with type/status/goal filters and pagination', async () => {
    const repo = new InMemoryBrainRepository();
    await repo.saveDecision(
      decision({ decisionId: 'd1', type: 'provider_selection', status: 'approved' }),
    );
    await repo.saveDecision(
      decision({ decisionId: 'd2', type: 'budget_strategy', status: 'proposed' }),
    );
    await repo.saveDecision(
      decision({
        decisionId: 'd3',
        type: 'provider_selection',
        status: 'proposed',
        goalId: 'other',
      }),
    );

    const byType = await repo.listDecisions({ type: 'provider_selection' }, { page: 1, limit: 10 });
    expect(byType.total).toBe(2);

    const byStatus = await repo.listDecisions({ status: 'proposed' }, { page: 1, limit: 10 });
    expect(byStatus.total).toBe(2);

    const byGoal = await repo.listDecisions({ goalId: 'other' }, { page: 1, limit: 10 });
    expect(byGoal.total).toBe(1);

    const paged = await repo.listDecisions({}, { page: 1, limit: 2 });
    expect(paged.data).toHaveLength(2);
    expect(paged.totalPages).toBe(2);
  });

  it('lists decisions by goal and by plan', async () => {
    const repo = new InMemoryBrainRepository();
    await repo.saveDecision(decision({ decisionId: 'd1' }));
    await repo.saveDecision(decision({ decisionId: 'd2', planId: 'other_plan' }));
    expect(await repo.listDecisionsByPlan('plan_test')).toHaveLength(1);
    expect(await repo.listDecisionsByGoal('goal_test')).toHaveLength(2);
  });

  it('deletes decisions and plans', async () => {
    const repo = new InMemoryBrainRepository();
    await repo.saveDecision(decision());
    await repo.savePlan(plan());
    await repo.deleteDecision('bd_test');
    await repo.deletePlan('plan_test');
    expect(await repo.countDecisions()).toBe(0);
    expect(await repo.countPlans()).toBe(0);
  });

  it('saves, finds, and lists plans (optionally by goal)', async () => {
    const repo = new InMemoryBrainRepository();
    await repo.savePlan(plan({ planId: 'p1' }));
    await repo.savePlan(plan({ planId: 'p2', goalId: 'other_goal' }));
    expect((await repo.findPlanById('p1'))?.goalTitle).toBe('G');
    expect(await repo.findPlanById('missing')).toBeNull();
    expect(await repo.listPlans()).toHaveLength(2);
    expect(await repo.listPlans('other_goal')).toHaveLength(1);
  });
});
