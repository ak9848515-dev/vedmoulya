// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Explainability Service Tests
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import {
  ExecutionFactory,
  ExecutionTimeline,
  ExecutionContext,
  ExecutionTask,
  ExecutionResult,
} from '@vedmoulya/domain';
import type { ExecutionPlan } from '@vedmoulya/domain';
import { ExecutionExplainabilityService } from '../ExecutionExplainabilityService.js';

/**
 * Build a plan with 4 tasks (1 completed, 3 pending) and 1 mission completed,
 * so tasksCompleted=1, tasksTotal=4, missionsCompleted=1, missionsTotal=1.
 */
function makePlan(
  overrides: Partial<Parameters<typeof ExecutionFactory.reconstructPlan>[0]> = {},
): ExecutionPlan {
  const plan = ExecutionFactory.reconstructPlan({
    id: 'plan_1',
    title: 'Launch plan',
    description: 'Launch the platform',
    planningLevel: 'operational',
    status: 'in_progress',
    priorityScore: 6,
    completedCount: 1,
    totalCount: 4,
    goalReferences: [{ goalId: 'g1', label: 'Goal', description: 'D' }],
    decisionReferences: [{ decisionId: 'd1', title: 'Decision', selectedOption: 'opt_a' }],
    knowledgeNodeIds: ['kn1'],
    memoryIds: [],
    missions: [],
    tasks: [],
    timeline: ExecutionTimeline.empty(),
    context: new ExecutionContext({ energyLevel: 7 }),
    tags: [],
    metadata: { recoveryAttempts: 2 },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

  // Add 4 tasks and complete the first so the tasks array drives the counts.
  for (let i = 1; i <= 4; i++) {
    plan.addTask(new ExecutionTask({ id: `task_${i}`, label: `Task ${i}`, description: 'D' }));
  }
  plan.completeTask('task_1', ExecutionResult.success('Done'));

  return plan;
}

function makeAiClient(overrides: { enabled?: boolean; brief?: string } = {}) {
  return {
    isEnabled: vi.fn(() => overrides.enabled ?? true),
    generateDailyBrief: vi.fn().mockResolvedValue(overrides.brief ?? 'AI summary'),
  };
}

describe('ExecutionExplainabilityService', () => {
  it('generates a standard explanation without an AI client', async () => {
    const service = new ExecutionExplainabilityService();
    const plan = makePlan();

    const explanation = await service.generateExplanation(plan);

    expect(explanation.planId).toBe('plan_1');
    expect(explanation.tasksCompleted).toBe(1);
    expect(explanation.tasksTotal).toBe(4);
    expect(explanation.recoveryAttempts).toBe(2);
    expect(explanation.riskFactors).toContain(
      'Less than 50% progress while in progress — possible schedule risk',
    );
  });

  it('appends an AI summary when the AI client is enabled', async () => {
    const ai = makeAiClient();
    const service = new ExecutionExplainabilityService(ai as never);
    const plan = makePlan();

    const explanation = await service.generateExplanation(plan);

    expect(ai.generateDailyBrief).toHaveBeenCalled();
    expect(explanation.riskFactors).toContain('AI: AI summary');
  });

  it('falls back to the standard explanation when AI throws', async () => {
    const ai = makeAiClient();
    (ai.generateDailyBrief as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ai down'));
    const service = new ExecutionExplainabilityService(ai as never);

    const explanation = await service.generateExplanation(makePlan());

    expect(explanation.riskFactors).not.toContain(expect.stringContaining('AI:'));
  });

  it('reports no-tasks-completed risk factor', async () => {
    const service = new ExecutionExplainabilityService();
    // Rebuild a plan with 1 pending task and nothing completed.
    const plan = ExecutionFactory.reconstructPlan({
      id: 'plan_2',
      title: 'Fresh',
      description: 'Fresh plan',
      planningLevel: 'daily',
      status: 'in_progress',
      priorityScore: 3,
      completedCount: 0,
      totalCount: 1,
      tasks: [new ExecutionTask({ id: 't1', label: 'T1', description: 'D' })],
      timeline: ExecutionTimeline.empty(),
      context: new ExecutionContext({ energyLevel: 7 }),
      tags: [],
      metadata: { recoveryAttempts: 0 },
    });

    const explanation = await service.generateExplanation(plan);

    expect(explanation.riskFactors).toContain('No tasks completed yet');
  });

  it('reports bottleneck count when the plan has bottlenecks', async () => {
    const service = new ExecutionExplainabilityService();
    // A zero-progress in-progress plan triggers the "no tasks completed"
    // bottleneck path inside analyzeBottlenecks.
    const plan = ExecutionFactory.reconstructPlan({
      id: 'plan_3',
      title: 'Blocked',
      description: 'Blocked plan',
      planningLevel: 'tactical',
      status: 'in_progress',
      priorityScore: 8,
      completedCount: 0,
      totalCount: 2,
      tasks: [
        new ExecutionTask({ id: 't1', label: 'T1', description: 'D' }),
        new ExecutionTask({ id: 't2', label: 'T2', description: 'D' }),
      ],
      timeline: ExecutionTimeline.empty(),
      context: new ExecutionContext({ energyLevel: 3 }),
      tags: [],
      metadata: { recoveryAttempts: 1 },
    });

    const explanation = await service.generateExplanation(plan);

    expect(explanation.recoveryAttempts).toBe(1);
    expect(Array.isArray(explanation.bottlenecks)).toBe(true);
  });

  it('counts zero recovery attempts when metadata is absent', async () => {
    const service = new ExecutionExplainabilityService();
    const plan = ExecutionFactory.reconstructPlan({
      id: 'plan_4',
      title: 'No meta',
      description: 'No metadata',
      planningLevel: 'operational',
      status: 'pending',
      priorityScore: 5,
      completedCount: 0,
      totalCount: 1,
      tasks: [new ExecutionTask({ id: 't1', label: 'T1', description: 'D' })],
      timeline: ExecutionTimeline.empty(),
      context: new ExecutionContext({ energyLevel: 7 }),
      tags: [],
    });

    const explanation = await service.generateExplanation(plan);

    expect(explanation.recoveryAttempts).toBe(0);
  });
});
