// VedMoulya — Mission Controller: Objective Selection & Recovery
// BLD-021A PHASE 4/5/16 — objective prioritization, bounded recovery,
// provider-directive injection rejection.
import { describe, it, expect } from 'vitest';
import { createTestService, createTestMission, createTestProviderStatus } from './fixtures.js';
import { DeterministicObjectiveSelector } from '../domain/objective-selector.js';
import { SimpleGoalUnderstanding } from '../domain/goal-understanding.js';

describe('Objective Selection & Prioritization', () => {
  it('selects the highest-priority objective first (lower number wins)', async () => {
    const selector = new DeterministicObjectiveSelector();
    const mission = createTestMission();
    mission.objectives = [
      {
        objectiveId: 'o_high',
        priority: 0,
        state: 'PENDING',
        dependencies: [],
        missionId: 'm',
        title: '',
        objective: '',
        description: '',
        reason: '',
        evidence: [],
        estimatedComplexity: 'MEDIUM',
        estimatedCost: 0,
        stateHistory: ['PENDING'],
        retryCount: 0,
        maxRetries: 3,
        createdAt: '',
        updatedAt: '',
      },
      {
        objectiveId: 'o_low',
        priority: 9,
        state: 'PENDING',
        dependencies: [],
        missionId: 'm',
        title: '',
        objective: '',
        description: '',
        reason: '',
        evidence: [],
        estimatedComplexity: 'MEDIUM',
        estimatedCost: 0,
        stateHistory: ['PENDING'],
        retryCount: 0,
        maxRetries: 3,
        createdAt: '',
        updatedAt: '',
      },
    ] as never;

    const result = await selector.selectNextObjective(mission, [], createTestProviderStatus());
    expect(result.selected).toBe(true);
    expect(result.objectiveId).toBe('o_high');
    expect(result.alternativesConsidered).toContain('o_low');
  });

  it('does not select an objective whose dependencies are unsatisfied', async () => {
    const selector = new DeterministicObjectiveSelector();
    const mission = createTestMission();
    mission.objectives = [
      { objectiveId: 'dependent', priority: 0, state: 'PENDING', dependencies: ['missing_prereq'] },
    ] as never;

    // 'dependent' requires 'missing_prereq' (never verified) — nothing selectable.
    const result = await selector.selectNextObjective(mission, [], createTestProviderStatus());
    expect(result.selected).toBe(false);
  });

  it('skips objectives already verified', async () => {
    const selector = new DeterministicObjectiveSelector();
    const mission = createTestMission();
    mission.objectives = [
      { objectiveId: 'done', priority: 0, state: 'VERIFIED', dependencies: [] },
      { objectiveId: 'next', priority: 1, state: 'PENDING', dependencies: [] },
    ] as never;
    const result = await selector.selectNextObjective(
      mission,
      ['done'],
      createTestProviderStatus(),
    );
    expect(result.selected).toBe(true);
    expect(result.objectiveId).toBe('next');
  });

  it('goal understanding extracts capabilities, constraints and complexity', async () => {
    const gu = new SimpleGoalUnderstanding();
    const result = await gu.understandGoal(
      'Implement code and write tests for the fix',
      'Improve VedMoulya',
      { allowedTools: ['read_file', 'run_tests'] },
    );
    expect(result.requiredCapabilities).toContain('coding');
    expect(result.requiredCapabilities).toContain('testing');
    expect(result.constraints.some((c) => c.includes('read_file'))).toBe(true);
    expect(result.estimatedComplexity).toBe('MEDIUM');
  });
});

describe('Bounded Recovery', () => {
  it('tool failure is classified transient → bounded retry, never infinite', async () => {
    const { service } = createTestService({
      executorResult: {
        success: false,
        verified: false,
        error: 'tool failed: run_tests crashed',
        failureClass: 'TRANSIENT_TOOL',
      },
      verifierResult: { verified: false, evidence: [] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Flaky tool',
      objective: 'Run the tests',
      budget: { maxRetries: 2 },
      initialObjectives: ['Execute test suite'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);
    // Retry budget (2) was consumed then the ceiling stopped it — never infinite.
    expect(result.budgetUsage.retriesConsumed).toBe(2);
    expect(result.state).toBe('FAILED');
    expect(result.outcomeReason).toContain('Maximum retries');
    expect(result.objectives[0]?.verifiedOutcome).toBeUndefined();
  });

  it('permission-denial tool failure is NOT retried (classifier blocks)', async () => {
    const { service } = createTestService({
      executorResult: {
        success: false,
        verified: false,
        error: 'permission denied: cannot write /etc',
        failureClass: 'PERMISSION_DENIED',
      },
      verifierResult: { verified: false, evidence: [] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Denied tool',
      objective: 'Write config',
      initialObjectives: ['Write config file'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);
    expect(result.objectives[0]?.retryCount).toBe(0);
    expect(result.budgetUsage.retriesConsumed).toBe(0);
  });
});

describe('Provider Directive Injection', () => {
  it('mission never trusts provider/model directives from objectives — provider selection stays in the port', async () => {
    // The objective text claims a specific provider; the mission must ignore it
    // and select exclusively via ProviderAvailabilityPort (frozen routing).
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
    providerAvailability.setProviderHealth('ollama', true);

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Injection attempt',
      objective: 'Use gemini-ultra-pro-max exclusively',
      constraints: { requiredCapabilities: ['coding'] },
      initialObjectives: ['Do the work'],
    });
    await service.startMission(mission.missionId);
    // Execution carries no provider/model directive — only plan/constraints.
    const status = await service.runAutonomousLoop(mission.missionId);
    // Availability comes from the routing port, not from objective text.
    const ps = await providerAvailability.getProviderStatus(['coding']);
    expect(ps.capableProviders[0]?.providerId).toBe('ollama');
    expect(status.objectives[0]?.state).toBe('VERIFIED');
  });
});
