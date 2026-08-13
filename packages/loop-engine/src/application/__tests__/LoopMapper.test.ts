import { describe, expect, it } from 'vitest';
import { LoopMapper } from '../LoopMapper.js';
import { GoalUnderstandingService } from '../../domain/GoalUnderstandingService.js';
import { TaskDecompositionService } from '../../domain/TaskDecompositionService.js';
import type { LoopRun } from '../../types/loop-types.js';

function makeRun(): LoopRun {
  const spec = new GoalUnderstandingService().derive(
    'Build an ABAP debugger for short dumps in production SAP code.',
  );
  const graph = new TaskDecompositionService().buildGraph(spec);
  return {
    runId: 'run-1',
    goalId: spec.goalId,
    userId: 'user-1',
    goal: spec.rawGoal,
    specification: spec,
    graph,
    steps: [],
    budgetConfig: spec.budget,
    budgetUsage: {
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      costUsd: 0,
      latencyMs: 0,
      providerCalls: 0,
      toolCalls: 0,
      iterations: 0,
    },
    status: 'pending',
    evidenceStates: [],
    proposedMemories: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('LoopMapper', () => {
  it('maps a pending run to start/status/trace/summary DTOs', () => {
    const run = makeRun();

    const start = LoopMapper.toStartResultDTO(run);
    expect(start.runId).toBe('run-1');
    expect(start.specification.pattern).toBe('abap-debugger');
    expect(start.specification.clarificationNeeded).toBeUndefined();
    expect(start.graph.tasks.length).toBeGreaterThan(0);

    const status = LoopMapper.toStatusDTO(run);
    expect(status.runId).toBe('run-1');
    expect(status.status).toBe('pending');

    const trace = LoopMapper.toRunDTO(run);
    expect(trace.goal).toContain('ABAP');
    expect(trace.budgetConfig.maxIterations).toBeGreaterThan(0);
    expect(trace.specification.requiredCapabilities).toContain('coding');

    const summary = LoopMapper.toSummaryDTO(run);
    expect(summary.pattern).toBe('abap-debugger');
    expect(summary.iterations).toBe(0);
  });

  it('surfaces the clarification-needed flag in the spec DTO', () => {
    const run = makeRun();
    run.specification = { ...run.specification, clarificationNeeded: { reason: 'too vague' } };
    const start = LoopMapper.toStartResultDTO(run);
    expect(start.specification.clarificationNeeded?.reason).toBe('too vague');
  });

  it('lists the catalog patterns', () => {
    const patterns = LoopMapper.listPatterns();
    expect(patterns).toHaveLength(4);
    expect(patterns.find((p) => p.id === 'generic')).toBeDefined();
    expect(patterns.find((p) => p.id === 'app-builder')?.description).toContain('app');
    expect(patterns.find((p) => p.id === 'ai-app-builder')?.label).toContain('AI');
  });
});
