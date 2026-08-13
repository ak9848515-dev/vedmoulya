// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Enterprise Brain Seed Catalog
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  SEED_DECISIONS_SIZE,
  SEED_GOAL_ID,
  SEED_PLAN_ID,
  createCatalogBrainDecisions,
  createCatalogBrainPlan,
  hasAllDecisionTypes,
} from '../brain-catalog.js';
import { BRAIN_DECISION_TYPES } from '../../types/brain-types.js';

describe('createCatalogBrainPlan', () => {
  it('builds one plan with all 14 decision types', () => {
    const { plan, decisions } = createCatalogBrainPlan();
    expect(plan.planId).toBe(SEED_PLAN_ID);
    expect(plan.goalId).toBe(SEED_GOAL_ID);
    expect(decisions).toHaveLength(SEED_DECISIONS_SIZE);
    expect(decisions).toHaveLength(BRAIN_DECISION_TYPES.length);
    expect(hasAllDecisionTypes(decisions)).toBe(true);
    expect(plan.decisions).toHaveLength(14);
  });

  it('keeps decision ids deterministic and plan-scoped', () => {
    const { plan, decisions } = createCatalogBrainPlan();
    for (const decision of decisions) {
      expect(decision.decisionId).toBe(`bd_${plan.planId}_${decision.type}`);
      expect(decision.planId).toBe(plan.planId);
      expect(decision.goalId).toBe(SEED_GOAL_ID);
    }
  });

  it('documents the full pipeline in the plan', () => {
    const { plan } = createCatalogBrainPlan();
    expect(plan.pipeline).toHaveLength(11);
    expect(plan.pipeline[0]?.step).toBe('Receive Goal');
    expect(plan.pipeline[10]?.step).toBe('Pass to Execution Orchestrator');
  });

  it('seeds a status mix that demonstrates the approval workflow', () => {
    const decisions = createCatalogBrainDecisions();
    expect(decisions.filter((d) => d.status === 'approved').length).toBe(2);
    expect(decisions.filter((d) => d.status === 'proposed').length).toBe(12);
    const approved = decisions.filter((d) => d.status === 'approved');
    for (const decision of approved) {
      expect(decision.version).toBe(2);
      expect(decision.history.length).toBe(2);
    }
  });

  it('gives every seed decision a recommendation and explanation', () => {
    const decisions = createCatalogBrainDecisions();
    for (const decision of decisions) {
      expect(decision.recommendation.entityId.length).toBeGreaterThan(0);
      expect(decision.reason.evidence.length).toBeGreaterThan(0);
      expect(decision.reason.risks.length).toBeGreaterThan(0);
      expect(decision.confidence.score).toBeGreaterThan(0);
    }
  });
});
