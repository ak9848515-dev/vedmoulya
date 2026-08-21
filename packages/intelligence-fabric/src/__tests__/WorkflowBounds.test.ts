import { describe, expect, it } from 'vitest';
import { WorkflowBounds } from '../domain/WorkflowBounds.js';
import type { WorkflowLimits, WorkflowPlan } from '../types/fabric-types.js';

const limits: WorkflowLimits = {
  maxParallelProviders: 4,
  maxWorkflowDepth: 6,
  maxWorkflowTasks: 20,
  maxProviderCalls: 50,
  maxWorkflowCostUsd: 5,
  maxWorkflowTimeMs: 600_000,
};

const plan: WorkflowPlan = {
  taskCount: 10,
  depth: 4,
  maxParallelFanout: 3,
  estimatedProviderCalls: 30,
  estimatedCostUsd: 2,
  estimatedTimeMs: 120_000,
};

describe('WorkflowBounds', () => {
  const bounds = new WorkflowBounds();

  it('allows a plan within all bounds', () => {
    const decision = bounds.validate(plan, limits);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain('within all bounds');
  });

  it('blocks unbounded parallel fan-out', () => {
    const decision = bounds.validate({ ...plan, maxParallelFanout: 9 }, limits);
    expect(decision.allowed).toBe(false);
    expect(decision.exceeded).toBe('parallel');
  });

  it('blocks excessive depth and task counts', () => {
    expect(bounds.validate({ ...plan, depth: 7 }, limits).exceeded).toBe('depth');
    expect(bounds.validate({ ...plan, taskCount: 25 }, limits).exceeded).toBe('tasks');
  });

  it('blocks excessive provider calls', () => {
    const decision = bounds.validate({ ...plan, estimatedProviderCalls: 60 }, limits);
    expect(decision.allowed).toBe(false);
    expect(decision.exceeded).toBe('calls');
  });

  it('blocks excessive estimated cost and time', () => {
    expect(bounds.validate({ ...plan, estimatedCostUsd: 6 }, limits).exceeded).toBe('cost');
    expect(bounds.validate({ ...plan, estimatedTimeMs: 700_000 }, limits).exceeded).toBe('time');
  });

  it('allows plans with unknown cost/time (honest — nothing fabricated)', () => {
    const decision = bounds.validate(
      { ...plan, estimatedCostUsd: undefined, estimatedTimeMs: undefined },
      limits,
    );
    expect(decision.allowed).toBe(true);
  });
});
