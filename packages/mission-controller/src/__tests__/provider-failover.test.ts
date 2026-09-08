// VedMoulya — Mission Controller: Provider Failover Tests
// BLD-021A PHASE 9/10/21/27 — Provider failure survival, local providers,
// all-provider-unavailable, provider recovery.
import { describe, it, expect } from 'vitest';
import { createTestService } from './fixtures.js';

describe('Mission Provider Failover', () => {
  it('mission survives an individual provider failure when another capable provider exists', async () => {
    const { service, providerAvailability } = createTestService({
      providers: [
        {
          providerId: 'gemini',
          modelId: 'gemini-pro',
          capabilities: ['coding', 'testing'],
          healthy: true,
        },
        {
          providerId: 'ollama',
          modelId: 'llama3',
          capabilities: ['coding', 'testing'],
          healthy: true,
        },
      ],
    });

    // Primary provider goes down — alternate must still satisfy capability.
    providerAvailability.setProviderHealth('gemini', false);
    const status = await providerAvailability.getProviderStatus(['coding']);
    expect(status.available).toBe(true);
    expect(status.capableProviders[0]?.providerId).toBe('ollama');

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Improve VedMoulya',
      objective: 'Write tests',
      initialObjectives: ['Fix failing test'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    expect(done.objectives[0]?.state).toBe('VERIFIED');
    expect(done.state).toBe('COMPLETED');
  });

  it('local provider (ollama) participates through the same provider contract', async () => {
    const { service, providerAvailability } = createTestService({
      providers: [
        {
          providerId: 'ollama',
          modelId: 'llama3',
          capabilities: ['coding', 'testing'],
          healthy: true,
        },
      ],
    });
    const status = await providerAvailability.getProviderStatus(['coding', 'testing']);
    expect(status.available).toBe(true);
    expect(status.capableProviders[0]?.providerId).toBe('ollama');
    expect(status.capableProviders[0]?.modelId).toBe('llama3');

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Local mission',
      objective: 'Use local AI',
      constraints: { requiredCapabilities: ['coding', 'testing'] },
      initialObjectives: ['Add unit tests'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    expect(done.objectives[0]?.state).toBe('VERIFIED');
  });

  it('no capable provider → WAITING_FOR_PROVIDER with persisted checkpoint', async () => {
    const { service, providerAvailability, checkpointStore } = createTestService({
      providers: [
        { providerId: 'gemini', modelId: 'gemini-pro', capabilities: ['coding'], healthy: true },
      ],
    });
    providerAvailability.setProviderHealth('gemini', false);

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Blocked mission',
      objective: 'Do work',
      constraints: { requiredCapabilities: ['coding'] },
      initialObjectives: ['Implement feature'],
    });
    await service.startMission(mission.missionId);
    const waiting = await service.runAutonomousLoop(mission.missionId);

    expect(waiting.state).toBe('WAITING_FOR_PROVIDER');
    expect(waiting.outcomeReason).toContain('No capable provider');

    // PHASE 21: checkpoint must be persisted so state is not lost.
    const latest = await checkpointStore.getLatestForMission(mission.missionId);
    expect(latest).toBeDefined();
    expect(latest?.missionId).toBe(mission.missionId);
    expect(latest?.remainingWork).toContain('Implement feature');
  });

  it('provider restored → mission resumes safely from verified state', async () => {
    const { service, providerAvailability } = createTestService({
      providers: [
        {
          providerId: 'gemini',
          modelId: 'gemini-pro',
          capabilities: ['coding', 'testing'],
          healthy: true,
        },
      ],
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Resume mission',
      objective: 'Fix code',
      initialObjectives: ['Fix bug', 'Add test'],
    });
    await service.startMission(mission.missionId);

    // Provider disappears mid-run → wait.
    providerAvailability.setProviderHealth('gemini', false);
    const waiting = await service.runAutonomousLoop(mission.missionId);
    expect(waiting.state).toBe('WAITING_FOR_PROVIDER');

    // Provider restored → resume via PROVIDER_AVAILABLE.
    providerAvailability.setProviderHealth('gemini', true);
    const resumed = await service.resumeMission(mission.missionId);
    expect(resumed.state).toBe('RUNNING');

    const completed = await service.runAutonomousLoop(mission.missionId);
    expect(completed.state).toBe('COMPLETED');
    expect(completed.objectives.filter((o) => o.state === 'VERIFIED').length).toBe(2);
  });
});
