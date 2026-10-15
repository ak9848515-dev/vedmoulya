// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Sprint 020A · Mission budget ceiling regression (negative)
//
// Closes the Sprint-019 evidence gap "explicit negative ceiling regression": a
// deterministic test that PROVOKES the ceiling in isolation and proves the
// controller REFUSES work beyond it, at the CONTROLLER boundary, with no
// false success.
//
// The negative counterpart to `budget-limits.test.ts` (which asserts the
// happy-path "stops at N objectives"). Here we assert the refusal explicitly:
//   - the objective ceiling is refused at the controller boundary,
//   - no objective beyond the ceiling is ever STARTED or EXECUTED,
//   - the refusal is an honest FAIL with an explicit reason, never a fabricated
//     success and never an unacknowledged continuation,
//   - the same holds for the action ceiling.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { createTestService } from './fixtures.js';

describe('020A · Mission ceiling is enforced at the controller boundary (negative)', () => {
  it('refuses to start work beyond maxObjectives and never fabricates success', async () => {
    const executed: string[] = [];
    const { service } = createTestService({
      onExecute: (call) => {
        executed.push((call.plan as { objective?: string }).objective ?? '');
      },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Bounded mission',
      objective: 'Do bounded work',
      budget: { maxObjectives: 2, maxRetries: 0 },
      initialObjectives: ['O1', 'O2', 'O3', 'O4'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);

    // The ceiling is a HARD stop at the controller boundary.
    expect(done.budgetUsage.objectivesCompleted).toBe(2);
    expect(done.budgetUsage.objectivesFailed).toBe(0);
    expect(done.state).toBe('FAILED');
    expect(done.outcome).toBe('FAILED');
    expect(done.outcomeReason).toBe('Maximum objectives reached');

    // Objectives beyond the ceiling were never STARTED, let alone executed.
    expect(executed).toHaveLength(2);
    expect(done.objectives[2]?.state).toBe('PENDING');
    expect(done.objectives[3]?.state).toBe('PENDING');
    expect(done.objectives[2]?.verifiedOutcome).toBeUndefined();
    expect(done.objectives[3]?.verifiedOutcome).toBeUndefined();
  });

  it('refuses a further action once maxActions is reached — no fabricated verification', async () => {
    const executed: string[] = [];
    const { service } = createTestService({
      onExecute: (call) => {
        executed.push((call.plan as { objective?: string }).objective ?? '');
      },
    });

    // Each objective consumes exactly one action, so maxActions: 1 permits a
    // single execution and then the action ceiling must refuse the next one.
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Action-bounded mission',
      objective: 'Do action-bounded work',
      budget: { maxObjectives: 10, maxActions: 1, maxRetries: 0 },
      initialObjectives: ['A1', 'A2'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);

    expect(executed).toHaveLength(1);
    expect(done.budgetUsage.actionsExecuted).toBe(1);
    expect(done.state).toBe('FAILED');
    expect(done.outcomeReason).toBe('Maximum actions reached');
    // The refused objective carries no false verification.
    const refused = done.objectives.find((o) => o.state !== 'VERIFIED');
    expect(refused?.state).toBe('PENDING');
    expect(refused?.verifiedOutcome).toBeUndefined();
  });

  it('never reports a completed objective count above the objective ceiling', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Ceiling invariant',
      objective: 'Work',
      budget: { maxObjectives: 3, maxRetries: 1 },
      initialObjectives: ['W1', 'W2', 'W3', 'W4', 'W5'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);

    const consumed = done.budgetUsage.objectivesCompleted + done.budgetUsage.objectivesFailed;
    expect(consumed).toBeLessThanOrEqual(done.budget.maxObjectives);
    expect(done.budgetUsage.actionsExecuted).toBeLessThanOrEqual(done.budget.maxActions);
    expect(done.objectives.filter((o) => o.state === 'VERIFIED')).toHaveLength(
      done.budgetUsage.objectivesCompleted,
    );
  });
});
