// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S10 · Recovery-state policy (BLOCKED) + lease ownership
//
// S10 priority 4/5:
//   • a BLOCKED mission is auto-resumed ONLY when its recorded reason is
//     provably transient and safe — no reason the system can currently produce
//     qualifies, so the policy is "retain BLOCKED, expose the reason, require
//     the operator", and that is asserted rather than assumed;
//   • the documented operator action must actually work (BLOCKED is cleared
//     with the state machine's own UNBLOCK transition);
//   • durable leases keep their existing ownership/expiry semantics: a LIVE
//     lease is never touched and a genuinely EXPIRED one is healed (LEASE-01
//     added renewal, so a still-running objective no longer expires mid-attempt;
//     see lease-renewal.test.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { assessBlockedRecovery, mayAutoResumeBlocked } from '../domain/recovery-policy.js';
import { createTestService } from './fixtures.js';

/** Every block reason the codebase can actually produce. */
const REAL_BLOCK_REASONS = [
  'No selectable objective with satisfied dependencies',
  'Watchdog: mission RUNNING with no progress since 2026-10-13T09:00:00.000Z — transitioned to a recoverable state',
  'Durability barrier: objective_result:obj_1:VERIFIED could not be persisted after 3 attempt(s) (simulated persistence outage) — the outcome is NOT acknowledged as durable; resume after persistence recovers.',
  'Recovery failed for mission: workspace is not inside the authorized workspace root',
];

describe('S10 · BLOCKED recovery classification', () => {
  it('never classifies a REAL block reason as auto-safe', () => {
    for (const reason of REAL_BLOCK_REASONS) {
      const assessment = assessBlockedRecovery(reason);
      expect(assessment.requirement).not.toBe('AUTO_SAFE');
      expect(mayAutoResumeBlocked(reason)).toBe(false);
      expect(assessment.rationale.length).toBeGreaterThan(0);
      expect(assessment.operatorAction).toBeDefined();
    }
  });

  it('classifies a dependency block as an external condition with a concrete action', () => {
    const assessment = assessBlockedRecovery('No selectable objective with satisfied dependencies');
    expect(assessment.requirement).toBe('EXTERNAL_CONDITION');
    expect(assessment.operatorAction).toMatch(/dependency/i);
  });

  it('classifies a durability-barrier block as operator action (never a blind retry)', () => {
    const assessment = assessBlockedRecovery(
      'Durability barrier: terminal:COMPLETE could not be persisted after 3 attempt(s)',
    );
    expect(assessment.requirement).toBe('OPERATOR_ACTION');
    expect(assessment.rationale).toMatch(/not be re-run blindly|durably recorded/i);
  });

  it('treats a missing or unknown reason as NOT recoverable', () => {
    for (const reason of [undefined, '', '   ', 'some future unclassified condition']) {
      const assessment = assessBlockedRecovery(reason);
      expect(assessment.requirement).toBe('OPERATOR_ACTION');
      expect(assessment.operatorAction).toBeDefined();
    }
  });
});

