import { describe, expect, it } from 'vitest';
import { CostPolicyGuard } from '../domain/CostPolicyGuard.js';
import type { CostPolicyLimits, CostSpendSnapshot } from '../types/fabric-types.js';

describe('CostPolicyGuard', () => {
  it('allows a task within all caps with a clear reason', () => {
    const guard = new CostPolicyGuard();
    const limits: CostPolicyLimits = { maxTaskCostUsd: 1, maxDailyCostUsd: 10 };
    const decision = guard.check({ additionalUsd: 0.5, limits, current: {} });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain('within all configured caps');
  });

  it('blocks a task that would exceed the task cap', () => {
    const guard = new CostPolicyGuard();
    const limits: CostPolicyLimits = { maxTaskCostUsd: 1 };
    const decision = guard.check({ additionalUsd: 1.01, limits, current: {} });
    expect(decision.allowed).toBe(false);
    expect(decision.exhaustedBucket).toBe('task');
  });

  it('blocks when a bucket is already at/over its cap regardless of the new amount', () => {
    const guard = new CostPolicyGuard();
    const limits: CostPolicyLimits = { maxDailyCostUsd: 5 };
    const decision = guard.check({ additionalUsd: 0.01, limits, current: { dailyUsd: 5 } });
    expect(decision.allowed).toBe(false);
    expect(decision.exhaustedBucket).toBe('daily');
  });

  it('honours provider and workspace buckets when scoped', () => {
    const guard = new CostPolicyGuard();
    const limits: CostPolicyLimits = { maxProviderCostUsd: 2, maxWorkspaceCostUsd: 20 };
    const providerBlock = guard.check({
      additionalUsd: 1,
      providerId: 'openai',
      limits,
      current: { providerUsd: 1.5 },
    });
    expect(providerBlock.allowed).toBe(false);
    expect(providerBlock.exhaustedBucket).toBe('provider');

    const workspaceBlock = guard.check({
      additionalUsd: 10,
      workspaceId: 'ws-1',
      limits,
      current: { workspaceUsd: 15 },
    });
    expect(workspaceBlock.allowed).toBe(false);
    expect(workspaceBlock.exhaustedBucket).toBe('workspace');
  });

  it('treats UNKNOWN cost honestly — allows only when no bucket is near its cap', () => {
    const guard = new CostPolicyGuard();
    // Unknown cost, no caps at all → allowed.
    expect(guard.check({ limits: {}, current: {} }).allowed).toBe(true);

    // Unknown cost with caps and spend far below → allowed with UNKNOWN note.
    const allowed = guard.check({
      limits: { maxDailyCostUsd: 10 },
      current: { dailyUsd: 1 },
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.reason).toContain('UNKNOWN');

    // Unknown cost with a bucket within 10% of its cap → blocked fail-closed.
    const blocked = guard.check({
      limits: { maxDailyCostUsd: 10 },
      current: { dailyUsd: 9.5 },
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.exhaustedBucket).toBe('daily');
  });

  it('reports the current spend snapshot it used', () => {
    const guard = new CostPolicyGuard();
    const current: CostSpendSnapshot = { taskUsd: 0.2, dailyUsd: 1.2 };
    const decision = guard.check({ additionalUsd: 0.3, limits: {}, current });
    expect(decision.current.taskUsd).toBe(0.2);
    expect(decision.current.dailyUsd).toBe(1.2);
  });
});
