import { describe, expect, it } from 'vitest';
import { LoopBudget } from '../LoopBudget.js';
import type { LoopBudgetConfig } from '../../types/loop-types.js';

const config: LoopBudgetConfig = {
  maxIterations: 3,
  maxTokens: 1_000,
  maxCostUsd: 0.01,
  maxLatencyMs: 60_000,
  maxProviderCalls: 4,
  maxToolCalls: 2,
};

describe('LoopBudget', () => {
  it('tracks tokens, cost, latency and provider calls', () => {
    const budget = new LoopBudget(config);
    budget.recordSpecialist({
      tokens: { input: 100, output: 50, total: 150 },
      costUsd: 0.001,
      latencyMs: 10,
    });
    budget.recordSpecialist({
      tokens: { input: 50, output: 25, total: 75 },
      costUsd: 0.0005,
      latencyMs: 5,
    });
    const usage = budget.snapshot();
    expect(usage.tokensTotal).toBe(225);
    expect(usage.costUsd).toBeCloseTo(0.0015);
    expect(usage.providerCalls).toBe(2);
    expect(usage.latencyMs).toBe(15);
  });

  it('blocks provider calls at the provider-call limit', () => {
    const budget = new LoopBudget({ ...config, maxProviderCalls: 1 });
    expect(budget.canCallProvider().ok).toBe(true);
    budget.recordSpecialist({
      tokens: { input: 1, output: 1, total: 2 },
      costUsd: 0,
      latencyMs: 0,
    });
    const check = budget.canCallProvider();
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('BUDGET_EXCEEDED');
  });

  it('blocks provider calls that would breach the token budget', () => {
    const budget = new LoopBudget({ ...config, maxTokens: 200 });
    budget.recordSpecialist({
      tokens: { input: 100, output: 50, total: 150 },
      costUsd: 0,
      latencyMs: 0,
    });
    const check = budget.canCallProvider(100);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('BUDGET_EXCEEDED');
  });

  it('blocks provider calls that would breach the cost budget', () => {
    const budget = new LoopBudget({ ...config, maxCostUsd: 0.001 });
    const check = budget.canCallProvider(0, 0.002);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('BUDGET_EXCEEDED');
  });

  it('blocks tool calls at the tool-call limit', () => {
    const budget = new LoopBudget(config);
    budget.recordToolCall();
    budget.recordToolCall();
    const check = budget.canCallTool();
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('BUDGET_EXCEEDED');
  });

  it('blocks iterations at the iteration limit', () => {
    const budget = new LoopBudget(config);
    budget.recordIteration();
    budget.recordIteration();
    budget.recordIteration();
    const check = budget.canStartIteration(0);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('ITERATION_LIMIT');
  });

  it('reports TIMEOUT when wall-clock exceeds the latency budget', () => {
    const budget = new LoopBudget(config);
    const check = budget.canStartIteration(61_000);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('TIMEOUT');
  });

  it('detects cumulative token/cost breaches after execution', () => {
    const budget = new LoopBudget({ ...config, maxTokens: 100, maxCostUsd: 0.005 });
    budget.recordSpecialist({
      tokens: { input: 100, output: 50, total: 150 },
      costUsd: 0.0001,
      latencyMs: 0,
    });
    const check = budget.exceededAfter();
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('BUDGET_EXCEEDED');
  });

  it('seeds from a prior usage snapshot (resume accounting)', () => {
    const budget = new LoopBudget(config, {
      tokensInput: 10,
      tokensOutput: 10,
      tokensTotal: 20,
      costUsd: 0.001,
      latencyMs: 5,
      providerCalls: 2,
      toolCalls: 1,
      iterations: 1,
    });
    expect(budget.snapshot().providerCalls).toBe(2);
    budget.recordSpecialist({
      tokens: { input: 1, output: 1, total: 2 },
      costUsd: 0,
      latencyMs: 0,
    });
    expect(budget.snapshot().providerCalls).toBe(3);
  });

  it('records wall latency as a maximum', () => {
    const budget = new LoopBudget(config);
    budget.recordSpecialist({
      tokens: { input: 1, output: 1, total: 2 },
      costUsd: 0,
      latencyMs: 10,
    });
    budget.recordWallLatency(5);
    expect(budget.snapshot().latencyMs).toBe(10);
    budget.recordWallLatency(40);
    expect(budget.snapshot().latencyMs).toBe(40);
  });
});
