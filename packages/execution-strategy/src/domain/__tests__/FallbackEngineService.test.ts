// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Tests: FallbackEngineService
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { FallbackEngineService } from '../services/FallbackEngineService.js';

describe('FallbackEngineService', () => {
  const service = new FallbackEngineService();

  it('builds a full four-tier fallback plan', () => {
    const plan = service.buildFallback('strategy_abc', ['anthropic', 'openai']);
    expect(plan.primaryPlanId).toBe('strategy_abc_primary');
    expect(plan.secondaryPlanId).toBe('strategy_abc_secondary');
    expect(plan.emergencyPlanId).toBe('strategy_abc_emergency');
    expect(plan.localExecutionPlanId).toBe('strategy_abc_local');
    expect(plan.activeTier).toBe('primary');
  });

  it('describes primary and secondary tiers', () => {
    const plan = service.buildFallback('s1', ['anthropic', 'openai']);
    expect(plan.description).toContain('Primary: anthropic');
    expect(plan.description).toContain('Secondary: openai');
    expect(plan.description).toContain('Emergency');
    expect(plan.description).toContain('Local');
  });

  it('describes a single-candidate fallback to local execution', () => {
    const plan = service.buildFallback('s2', ['anthropic']);
    expect(plan.description).toContain('Primary: anthropic');
    expect(plan.description).toContain('local execution');
  });

  it('describes a no-eligible-provider fallback', () => {
    const plan = service.buildFallback('s3', []);
    expect(plan.description).toContain('No eligible provider');
    expect(plan.description).toContain('local execution');
  });

  it('builds the default retry policy', () => {
    const policy = service.buildRetryPolicy();
    expect(policy.maximumRetries).toBe(2);
    expect(policy.retryDelayMs).toBe(1000);
    expect(policy.escalation).toBe('double-delay');
    expect(policy.stopConditions).toContain('budget_exceeded');
    expect(policy.stopConditions).toContain('quality_below_threshold');
    expect(policy.stopConditions).toContain('context_window_exceeded');
    expect(policy.stopConditions).toContain('policy_violation');
  });

  it('honors retry policy overrides', () => {
    const policy = service.buildRetryPolicy(5, 500, 'switch-provider');
    expect(policy.maximumRetries).toBe(5);
    expect(policy.retryDelayMs).toBe(500);
    expect(policy.escalation).toBe('switch-provider');
  });
});
