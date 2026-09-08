// VedMoulya — Mission Controller: Budget & Limit Enforcement
// BLD-021A PHASE 22 — budgets are hard ceilings. Never continue after exhaustion.
import { describe, it, expect } from 'vitest';
import { createTestService } from './fixtures.js';
import {
  checkBudget,
  isBudgetExhausted,
  updateBudgetUsage,
  createDefaultBudget,
  createEmptyBudgetUsage,
} from '../domain/mission-budget-enforcer.js';

describe('Mission Budgets & Limits', () => {
  it('exhausts at the objective ceiling and stops autonomously', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Limited mission',
      objective: 'Small mission',
      budget: { maxObjectives: 2 },
      initialObjectives: ['One', 'Two', 'Three', 'Four'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    // Budget is a hard ceiling: exactly 2 objectives consumed, mission stops.
    expect(done.budgetUsage.objectivesCompleted).toBe(2);
    expect(done.budgetUsage.objectivesFailed).toBe(0);
    expect(done.state).toBe('FAILED'); // objective ceiling hit → stop with reason
    expect(done.outcomeReason).toBe('Maximum objectives reached');
  });

  it('budget exhaustion produces a terminal stop with an explicit reason', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Budget bound',
      objective: 'Expensive objective',
      budget: { maxCostUsd: 0.0005 },
      initialObjectives: ['One', 'Two'],
    });
    await service.startMission(mission.missionId);
    // Each execution consumes 0.001 USD — the 0.0005 ceiling is crossed after
    // objective One; objective Two is never started (hard budget ceiling).
    const result = await service.runAutonomousLoop(mission.missionId);
    expect(result.budgetUsage.costUsdConsumed).toBe(0.001); // only obj One ran
    expect(result.objectives[0]?.state).toBe('VERIFIED');
    expect(result.objectives[1]?.state).toBe('PENDING'); // never started
    expect(result.state).toBe('FAILED');
    expect(result.outcomeReason).toBe('Maximum cost reached');
    expect(result.objectives[1]?.verifiedOutcome).toBeUndefined();
  });

  it('objective limit reached stops the loop before any further execution', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Two max',
      objective: 'Half done',
      budget: { maxObjectives: 1 },
      initialObjectives: ['Only me'],
    });
    await service.startMission(mission.missionId);
    await service.runAutonomousLoop(mission.missionId);
    // Second iteration would have no budget — loop exits.
    const status = await service.getStatus(mission.missionId, 'u1');
    expect(status.progress.completedObjectives).toBe(1);
  });

  it('action limit is a hard ceiling', async () => {
    const budget = createDefaultBudget({ maxActions: 1 });
    const usage = updateBudgetUsage(createEmptyBudgetUsage(), { actionsExecuted: 1 });
    expect(isBudgetExhausted(budget, usage)).toBe(true);
    expect(checkBudget(budget, usage).reason).toBe('Maximum actions reached');
  });

  it('runtime limit is a hard ceiling', async () => {
    const budget = createDefaultBudget({ maxRuntimeMs: 5000 });
    const usage = updateBudgetUsage(createEmptyBudgetUsage(), { runtimeMs: 5000 });
    expect(isBudgetExhausted(budget, usage)).toBe(true);
    expect(checkBudget(budget, usage).reason).toBe('Maximum runtime reached');
  });

  it('token limit is a hard ceiling', async () => {
    const budget = createDefaultBudget({ maxTokens: 100 });
    const usage = updateBudgetUsage(createEmptyBudgetUsage(), { tokensConsumed: 100 });
    expect(checkBudget(budget, usage).reason).toBe('Maximum tokens reached');
  });

  it('budget usage accumulates across objectives', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Accumulator',
      objective: 'Do work',
      initialObjectives: ['A', 'B'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    // 2 objectives × 100 tokens / 0.001 USD / 1 tool call each.
    expect(done.budgetUsage.actionsExecuted).toBe(2);
    expect(done.budgetUsage.tokensConsumed).toBe(200);
    expect(done.budgetUsage.toolCallsExecuted).toBe(2);
  });
});
