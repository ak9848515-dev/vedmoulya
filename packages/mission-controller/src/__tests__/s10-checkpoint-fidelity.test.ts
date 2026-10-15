// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S10 · Checkpoint fidelity
//
// S10 priority 2: a resume must RESTORE the checkpoint fields it is
// authoritative for instead of merely checking that a checkpoint exists, the
// latest-checkpoint selection must return the NEWEST VALID checkpoint, and an
// older checkpoint must never overwrite newer durable state.
//
// Promote-only semantics are asserted directly: the only thing a checkpoint may
// change is an objective the mission document does not already record as
// verified.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { MissionCheckpoint } from '../types/mission-types.js';
import { InMemoryCheckpointStore } from '../infrastructure/InMemoryCheckpointStore.js';
import { createTestService } from './fixtures.js';

function checkpoint(
  partial: Partial<MissionCheckpoint> & { checkpointId: string; timestamp: string },
): MissionCheckpoint {
  return {
    missionId: 'm1',
    objectiveId: 'o1',
    state: 'PENDING',
    completedWork: [],
    remainingWork: [],
    failures: [],
    recoveryHistory: [],
    learningReferences: [],
    experienceReferences: [],
    budgetRemaining: { objectives: 1, actions: 1, runtimeMs: 1, tokens: 1, costUsd: 1 },
    ...partial,
  };
}

describe('S10 · latest-checkpoint selection', () => {
  it('returns the NEWEST checkpoint by timestamp, not the last inserted', async () => {
    const store = new InMemoryCheckpointStore();
    // Inserted newest-first: insertion order would return the OLDEST.
    await store.save(checkpoint({ checkpointId: 'newest', timestamp: '2026-10-13T10:00:00.000Z' }));
    await store.save(checkpoint({ checkpointId: 'oldest', timestamp: '2026-10-13T09:00:00.000Z' }));
    await store.save(checkpoint({ checkpointId: 'middle', timestamp: '2026-10-13T09:30:00.000Z' }));

    const latest = await store.getLatestForMission('m1');
    expect(latest?.checkpointId).toBe('newest');
  });

  it('skips a checkpoint with an unparseable timestamp (newest VALID wins)', async () => {
    const store = new InMemoryCheckpointStore();
    await store.save(checkpoint({ checkpointId: 'valid', timestamp: '2026-10-13T10:00:00.000Z' }));
    await store.save(checkpoint({ checkpointId: 'corrupt', timestamp: 'not-a-date' }));

    const latest = await store.getLatestForMission('m1');
    expect(latest?.checkpointId).toBe('valid');
  });

  it('breaks a timestamp tie with the later insertion', async () => {
    const store = new InMemoryCheckpointStore();
    const same = '2026-10-13T10:00:00.000Z';
    await store.save(checkpoint({ checkpointId: 'first', timestamp: same }));
    await store.save(checkpoint({ checkpointId: 'second', timestamp: same }));

    const latest = await store.getLatestForMission('m1');
    expect(latest?.checkpointId).toBe('second');
  });

  it('returns undefined when no checkpoint is valid', async () => {
    const store = new InMemoryCheckpointStore();
    await store.save(checkpoint({ checkpointId: 'corrupt', timestamp: 'nope' }));
    expect(await store.getLatestForMission('m1')).toBeUndefined();
  });
});

describe('S10 · promote-only checkpoint restore', () => {
  it('never demotes or double-counts an objective the mission already records as verified', async () => {
    const { service, checkpointStore, store } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Promote only',
      objective: 'Two objectives',
      initialObjectives: ['First objective', 'Second objective'],
    });
    await service.startMission(mission.missionId);

    // Objective 1 verified; the mission is still RUNNING with work left.
    await service.runNextObjective(mission.missionId);
    const afterFirst = await store.get(mission.missionId);
    expect(afterFirst?.objectives[0]?.state).toBe('VERIFIED');
    expect(afterFirst?.budgetUsage.objectivesCompleted).toBe(1);

    // An OLDER checkpoint claims objective 1 was still PENDING. It must have
    // no effect whatsoever: the mission document is newer and authoritative.
    await checkpointStore.save(
      checkpoint({
        checkpointId: 'stale',
        missionId: mission.missionId,
        objectiveId: afterFirst?.objectives[0]?.objectiveId ?? 'o1',
        state: 'PENDING',
        timestamp: '2020-01-01T00:00:00.000Z',
        verifiedOutcome: undefined,
      }),
    );

    // Resuming advances ONE objective (the remaining PENDING one) — exactly the
    // pre-existing one-step semantics of resumeFromCheckpoint.
    const resumed = await service.resumeFromCheckpoint(mission.missionId);

    // No demotion, no restored result and NO DOUBLE COUNT of the already
    // verified objective — the stale checkpoint had no effect at all.
    expect(resumed.objectives[0]?.state).toBe('VERIFIED');
    expect(resumed.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    expect(resumed.objectives[1]?.state).toBe('VERIFIED');
    expect(resumed.budgetUsage.objectivesCompleted).toBe(2);
    expect(resumed.activity?.some((a) => a.kind === 'CHECKPOINT_RESTORED')).toBe(false);

    // And the mission still completes through the existing loop.
    const done = await service.runAutonomousLoop(mission.missionId);
    expect(done.state).toBe('COMPLETED');
    expect(done.budgetUsage.objectivesCompleted).toBe(2);
  });

  it('restores a verified result the mission document lost, counting it once', async () => {
    const { service, checkpointStore, store } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Restore',
      objective: 'One objective',
      initialObjectives: ['Only objective'],
    });
    await service.startMission(mission.missionId);
    await service.runNextObjective(mission.missionId);

    // Simulate a lost mission write: strip the verified result from the
    // persisted mission and roll its verified counter back, exactly as a
    // rolled-back document would look. The checkpoint is untouched.
    const live = await store.get(mission.missionId);
    const objective = live?.objectives[0];
    expect(objective?.state).toBe('VERIFIED');
    if (live && live.objectives[0]) {
      live.objectives[0].state = 'READY';
      live.objectives[0].verifiedOutcome = undefined;
      live.objectives[0].stateHistory = ['PENDING', 'READY'];
      live.budgetUsage.objectivesCompleted = 0;
      live.state = 'RUNNING';
      live.stateHistory = ['CREATED', 'RUNNING'];
      await store.save(live);
    }

    const resumed = await service.resumeFromCheckpoint(mission.missionId);

    expect(resumed.objectives[0]?.state).toBe('VERIFIED');
    expect(resumed.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    expect(resumed.budgetUsage.objectivesCompleted).toBe(1);
    expect(resumed.state).toBe('COMPLETED');
    expect(resumed.activity?.some((a) => a.kind === 'CHECKPOINT_RESTORED')).toBe(true);
    const durable = await store.get(mission.missionId);
    expect(durable?.objectives[0]?.state).toBe('VERIFIED');
  });

  it('still refuses to resume when no checkpoint exists at all', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'No checkpoint',
      objective: 'Nothing yet',
      initialObjectives: ['Objective'],
    });
    await expect(service.resumeFromCheckpoint(mission.missionId)).rejects.toThrow(
      /No checkpoint found/,
    );
  });
});
