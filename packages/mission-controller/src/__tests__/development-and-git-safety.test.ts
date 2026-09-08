// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: Development Mission & Git Safety Tests
// BLD-021A PHASE 5, 14, 15, 18, 24 — Development Mode, Git Safety,
// Code Completion Criteria, and Verification
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { GitSafetyPolicy, classifyGitOperation } from '../domain/git-safety-policy.js';
import { DevelopmentObjectiveSelector } from '../domain/development-objective-selector.js';
import type {
  RepositoryInspectionPort,
  RepositoryInspectionResult,
} from '../contracts/mission-ports.js';
import { createTestService, createTestMission, createTestProviderStatus } from './fixtures.js';

describe('Git Development Safety (Phase 14 & Phase 24)', () => {
  const policy = new GitSafetyPolicy();

  it('permits safe read operations without approval', () => {
    const status = policy.classifyOperation('status');
    expect(status.isSafe).toBe(true);
    expect(status.requiresApproval).toBe(false);
    expect(status.permissionClass).toBe('READ');

    const diff = policy.classifyOperation('diff');
    expect(diff.isSafe).toBe(true);
    expect(diff.requiresApproval).toBe(false);
    expect(diff.permissionClass).toBe('READ');

    const log = policy.classifyOperation('log');
    expect(log.isSafe).toBe(true);
    expect(log.requiresApproval).toBe(false);
    expect(log.permissionClass).toBe('READ');
  });

  it('permits safe write operations without approval', () => {
    const commit = policy.classifyOperation('commit');
    expect(commit.isSafe).toBe(true);
    expect(commit.requiresApproval).toBe(false);
    expect(commit.permissionClass).toBe('WRITE');

    const checkout = policy.classifyOperation('checkout');
    expect(checkout.isSafe).toBe(true);
    expect(checkout.requiresApproval).toBe(false);
    expect(checkout.permissionClass).toBe('WRITE');

    const branch = policy.classifyOperation('create_branch');
    expect(branch.isSafe).toBe(true);
    expect(branch.requiresApproval).toBe(false);
    expect(branch.permissionClass).toBe('WRITE');
  });

  it('permits standard verification operations (test, build, lint, typecheck) as EXECUTE', () => {
    for (const op of ['test', 'build', 'lint', 'typecheck'] as const) {
      const res = policy.classifyOperation(op);
      expect(res.isSafe).toBe(true);
      expect(res.requiresApproval).toBe(false);
      expect(res.permissionClass).toBe('EXECUTE');
    }
  });

  it('strictly gates high-risk operations (force push, delete branch, history rewrite) behind human approval', () => {
    const forcePush = policy.classifyOperation('force_push');
    expect(forcePush.isSafe).toBe(false);
    expect(forcePush.requiresApproval).toBe(true);
    expect(forcePush.permissionClass).toBe('DEPLOYMENT');

    const deleteBranch = policy.classifyOperation('delete_branch');
    expect(deleteBranch.isSafe).toBe(false);
    expect(deleteBranch.requiresApproval).toBe(true);
    expect(deleteBranch.permissionClass).toBe('DELETE');

    const rewrite = policy.classifyOperation('history_rewrite');
    expect(rewrite.isSafe).toBe(false);
    expect(rewrite.requiresApproval).toBe(true);
    expect(rewrite.permissionClass).toBe('DELETE');
  });

  it('strictly gates production deploy and credentials behind human approval', () => {
    const deploy = policy.classifyOperation('production_deploy');
    expect(deploy.isSafe).toBe(false);
    expect(deploy.requiresApproval).toBe(true);
    expect(deploy.permissionClass).toBe('DEPLOYMENT');

    const creds = policy.classifyOperation('change_credentials');
    expect(creds.isSafe).toBe(false);
    expect(creds.requiresApproval).toBe(true);
    expect(creds.permissionClass).toBe('SECRETS');

    const secrets = policy.classifyOperation('change_secrets');
    expect(secrets.isSafe).toBe(false);
    expect(secrets.requiresApproval).toBe(true);
    expect(secrets.permissionClass).toBe('SECRETS');
  });
});

