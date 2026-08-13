// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Tests: BudgetEngineService
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { BudgetEngineService } from '../services/BudgetEngineService.js';
import type {
  CapabilityPlan,
  CapabilityPlanStep,
  ProviderCandidate,
} from '../../types/strategy-types.js';

function makeStep(overrides: Partial<CapabilityPlanStep> = {}): CapabilityPlanStep {
  return {
    stepId: 'step_test',
    capability: 'content_generation',
    label: 'Test Step',
    description: 'A test step',
    flowType: 'sequential',
    support: 'required',
    skippable: false,
    weight: 0.5,
    eligibleFamilies: ['anthropic', 'openai'],
    children: [],
    ...overrides,
  };
}

function makePlan(stepCount = 3): CapabilityPlan {
  return {
    goal: 'Test goal',
    steps: Array.from({ length: stepCount }, (_, i) => makeStep({ stepId: `step_${i}` })),
    requiredCapabilities: ['content_generation'],
    feasible: true,
    summary: `${stepCount} step plan`,
  };
}

function makeCandidate(overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return {
    providerId: 'anthropic_claude-3-opus',
    family: 'anthropic',
    name: 'Anthropic Claude',
    modelId: 'claude-3-opus',
    capabilityMatch: 0.9,
    qualityEstimate: 0.97,
    latencyEstimateMs: 1200,
    costEstimateUsd: 0,
    contextWindow: 200000,
    availability: 'healthy',
    confidence: 0.95,
    historicalSuccess: 0.96,
    healthScore: 0.98,
    rankScore: 0.9,
    ...overrides,
  };
}

describe('BudgetEngineService', () => {
  const service = new BudgetEngineService();

  describe('estimateTokens', () => {
    it('estimates a positive token budget with all components', () => {
      const budget = service.estimateTokens(makePlan(), 'standard');
      expect(budget.inputTokens).toBeGreaterThan(0);
      expect(budget.outputTokens).toBeGreaterThan(0);
      expect(budget.contextTokens).toBe(4000);
      expect(budget.reservedTokens).toBe(1000);
      expect(budget.expectedTokens).toBe(
        budget.inputTokens + budget.outputTokens + budget.contextTokens + budget.reservedTokens,
      );
      expect(budget.confidence).toBeGreaterThan(0);
    });

    it('scales output tokens by quality tier', () => {
      const premium = service.estimateTokens(makePlan(), 'premium');
      const economy = service.estimateTokens(makePlan(), 'economy');
      expect(premium.outputTokens).toBeGreaterThan(economy.outputTokens);
    });

    it('honors an explicit maximum token cap', () => {
      const budget = service.estimateTokens(makePlan(), 'standard', 5000);
      expect(budget.maximumTokens).toBe(5000);
    });

    it('defaults maximum tokens to 1.5x expected', () => {
      const budget = service.estimateTokens(makePlan(), 'standard');
      expect(budget.maximumTokens).toBe(Math.round(budget.expectedTokens * 1.5));
    });
  });

  describe('estimateCost', () => {
    it('estimates cost with a top candidate', () => {
      const tokens = service.estimateTokens(makePlan(), 'standard');
      const cost = service.estimateCost(tokens, [makeCandidate()]);
      expect(cost.expectedCostUsd).toBeGreaterThanOrEqual(0.01);
      expect(cost.maximumCostUsd).toBeGreaterThanOrEqual(cost.expectedCostUsd);
      expect(['minimum', 'standard', 'premium', 'maximum']).toContain(cost.category);
      expect(cost.confidence).toBeGreaterThan(0);
    });

    it('returns a zero-minimum budget when no candidate exists', () => {
      const tokens = service.estimateTokens(makePlan(), 'standard');
      const cost = service.estimateCost(tokens, []);
      expect(cost.expectedCostUsd).toBe(0);
      expect(cost.maximumCostUsd).toBe(0);
      expect(cost.category).toBe('minimum');
    });

    it('honors an explicit maximum cost cap', () => {
      const tokens = service.estimateTokens(makePlan(), 'standard');
      const cost = service.estimateCost(tokens, [makeCandidate()], 1);
      expect(cost.maximumCostUsd).toBe(1);
    });
  });

  describe('estimateLatency', () => {
    it('estimates latency from the top candidate and step count', () => {
      const latency = service.estimateLatency(makePlan(4), [makeCandidate()]);
      expect(latency.expectedTimeMs).toBe(Math.round(1200 * 4 * 1.2));
      expect(latency.maximumTimeMs).toBe(Math.round(latency.expectedTimeMs * 2));
    });

    it('falls back to a 1000ms per-step default without candidates', () => {
      const latency = service.estimateLatency(makePlan(2), []);
      expect(latency.expectedTimeMs).toBe(Math.round(1000 * 2 * 1.2));
    });

    it('honors an explicit maximum latency cap', () => {
      const latency = service.estimateLatency(makePlan(2), [makeCandidate()], 5000);
      expect(latency.maximumTimeMs).toBe(5000);
    });
  });

  describe('buildQualityTarget', () => {
    it('builds a premium target', () => {
      const target = service.buildQualityTarget('premium');
      expect(target.targetScore).toBe(0.9);
      expect(target.minimumScore).toBe(0.8);
      expect(target.retryThreshold).toBe(0.85);
      expect(target.tier).toBe('premium');
      expect(target.approvalRequired).toBe(false);
    });

    it('builds an economy target with lower floors', () => {
      const target = service.buildQualityTarget('economy');
      expect(target.targetScore).toBe(0.7);
      expect(target.minimumScore).toBe(0.6);
    });

    it('supports approval and human-review flags', () => {
      const target = service.buildQualityTarget('standard', true, true);
      expect(target.approvalRequired).toBe(true);
      expect(target.humanReview).toBe(true);
    });
  });
});
