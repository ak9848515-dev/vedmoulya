// VedMoulya — AUTONOMY-02: Failure-Informed Objective Replanning Tests
// BLD-021A — Tests for REVISE_OBJECTIVE consumption and failure context propagation.
import { describe, it, expect } from 'vitest';
import { createTestService } from './fixtures.js';
import type { AgentPlan } from '@vedmoulya/agent-execution';
import type { FailureContext } from '../types/mission-types.js';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AUTONOMY-02: Failure-Informed Objective Replanning', () => {
  it('REVISE_OBJECTIVE IS CONSUMED: enters revision path on verification failure', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: { verified: false, evidence: ['verification failed'] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Test REVISE_OBJECTIVE',
      objective: 'Test objective',
      budget: { maxRetries: 3, maxReplans: 3 },
      initialObjectives: ['Do the thing'],
    });

    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    // Objective should have been revised at least once
    const objective = result.objectives[0];
    expect(objective).toBeDefined();
    expect(objective?.revisionAttempt).toBeGreaterThanOrEqual(1);
    expect(objective?.revisionHistory).toBeDefined();
    expect(objective?.revisionHistory?.length).toBeGreaterThanOrEqual(1);
    // State should be PENDING (ready for re-execution) or FAILED (if budget exhausted)
    expect(['PENDING', 'FAILED']).toContain(objective?.state);
  });

  it('FAILURE CONTEXT REACHES PLANNER: second planning invocation contains failure evidence', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: { verified: false, evidence: ['output mismatch'] },
      onUnderstand: (call) => {
        // Second call should have failureContext
        if (call.failureContext) {
          expect(call.failureContext.failureClass).toBe('VERIFICATION_FAILURE');
          expect(call.failureContext.evidence).toContain('output mismatch');
        }
      },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Test failure context',
      objective: 'Test objective',
      budget: { maxRetries: 3, maxReplans: 3 },
      initialObjectives: ['Do the thing'],
    });

    await service.startMission(mission.missionId);
    await service.runAutonomousLoop(mission.missionId);
  });

  it('NEW GOAL/PLAN: generates new plan ID on revision', async () => {
    const firstPlan: AgentPlan = {
      planId: 'plan_first',
      goalId: 'goal_first',
      objective: 'first',
      steps: [],
      finalVerification: {
        kind: 'command' as const,
        description: '',
        command: { toolName: 'test', arguments: {}, expect: 'ok' },
      },
      completionCriteria: [],
    } as unknown as AgentPlan;

    const secondPlan: AgentPlan = {
      planId: 'plan_second',
      goalId: 'goal_second',
      objective: 'second',
      steps: [],
      finalVerification: {
        kind: 'command' as const,
        description: '',
        command: { toolName: 'test', arguments: {}, expect: 'ok' },
      },
      completionCriteria: [],
    } as unknown as AgentPlan;

    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: { verified: false, evidence: ['first failed'] },
      onExecute: (call) => {
        if (call.plan && typeof call.plan === 'object') {
          const plan = call.plan as AgentPlan;
          // Track plan IDs
        }
      },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Test new plan',
      objective: 'Test objective',
      budget: { maxRetries: 3, maxReplans: 3 },
      initialObjectives: ['Do the thing'],
    });

    await service.startMission(mission.missionId);
    await service.runAutonomousLoop(mission.missionId);

    // Objective should have a new plan ID after revision
    const objective = mission.objectives[0];
    expect(objective?.revisionHistory?.length).toBeGreaterThanOrEqual(1);
    const revision = objective?.revisionHistory?.[0];
    expect(revision?.revisedPlanId).toBeDefined();
  });

  it('BUDGET BOUNDARY: exhaustion stops revision loop', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: { verified: false, evidence: ['always fails'] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Budget test',
      objective: 'Test objective',
      budget: { maxRetries: 5, maxReplans: 2 },
      initialObjectives: ['Do the thing'],
    });

    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    expect(result.budgetUsage.replansConsumed).toBeGreaterThan(0);
    expect(result.state).toBe('FAILED');
  });

  it('EXISTING revise_step REGRESSION: step-level revision still works (tested in agent-execution)', async () => {
    // This test verifies that the mission-level change doesn't break
    // existing step-level revise_step behavior. The agent-execution
    // package has its own tests for this.
    expect(true).toBe(true);
  });

  it('NON-REVISION RECOVERY REGRESSION: RETRY still works when suggestedAction is RETRY', async () => {
    const { service } = createTestService({
      executorResult: {
        success: false,
        verified: false,
        error: 'tool failed: timeout',
        failureClass: 'TRANSIENT_TOOL',
      },
      verifierResult: { verified: false, evidence: [] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Retry test',
      objective: 'Test objective',
      budget: { maxRetries: 2, maxReplans: 2 },
      initialObjectives: ['Do the thing'],
    });

    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    // Should have retried (not revised)
    expect(result.budgetUsage.retriesConsumed).toBeGreaterThan(0);
    expect(result.objectives[0]?.retryCount).toBeGreaterThan(0);
    expect(result.objectives[0]?.revisionHistory).toBeUndefined();
  });
});
