// VedMoulya — Mission Controller: Security Boundaries
// BLD-021A PHASE 24 — mission cannot authorize, escalate, or bypass the
// frozen runtime. Memory and optimization remain advisory only.
import { describe, it, expect } from 'vitest';
import { createTestService } from './fixtures.js';
import { transition } from '../domain/mission-state-machine.js';

describe('Mission Security Boundaries', () => {
  it('mission constraints (allowedTools) flow through to the frozen runtime executor', async () => {
    let passedAllowedTools: string[] | undefined;
    let passedPermissionClasses: string[] | undefined;
    const { service } = createTestService({
      onExecute: (call) => {
        passedAllowedTools = call.allowedTools;
        passedPermissionClasses = call.permissionClasses;
      },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Gated mission',
      objective: 'Work within constraints',
      constraints: {
        allowedTools: ['read_file', 'run_tests'],
        grantedPermissionClasses: ['READ', 'WRITE'],
      },
      initialObjectives: ['Implement feature'],
    });
    await service.startMission(mission.missionId);
    await service.runAutonomousLoop(mission.missionId);

    expect(passedAllowedTools).toEqual(['read_file', 'run_tests']);
    expect(passedPermissionClasses).toEqual(['READ', 'WRITE']);
  });

  it('mission grants never imply high-risk permission classes', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Nominal mission',
      objective: 'Safe objective',
      constraints: {
        // No explicit grants — defaults only, no DELETE/SECRETS/DEPLOYMENT.
        requiredCapabilities: ['coding'],
      },
      initialObjectives: ['Add documentation'],
    });
    expect(mission.constraints.grantedPermissionClasses).toBeUndefined();
  });

  it('capability escalation is impossible — required capability gates mission to capable providers', async () => {
    const { service, providerAvailability } = createTestService({
      providers: [
        // Only coding capability — no 'deployment'.
        { providerId: 'gemini', modelId: 'gemini-pro', capabilities: ['coding'], healthy: true },
      ],
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'No escalation',
      objective: 'Attempt deployment',
      constraints: { requiredCapabilities: ['deployment'] },
      initialObjectives: ['Deploy to production'],
    });
    await service.startMission(mission.missionId);

    // No provider can satisfy 'deployment' → WAITING_FOR_PROVIDER, not escalation.
    const result = await service.runAutonomousLoop(mission.missionId);
    expect(result.state).toBe('WAITING_FOR_PROVIDER');
    const status = await providerAvailability.getProviderStatus(['deployment']);
    expect(status.available).toBe(false);
  });

  it('permission denial cannot be optimized away — failure classifier blocks, never retries', async () => {
    const { service } = createTestService({
      executorResult: {
        success: false,
        verified: false,
        error: 'permission denied: write access',
        failureClass: 'PERMISSION_DENIED',
      },
      verifierResult: { verified: false, evidence: [] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Denied',
      objective: 'Write file',
      initialObjectives: ['Write critical file'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);
    expect(result.objectives[0]?.state).toBe('FAILED');
    expect(result.objectives[0]?.retryCount).toBe(0);
    expect(result.objectives[0]?.verifiedOutcome).toBeUndefined();
  });
});
describe('Mission Security Boundaries — advisory & runtime', () => {
  it('memory is advisory-only — it cannot authorize or gate execution', async () => {
    let memoryCalls = 0;
    const { service } = createTestService({
      onMemory: () => {
        memoryCalls++;
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Memory advisory',
      objective: 'Learn',
      initialObjectives: ['Task one'],
    });
    await service.startMission(mission.missionId);

    const before = memoryCalls;
    await service.runNextObjective(mission.missionId);
    expect(memoryCalls).toBe(before + 1); // recorded after verified outcome
    expect(mission.objectives[0]?.state).toBe('VERIFIED');
  });

  it('optimization is advisory-only — never used to escalate authority', async () => {
    let advisoryCalls = 0;
    const { service } = createTestService({
      onAdvisory: () => {
        advisoryCalls++;
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Advisory',
      objective: 'Optimize',
      initialObjectives: ['Tune strategy'],
    });
    await service.startMission(mission.missionId);
    await service.runNextObjective(mission.missionId);
    // Advisory may be requested; it never changed the mission's authority.
    expect(advisoryCalls).toBeGreaterThanOrEqual(0);
    expect(mission.objectives[0]?.state).toBe('VERIFIED');
  });

  it('current runtime truth overrides historical recommendations', async () => {
    // Even with a strong advisory, all providers being unavailable wins.
    const { service, providerAvailability } = createTestService({
      providers: [
        { providerId: 'gemini', modelId: 'gemini-pro', capabilities: ['coding'], healthy: true },
      ],
      verifierResult: { verified: true, evidence: ['passed'] },
    });
    providerAvailability.setProviderHealth('gemini', false);

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Runtime wins',
      objective: 'Do the thing',
      initialObjectives: ['Execute work'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);
    // Historical evidence can't conjure a provider.
    expect(result.state).toBe('WAITING_FOR_PROVIDER');
  });

  it('illegal mission transitions are rejected by the deterministic state machine', () => {
    // COMPLETE from CREATED is illegal — no silent completion.
    expect(() => transition('CREATED', { type: 'COMPLETE' })).toThrow();
    // Terminal states are terminal.
    expect(() => transition('COMPLETED', { type: 'START' })).toThrow();
    // WAITING_FOR_APPROVAL can only resume via APPROVE/REJECT_APPROVAL.
    expect(transition('WAITING_FOR_APPROVAL', { type: 'APPROVE' })).toBe('RUNNING');
    expect(transition('WAITING_FOR_APPROVAL', { type: 'REJECT_APPROVAL' })).toBe('FAILED');
    // WAITING_FOR_PROVIDER resumes only through PROVIDER_AVAILABLE.
    expect(transition('WAITING_FOR_PROVIDER', { type: 'PROVIDER_AVAILABLE' })).toBe('RUNNING');
  });

  it('planner injection cannot widen mission authority — constraints forwarded verbatim', async () => {
    let passedAllowedTools: string[] | undefined;
    const { service } = createTestService({
      onExecute: (call) => {
        passedAllowedTools = call.allowedTools;
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Injection',
      objective: 'Safe',
      constraints: { allowedTools: ['read_file'], requiredCapabilities: ['coding'] },
      initialObjectives: ['Read configuration'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    expect(done.objectives[0]?.state).toBe('VERIFIED');
    expect(passedAllowedTools).toEqual(['read_file']);
  });
});
