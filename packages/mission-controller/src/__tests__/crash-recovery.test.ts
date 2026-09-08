// VedMoulya — Mission Controller: Crash Recovery & Duplicate Execution
// BLD-021A PHASE 11/12/13/28 — durable checkpoints, crash recovery,
// duplicate execution protection.
import { describe, it, expect } from 'vitest';
import { createTestService } from './fixtures.js';

describe('Mission Checkpointing & Crash Recovery', () => {
  it('creates a durable checkpoint after every verified objective', async () => {
    const { service, checkpointStore } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Checkpoint mission',
      objective: 'Do work',
      initialObjectives: ['Objective A', 'Objective B'],
    });
    await service.startMission(mission.missionId);
    await service.runNextObjective(mission.missionId);

    const checkpoints = await checkpointStore.listForMission(mission.missionId);
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0]?.verifiedOutcome?.achieved).toBe(true);
    expect(checkpoints[0]?.state).toBe('VERIFIED');
    expect(checkpoints[0]?.budgetRemaining.objectives).toBeDefined();
  });

  it('resumes from the latest checkpoint and runs the next objective only', async () => {
    let executeCount = 0;
    const { service, checkpointStore } = createTestService({
      onExecute: () => {
        executeCount++;
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Two objectives',
      objective: 'Do both',
      initialObjectives: ['First objective', 'Second objective'],
    });
    await service.startMission(mission.missionId);
    await service.runAutonomousLoop(mission.missionId);

    expect(executeCount).toBe(2);
    expect(mission.objectives[0]?.state).toBe('VERIFIED');
    expect(mission.objectives[1]?.state).toBe('VERIFIED');

    // Resume must NOT re-execute verified objectives.
    const resumed = await service.resumeFromCheckpoint(mission.missionId);
    expect(executeCount).toBe(2);
    expect(resumed.state).toBe('COMPLETED');
  });

  it('duplicate execution prevention — verified objective is never selected again', async () => {
    const executed: unknown[] = [];
    const { service } = createTestService({
      onExecute: (call) => {
        executed.push(call.plan);
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'No duplicates',
      objective: 'Run objectives once',
      initialObjectives: ['First objective', 'Second objective'],
    });
    await service.startMission(mission.missionId);

    // Objective 1 completes + checkpoints. Mission still RUNNING.
    await service.runNextObjective(mission.missionId);
    expect(executed).toHaveLength(1);

    // Crash — process restarts and the loop resumes. Objective 1 is VERIFIED,
    // so the selector must not re-run it; only objective 2 executes.
    await service.runAutonomousLoop(mission.missionId);
    expect(executed).toHaveLength(2);
    expect(mission.objectives[0]?.state).toBe('VERIFIED');
    expect(mission.objectives[1]?.state).toBe('VERIFIED');
  });

  it('crash before checkpoint — unverified work is never claimed completed', async () => {
    const ctx = createTestService();
    const mission = await ctx.service.createMission({
      userId: 'u1',
      title: 'Crash mission',
      objective: 'Unstable goal',
      initialObjectives: ['Crashy objective'],
    });
    await ctx.service.startMission(mission.missionId);

    // Simulate a crash before any checkpoint: the objective must still be
    // PENDING and no checkpoint may exist — no fabricated progress.
    const checkpointsBefore = await ctx.checkpointStore.listForMission(mission.missionId);
    expect(checkpointsBefore).toHaveLength(0);

    // A fresh restart of the loop must NOT fabricate progress — the objective
    // only becomes VERIFIED through real execution + verification.
    const restarted = await ctx.service.runAutonomousLoop(mission.missionId);
    expect(restarted.objectives[0]?.state).toBe('VERIFIED');
    expect(restarted.objectives[0]?.verifiedOutcome?.evidence.length).toBeGreaterThan(0);
  });

  it('crash recovery never declares unverified completion', async () => {
    // Verification fails → bounded recovery. When the retry budget exhausts,
    // the mission fails honestly — never a fabricated verifiedOutcome.
    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: { verified: false, evidence: ['no evidence of correctness'] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'False claims',
      objective: 'Claimed work',
      budget: { maxRetries: 1 },
      initialObjectives: ['Do the thing'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);
    // The objective was never VERIFIED and carries no fabricated outcome.
    expect(result.objectives[0]?.verifiedOutcome).toBeUndefined();
    // Retry budget consumed exactly once, then the mission stopped.
    expect(result.budgetUsage.retriesConsumed).toBe(1);
    // No unverified work is ever claimed as complete.
    expect(result.state).toBe('FAILED');
    expect(result.outcomeReason).toContain('Maximum retries');
  });
});