describe('S10 · recovery passes never auto-resume a BLOCKED mission', () => {
  it('leaves BLOCKED alone but exposes the reason and the operator action', async () => {
    const { service, store } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Blocked mission',
      objective: 'Do the work',
      initialObjectives: ['Objective'],
    });
    await service.startMission(mission.missionId);
    // No selectable objective → the EXISTING dependency block path.
    const blocked = await service.runAutonomousLoop(mission.missionId);

    // (A single objective always completes; force the block explicitly through
    // the existing BLOCK command path by blocking a mission with no work.)
    expect(blocked.state).toBe('COMPLETED');

    const empty = await service.createMission({
      userId: 'u1',
      title: 'No objectives',
      objective: 'Nothing',
      initialObjectives: [],
    });
    await service.startMission(empty.missionId);
    const blockedEmpty = await service.runAutonomousLoop(empty.missionId);
    expect(blockedEmpty.state).toBe('BLOCKED');
    expect(blockedEmpty.outcomeReason).toContain('No selectable objective');

    // Recovery passes must not touch it: no automatic continuation, ever.
    const recovery = await service.recoverAllActive();
    expect(recovery.resumableMissionIds).not.toContain(empty.missionId);
    expect((await store.get(empty.missionId))?.state).toBe('BLOCKED');

    // The classification is derivable from the DURABLE record (what the API
    // exposes as `recoveryRequirement`).
    const assessment = assessBlockedRecovery(blockedEmpty.outcomeReason);
    expect(assessment.requirement).toBe('EXTERNAL_CONDITION');
  });

  it('the documented operator action works: BLOCKED is cleared with UNBLOCK', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Operator resume',
      objective: 'Nothing to do',
      initialObjectives: [],
    });
    await service.startMission(mission.missionId);
    const blocked = await service.runAutonomousLoop(mission.missionId);
    expect(blocked.state).toBe('BLOCKED');

    // Before S10 this raised "Illegal mission transition: BLOCKED -> RESUME"
    // because the state machine's own UNBLOCK transition was never dispatched.
    const resumed = await service.resumeMission(mission.missionId);
    expect(resumed.state).toBe('RUNNING');
    expect(resumed.stateHistory).toContain('BLOCKED');
  });

  it('a watchdog-blocked mission is also resumable by the operator', async () => {
    const { service, store } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Stuck mission',
      objective: 'Do work',
      initialObjectives: ['Objective'],
    });
    await service.startMission(mission.missionId);
    const stored = await store.get(mission.missionId);
    if (stored) {
      // Persisted as RUNNING with no progress and no lease.
      stored.updatedAt = '2020-01-01T00:00:00.000Z';
      await store.save(stored);
    }

    const stuck = await service.detectStuckMission(mission.missionId, 1_000);
    expect(stuck?.state).toBe('BLOCKED');
    expect(assessBlockedRecovery(stuck?.outcomeReason).requirement).toBe('OPERATOR_ACTION');

    const resumed = await service.resumeMission(mission.missionId);
    expect(resumed.state).toBe('RUNNING');
  });
});

describe('S10 · lease ownership and the documented boundary', () => {
  it('a LIVE lease is never touched; an EXPIRED lease is healed to READY', async () => {
    const { service, store } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Lease semantics',
      objective: 'Do work',
      initialObjectives: ['Objective'],
    });
    await service.startMission(mission.missionId);
    const objectiveId = (await store.get(mission.missionId))?.objectives[0]?.objectiveId;
    expect(objectiveId).toBeDefined();

    // (1) LIVE lease — another owner is presumed alive.
    await store.acquireObjectiveLease(mission.missionId, objectiveId as string, {
      owner: 'live-worker',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const untouched = await service.recoverMission(mission.missionId);
    const live = untouched.objectives.find((o) => o.objectiveId === objectiveId);
    expect(live?.state).toBe('RUNNING');
    expect(live?.lease?.owner).toBe('live-worker');

    // (2) EXPIRED lease — the owner is presumed dead and the objective is
    // healed to READY (recoverable, re-runnable exactly once by the next loop).
    const stored = await store.get(mission.missionId);
    if (stored?.objectives[0]) {
      stored.objectives[0].lease = {
        owner: 'dead-worker',
        acquiredAt: '2020-01-01T00:00:00.000Z',
        expiresAt: '2020-01-01T00:01:00.000Z',
      };
      await store.save(stored);
    }
    const healed = await service.recoverMission(mission.missionId);
    const recovered = healed.objectives.find((o) => o.objectiveId === objectiveId);
    expect(recovered?.state).toBe('READY');
    expect(recovered?.lease).toBeUndefined();
    // A lease that genuinely EXPIRED (no owner renewed it) is treated as
    // abandoned. LEASE-01 removed the old "an execution that outlives its TTL is
    // abandoned" boundary: a running objective now RENEWS its lease, so only a
    // crashed/stale owner ever reaches this state.
    expect(healed.activity?.some((a) => a.kind === 'RECOVERY_LEASE_EXPIRED')).toBe(true);
  });
});