describe('Development Mission & Objective Selection (Phase 4 & Phase 5)', () => {
  it('prioritizes failing tests over incomplete packages, missing integrations, and TODOs', async () => {
    const mockInspector: RepositoryInspectionPort = {
      inspectRepository: async (): Promise<RepositoryInspectionResult> => ({
        failingTests: ['src/__tests__/auth.test.ts'],
        incompletePackages: ['packages/payment'],
        missingIntegrations: ['stripe-webhook'],
        architecturalGaps: ['token-revocation'],
        todos: ['optimize query cache'],
      }),
    };

    const selector = new DevelopmentObjectiveSelector(mockInspector);
    const mission = createTestMission({ mode: 'DEVELOPMENT' });

    const result = await selector.selectNextObjective(mission, [], createTestProviderStatus());
    expect(result.selected).toBe(true);
    expect(result.priority).toBe(0);
    expect(result.reason).toContain('fix failing test src/__tests__/auth.test.ts');
    expect(result.discoveredObjective?.title).toBe('Fix failing test: src/__tests__/auth.test.ts');
  });

  it('selects incomplete package when no failing tests exist', async () => {
    const mockInspector: RepositoryInspectionPort = {
      inspectRepository: async (): Promise<RepositoryInspectionResult> => ({
        failingTests: [],
        incompletePackages: ['packages/analytics'],
        missingIntegrations: ['segment-adapter'],
        architecturalGaps: [],
        todos: ['add comment'],
      }),
    };

    const selector = new DevelopmentObjectiveSelector(mockInspector);
    const mission = createTestMission({ mode: 'DEVELOPMENT' });

    const result = await selector.selectNextObjective(mission, [], createTestProviderStatus());
    expect(result.selected).toBe(true);
    expect(result.priority).toBe(1);
    expect(result.discoveredObjective?.title).toBe('Complete package: packages/analytics');
  });

  it('selects missing integration when no tests or packages are failing', async () => {
    const mockInspector: RepositoryInspectionPort = {
      inspectRepository: async (): Promise<RepositoryInspectionResult> => ({
        failingTests: [],
        incompletePackages: [],
        missingIntegrations: ['webhook-adapter'],
        architecturalGaps: ['event-bus'],
        todos: ['refactor logging'],
      }),
    };

    const selector = new DevelopmentObjectiveSelector(mockInspector);
    const mission = createTestMission({ mode: 'DEVELOPMENT' });

    const result = await selector.selectNextObjective(mission, [], createTestProviderStatus());
    expect(result.selected).toBe(true);
    expect(result.priority).toBe(2);
    expect(result.discoveredObjective?.title).toBe('Implement integration: webhook-adapter');
  });

  it('does not invent repository state or tools', async () => {
    const mockInspector: RepositoryInspectionPort = {
      inspectRepository: async (): Promise<RepositoryInspectionResult> => ({
        failingTests: [],
        incompletePackages: [],
        missingIntegrations: [],
        architecturalGaps: [],
        todos: [],
      }),
    };

    const selector = new DevelopmentObjectiveSelector(mockInspector);
    const mission = createTestMission({ mode: 'DEVELOPMENT' });

    const result = await selector.selectNextObjective(mission, [], createTestProviderStatus());
    expect(result.selected).toBe(false);
    expect(result.reason).toContain(
      'No pending objectives and no unfinished engineering work found',
    );
  });
});

describe('Code Completion Criteria (Phase 15 & Phase 18)', () => {
  it('rejects completion when model says implemented but verification evidence is missing', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: true, error: undefined },
      // Verifier returns verified: false because no test evidence exists
      verifierResult: { verified: false, evidence: [] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Dev Mission',
      objective: 'Implement feature with tests',
      budget: { maxRetries: 0 },
      initialObjectives: ['Implement feature'],
    });

    await service.startMission(mission.missionId);
    const res = await service.runNextObjective(mission.missionId);

    expect(res.objectives[0]?.state).toBe('FAILED');
    expect(res.objectives[0]?.verifiedOutcome).toBeUndefined();
    expect(res.objectives[0]?.failureReason).toContain('Verification failed');
  });

  it('accepts completion when genuine verification evidence (tests passed) is provided', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: {
        verified: true,
        evidence: ['vitest src/__tests__/auth.test.ts: 5 passed', 'typecheck: 0 errors'],
      },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Dev Mission',
      objective: 'Implement feature with tests',
      initialObjectives: ['Implement feature with test evidence'],
    });

    await service.startMission(mission.missionId);
    const res = await service.runNextObjective(mission.missionId);

    expect(res.objectives[0]?.state).toBe('VERIFIED');
    expect(res.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    expect(res.objectives[0]?.verifiedOutcome?.evidence).toContain(
      'vitest src/__tests__/auth.test.ts: 5 passed',
    );
  });

  it('completes entire development mission only when all objectives are verified', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: { verified: true, evidence: ['targeted tests passed', 'lint clean'] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Two-stage dev mission',
      objective: 'Build VedMoulya module',
      initialObjectives: ['Write code and unit tests', 'Run integration suite'],
    });

    await service.startMission(mission.missionId);
    const completed = await service.runAutonomousLoop(mission.missionId);

    expect(completed.state).toBe('COMPLETED');
    expect(completed.outcome).toBe('ACHIEVED');
    expect(completed.objectives.every((o) => o.state === 'VERIFIED')).toBe(true);
  });
});
