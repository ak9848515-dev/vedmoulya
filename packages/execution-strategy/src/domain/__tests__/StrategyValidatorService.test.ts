// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Tests: StrategyValidatorService
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { StrategyValidatorService } from '../services/StrategyValidatorService.js';
import { ExecutionStrategyService } from '../services/ExecutionStrategyService.js';

describe('StrategyValidatorService', () => {
  const service = new StrategyValidatorService();
  const builder = new ExecutionStrategyService();

  function buildValidStrategy() {
    return builder.createStrategy({
      goalId: 'goal_test',
      goal: 'Generate a blog post about enterprise AI',
      business: ['platform'],
      priority: 'high',
      qualityTier: 'premium',
      maxCostUsd: 2,
      maxLatencyMs: 30000,
      maxTokens: 50000,
    });
  }

  it('passes a fully-populated strategy across all six checks', () => {
    const strategy = buildValidStrategy();
    const result = service.validate(strategy);
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(6);
    expect(result.score).toBe(1);
    expect(result.summary).toMatch(/valid/i);
    expect(result.checks.map((c) => c.check)).toEqual([
      'Capability exists',
      'Context available',
      'Provider available',
      'Budget possible',
      'Latency acceptable',
      'Quality achievable',
    ]);
  });

  it('fails the provider check when no candidates are eligible', () => {
    const strategy = buildValidStrategy();
    strategy.providerCandidates = [];
    const result = service.validate(strategy);
    const provider = result.checks.find((c) => c.check === 'Provider available');
    expect(provider!.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('fails the capability check when the plan is not feasible', () => {
    const strategy = buildValidStrategy();
    strategy.capabilityPlan.feasible = false;
    strategy.capabilityPlan.requiredCapabilities = [];
    const result = service.validate(strategy);
    const capability = result.checks.find((c) => c.check === 'Capability exists');
    expect(capability!.passed).toBe(false);
  });

  it('fails the budget check when token or cost caps are zero', () => {
    const strategy = buildValidStrategy();
    strategy.tokenBudget.maximumTokens = 0;
    strategy.costBudget.maximumCostUsd = 0;
    const result = service.validate(strategy);
    const budget = result.checks.find((c) => c.check === 'Budget possible');
    expect(budget!.passed).toBe(false);
  });

  it('fails the latency check when the latency cap is unset', () => {
    const strategy = buildValidStrategy();
    strategy.latencyBudget.maximumTimeMs = 0;
    const result = service.validate(strategy);
    const latency = result.checks.find((c) => c.check === 'Latency acceptable');
    expect(latency!.passed).toBe(false);
  });

  it('fails the quality check when the quality floor is unset', () => {
    const strategy = buildValidStrategy();
    strategy.qualityTarget.minimumScore = 0;
    const result = service.validate(strategy);
    const quality = result.checks.find((c) => c.check === 'Quality achievable');
    expect(quality!.passed).toBe(false);
  });

  it('computes a partial score when some checks fail', () => {
    const strategy = buildValidStrategy();
    strategy.providerCandidates = [];
    const result = service.validate(strategy);
    expect(result.score).toBe(5 / 6);
    expect(result.summary).toMatch(/validation issue/i);
  });

  it('reports check details for passing dimensions', () => {
    const strategy = buildValidStrategy();
    const result = service.validate(strategy);
    const context = result.checks.find((c) => c.check === 'Context available');
    expect(context!.detail).toMatch(/steps planned/);
  });
});
