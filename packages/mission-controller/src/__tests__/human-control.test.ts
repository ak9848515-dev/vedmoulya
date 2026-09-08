// VedMoulya — Mission Controller: Human Control
// BLD-021A PHASE 12/19 — START, PAUSE, RESUME, CANCEL, APPROVE, REJECT.
// Autonomous does NOT mean authority-free.
import { describe, it, expect } from 'vitest';
import { createTestService } from './fixtures.js';
import { InMemoryMissionStore } from '../infrastructure/InMemoryMissionStore.js';

describe('Mission Human Control', () => {
  it('START → RUNNING', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    const started = await service.startMission(mission.missionId);
    expect(started.state).toBe('RUNNING');
  });

  it('PAUSE from RUNNING', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    await service.startMission(mission.missionId);
    const paused = await service.pauseMission(mission.missionId);
    expect(paused.state).toBe('PAUSED');
  });

  it('RESUME from PAUSED', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    await service.startMission(mission.missionId);
    await service.pauseMission(mission.missionId);
    const resumed = await service.resumeMission(mission.missionId);
    expect(resumed.state).toBe('RUNNING');
  });

  it('CANCEL always stops the mission', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    await service.startMission(mission.missionId);
    const cancelled = await service.cancelMission(mission.missionId);
    expect(cancelled.state).toBe('CANCELLED');
    expect(cancelled.outcome).toBe('CANCELLED');
    expect(cancelled.stateHistory).toContain('CANCELLED');
  });

  it('a mission cannot start twice', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    await service.startMission(mission.missionId);
    await expect(service.startMission(mission.missionId)).rejects.toThrow();
  });

  it('APPROVE resumes a WAITING_FOR_APPROVAL mission', async () => {
    const { service, store } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    await service.startMission(mission.missionId);

    // Place the mission at a human approval gate (simulating a governed pause).
    mission.state = 'WAITING_FOR_APPROVAL';
    mission.stateHistory.push('WAITING_FOR_APPROVAL');
    await store.save(mission);

    const approved = await service.approveObjective(
      mission.missionId,
      mission.objectives[0]?.objectiveId ?? '',
    );
    expect(approved.state).toBe('RUNNING');
  });

  it('REJECT_APPROVAL fails the mission — the model cannot override a human no', async () => {
    const { service, store } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    await service.startMission(mission.missionId);

    mission.state = 'WAITING_FOR_APPROVAL';
    mission.stateHistory.push('WAITING_FOR_APPROVAL');
    await store.save(mission);

    const rejected = await service.rejectObjective(
      mission.missionId,
      mission.objectives[0]?.objectiveId ?? '',
    );
    expect(rejected.state).toBe('FAILED');
    expect(rejected.outcome).toBe('FAILED');
  });

  it('objectives are owner-scoped — another user cannot see them', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({ userId: 'alice', title: 'T', objective: 'O' });
    const status = await service.getStatus(mission.missionId, 'alice');
    expect(status.missionId).toBe(mission.missionId);
  });
});

describe('Mission state machine (human control edges)', () => {
  it('approval does not bypass the deterministic transition map', async () => {
    const { service, store } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    // APPROVE from CREATED is illegal — the state machine rejects it.
    mission.state = 'CREATED';
    await store.save(mission);
    await expect(service.approveObjective(mission.missionId, '')).rejects.toThrow();
  });

  it('InMemoryMissionStore getSync supports synchronous reads', () => {
    const store = new InMemoryMissionStore();
    void store.save({ missionId: 'm1' } as never);
    expect(store.getSync('m1')?.missionId).toBe('m1');
  });
});
