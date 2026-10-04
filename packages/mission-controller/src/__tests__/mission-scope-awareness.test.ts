// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Scope Awareness (SCOPE-01) — focused tests A–G
//
// Real repository missions exposed that incidental repository debt
// (incompletePackages / missingIntegrations / failing tests / gaps / TODOs)
// became Mission work, consumed the objective budget and could end a Mission
// FAILED with "Maximum objectives reached" even when every DECLARED objective
// had VERIFIED.
//
// These tests pin the required behavior:
//   TEST A  a dependency the user's goal requires is discovered → it becomes
//           part of REQUIRED execution
//   TEST B  an unrelated repository issue never silently becomes an objective
//   TEST C  an optional improvement stays visible but never blocks
//   TEST D  a discovered issue that genuinely prevents the requested work
//           keeps the Mission BLOCKED / not ACHIEVED
//   TEST E  classification of many discovered issues is deterministic
//   TEST F  another user's workspace discovery cannot influence this Mission
//   TEST G  existing multi-objective dependency behavior is unchanged
//
// Nothing here suppresses the inspector, raises a budget, or marks discovered
// work complete — the assertions are about CLASSIFICATION and VISIBILITY.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  classifyDiscoveredWork,
  DevelopmentObjectiveSelector,
  InMemoryCheckpointStore,
  InMemoryMissionStore,
  MissionControllerService,
  createIdGenerator,
} from '../index.js';
import type {
  ClockPort,
  MissionObjective,
  RepositoryInspectionPort,
  RepositoryInspectionResult,
  RepositoryInspectionEvidence,
} from '../index.js';
import { createTestMission, createTestProviderStatus, createFakePorts } from './fixtures.js';

// ── helpers ─────────────────────────────────────────────────────────

function inspectorReturning(evidence: Partial<RepositoryInspectionEvidence>): {
  inspector: RepositoryInspectionPort;
  calls: (string | undefined)[];
} {
  const calls: (string | undefined)[] = [];
  const inspector: RepositoryInspectionPort = {
    inspectRepository: async (workspacePath?: string) => {
      calls.push(workspacePath);
      return {
        failingTests: [],
        incompletePackages: [],
        missingIntegrations: [],
        architecturalGaps: [],
        todos: [],
        ...evidence,
      } as RepositoryInspectionResult;
    },
  };
  return { inspector, calls };
}

function objective(
  overrides: Partial<MissionObjective> & Pick<MissionObjective, 'objectiveId' | 'title'>,
): MissionObjective {
  return {
    missionId: 'mission_scope_1',
    objective: overrides.title,
    description: '',
    reason: 'declared',
    evidence: [],
    priority: 0,
    dependencies: [],
    estimatedComplexity: 'MEDIUM',
    estimatedCost: 0.01,
    state: 'PENDING',
    stateHistory: ['PENDING'],
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function missionWith(objectives: MissionObjective[]) {
  return createTestMission({
    objectives,
    title: 'Scope mission',
    objective: 'Publish the release readiness sign-off',
    description: 'Audit the workspace and publish the sign-off',
    workspace: '/ws/user-a',
    budget: {
      maxObjectives: 3,
      maxActions: 50,
      maxToolCalls: 100,
      maxRetries: 1,
      maxReplans: 2,
      maxRuntimeMs: 3600000,
      maxTokens: 100000,
      maxCostUsd: 5,
    },
  });
}

// ── TEST A ──────────────────────────────────────────────────────────

describe('SCOPE-01 TEST A — a dependency the requested work requires', () => {
  it('becomes REQUIRED execution instead of incidental debt', async () => {
    const { inspector } = inspectorReturning({
      incompletePackages: ['packages/billing'],
      missingIntegrations: ['stripe-adapter'],
    });
    const mission = missionWith([
      objective({
        objectiveId: 'obj_audit',
        title: 'Audit the packages/billing manifest for release readiness',
      }),
    ]);

    const report = classifyDiscoveredWork(mission, {
      failingTests: [],
      incompletePackages: ['packages/billing'],
      missingIntegrations: ['stripe-adapter'],
      architecturalGaps: [],
      todos: [],
    });

    const required = report.required;
    expect(required).toHaveLength(1);
    expect(required[0]?.label).toBe('packages/billing');
    expect(required[0]?.classification).toBe('REQUIRED');
    // The declaring objective is named → this really does block it.
    expect(required[0]?.blockingObjectiveIds).toEqual(['obj_audit']);
    // The unrelated integration is NOT required work.
    expect(report.required.map((i) => i.label)).not.toContain('stripe-adapter');

    const selector = new DevelopmentObjectiveSelector(inspector);
    const result = await selector.selectNextObjective(mission, [], createTestProviderStatus());
    // The declared objective is selectable, so discovery does not even run yet.
    expect(result.selected).toBe(true);
    expect(result.objectiveId).toBe('obj_audit');
  });

  it('is selected as a real objective once the declared work still needs it', async () => {
    const { inspector } = inspectorReturning({ incompletePackages: ['packages/billing'] });
    // The declared objective is PENDING but NOT selectable: its prerequisite
    // failed. This is exactly the situation in which discovery runs while the
    // declared work is still outstanding.
    const mission = missionWith([
      objective({ objectiveId: 'obj_prev', title: 'Previous step', state: 'FAILED' }),
      objective({
        objectiveId: 'obj_audit',
        title: 'Audit packages/billing',
        dependencies: ['obj_prev'],
      }),
    ]);

    const selector = new DevelopmentObjectiveSelector(inspector);
    const result = await selector.selectNextObjective(mission, [], createTestProviderStatus());

    expect(result.selected).toBe(true);
    expect(result.discoveredObjective?.title).toBe('Complete package: packages/billing');
    expect(result.discoveredObjective?.discovery).toMatchObject({
      classification: 'REQUIRED',
      kind: 'INCOMPLETE_PACKAGE',
      label: 'packages/billing',
    });
    expect(result.scopeReport?.required).toHaveLength(1);
  });
});

// ── TEST B ──────────────────────────────────────────────────────────

describe('SCOPE-01 TEST B — an unrelated repository issue', () => {
  it('is classified OUT_OF_SCOPE and never becomes a silent objective', async () => {
    const { inspector } = inspectorReturning({
      incompletePackages: ['packages/unrelated-billing'],
      missingIntegrations: ['stripe-adapter'],
      todos: ['optimize query cache'],
    });
    const mission = missionWith([
      objective({ objectiveId: 'obj_signoff', title: 'Publish the release sign-off' }),
    ]);

    const report = classifyDiscoveredWork(mission, {
      failingTests: [],
      incompletePackages: ['packages/unrelated-billing'],
      missingIntegrations: ['stripe-adapter'],
      architecturalGaps: [],
      todos: ['optimize query cache'],
    });

    expect(report.required).toHaveLength(0);
    expect(report.outOfScope).toHaveLength(3);
    expect(report.outOfScope.every((i) => i.executed === false)).toBe(true);

    // With the declared objective already terminal, the selector selects
    // NOTHING — the repository debt must not hijack the mission.
    mission.objectives[0]!.state = 'VERIFIED';
    mission.objectives[0]!.stateHistory.push('VERIFIED');
    const selector = new DevelopmentObjectiveSelector(inspector);
    const result = await selector.selectNextObjective(
      mission,
      ['obj_signoff'],
      createTestProviderStatus(),
    );

    expect(result.selected).toBe(false);
    expect(result.discoveredObjective).toBeUndefined();
    // ...but it is NOT hidden: the full classification rides along.
    expect(result.scopeReport?.outOfScope).toHaveLength(3);
    expect(result.scopeReport?.optional).toHaveLength(0);
    expect(result.evidence.join('\n')).toContain('OUT_OF_SCOPE (not executed)');
    expect(result.evidence.join('\n')).toContain('packages/unrelated-billing');
  });
});

// ── TEST C ──────────────────────────────────────────────────────────

describe('SCOPE-01 TEST C — an optional improvement', () => {
  it('stays visible, is not executed and does not block the requested goal', async () => {
    const { inspector } = inspectorReturning({ incompletePackages: ['packages/release-notes'] });
    const mission = createTestMission({
      objectives: [objective({ objectiveId: 'obj_signoff', title: 'Publish the sign-off' })],
      // The mission GOAL references it; no single objective does → OPTIONAL.
      title: 'Release readiness mission',
      objective: 'Publish the release readiness sign-off for packages/release-notes',
      description: '',
    });

    const report = classifyDiscoveredWork(mission, {
      failingTests: [],
      incompletePackages: ['packages/release-notes'],
      missingIntegrations: [],
      architecturalGaps: [],
      todos: [],
    });

    expect(report.required).toHaveLength(0);
    expect(report.optional).toHaveLength(1);
    expect(report.optional[0]?.classification).toBe('OPTIONAL');
    expect(report.optional[0]?.blockingObjectiveIds).toEqual([]);

    mission.objectives[0]!.state = 'VERIFIED';
    mission.objectives[0]!.stateHistory.push('VERIFIED');
    const selector = new DevelopmentObjectiveSelector(inspector);
    const result = await selector.selectNextObjective(
      mission,
      ['obj_signoff'],
      createTestProviderStatus(),
    );

    // Requested goal is complete; the optional improvement does not block it.
    expect(result.selected).toBe(false);
    expect(result.scopeReport?.requestedWork).toMatchObject({ total: 1, verified: 1 });
    expect(result.scopeReport?.optional[0]?.executed).toBe(false);
    expect(result.reason).toContain('not part of this Mission');
  });
});

// ── TEST D ──────────────────────────────────────────────────────────

describe('SCOPE-01 TEST D — a discovered issue that genuinely prevents the work', () => {
  it('keeps the Mission BLOCKED instead of completing the requested work', async () => {
    const store = new InMemoryMissionStore();
    const checkpointStore = new InMemoryCheckpointStore();
    const nowMs = Date.parse('2026-01-01T00:00:00.000Z');
    const clock: ClockPort = {
      now: () => new Date(nowMs).toISOString(),
      timestampMs: () => nowMs,
    };

    // Every execution fails: the required dependency can never be satisfied.
    const ports = createFakePorts({
      executorResult: { success: false, verified: false, error: 'dependency not satisfied' },
      verifierResult: { verified: false, evidence: [] },
      onExecute: (call) => executions.push(String((call.plan as { objective?: string }).objective)),
    });
    const executions: string[] = [];
    const { inspector } = inspectorReturning({ incompletePackages: ['packages/billing'] });

    const service = new MissionControllerService({
      store,
      checkpointStore,
      providerAvailability: ports.providerAvailability,
      goalUnderstanding: ports.goalUnderstanding,
      planner: ports.planner,
      executor: ports.executor,
      verifier: ports.verifier,
      executionMemory: ports.executionMemory,
      experienceOptimization: ports.experienceOptimization,
      failureClassifier: ports.failureClassifier,
      objectiveSelector: new DevelopmentObjectiveSelector(inspector),
      clock,
      idGenerator: createIdGenerator(),
    });

    const mission = await service.createMission({
      userId: 'user_a',
      title: 'Blocked by a required dependency',
      objective: 'Audit packages/billing and publish the sign-off',
      description: '',
      mode: 'DEVELOPMENT',
      workspace: '/ws/user-a',
      // Deliberately generous: the block must come from the DEPENDENCY, never
      // from a raised or exhausted budget.
      budget: { maxObjectives: 5, maxRetries: 0 },
      initialObjectives: [
        'Prepare the release workspace',
        'Audit packages/billing and publish the sign-off',
      ],
      objectiveDependencies: [{ objectiveIndex: 1, dependsOn: [0] }],
    });
    await service.startMission(mission.missionId);

    // Pass 1: the first declared objective runs and FAILS.
    const first = await service.runNextObjective(mission.missionId);
    expect(first.objectives[0]?.state).toBe('FAILED');

    // Pass 2: objective 1 is blocked on the failed prerequisite, so the
    // REQUIRED discovered dependency is created and linked to it.
    const second = await service.runNextObjective(mission.missionId);
    const discovered = second.objectives.find((o) => o.discovery);
    const declared = second.objectives.find(
      (o) => o.objectiveId === second.objectives[1]?.objectiveId,
    );
    expect(discovered?.discovery?.classification).toBe('REQUIRED');
    expect(discovered?.discovery?.label).toBe('packages/billing');
    expect(declared?.dependencies).toContain(discovered?.objectiveId);
    // It fails too — the blocking dependency genuinely prevents the work.
    expect(discovered?.state).toBe('FAILED');
    expect(declared?.state).toBe('PENDING');

    // Pass 3: nothing is selectable, the required work is already an
    // objective, and real work remains → the Mission stays BLOCKED.
    const final = await service.runNextObjective(mission.missionId);
    expect(final.state).toBe('BLOCKED');
    expect(final.outcome).not.toBe('ACHIEVED');
    expect(final.scopeReport?.required[0]?.executed).toBe(true);
    expect(final.scopeReport?.requestedWork.verified).toBe(0);
    // The declared objective was never executed on false pretense.
    expect(executions.every((e) => !e.includes('publish the sign-off'))).toBe(true);
    expect(final.budgetUsage.objectivesCompleted + final.budgetUsage.objectivesFailed).toBeLessThan(
      final.budget.maxObjectives,
    );
  });
});

// ── TEST E ──────────────────────────────────────────────────────────

describe('SCOPE-01 TEST E — multiple discovered issues', () => {
  const evidence: RepositoryInspectionEvidence = {
    failingTests: ['packages/billing/src/billing.test.ts'],
    incompletePackages: ['packages/billing', 'packages/unrelated-ui'],
    missingIntegrations: ['stripe-adapter', '@vedmoulya/billing-core'],
    architecturalGaps: ['event-bus'],
    todos: ['optimize query cache', 'fix packages/billing TODO'],
  };

  it('classifies deterministically and identically on every pass', () => {
    const mission = createTestMission({
      objectives: [
        objective({ objectiveId: 'obj_audit', title: 'Audit packages/billing end to end' }),
      ],
      title: 'Scope mission',
      // The GOAL references the event-bus gap; no single objective does.
      objective: 'Publish the release readiness sign-off and close the event-bus gap',
      description: '',
    });

    const first = classifyDiscoveredWork(mission, evidence);
    const second = classifyDiscoveredWork(mission, evidence);

    expect(second).toEqual(first);
    // Only the package the DECLARED objective names is REQUIRED work; every
    // other signal is reported but never promoted.
    expect(first.required.map((i) => `${i.kind}:${i.label}`)).toEqual([
      'INCOMPLETE_PACKAGE:packages/billing',
    ]);
    expect(first.optional.map((i) => i.label)).toEqual(['event-bus']);
    // Fixed kind order keeps the report byte-stable: failing test, package,
    // integration, gap, TODO.
    expect(first.outOfScope.map((i) => `${i.kind}:${i.label}`)).toEqual([
      'FAILING_TEST:packages/billing/src/billing.test.ts',
      'INCOMPLETE_PACKAGE:packages/unrelated-ui',
      'MISSING_INTEGRATION:stripe-adapter',
      'MISSING_INTEGRATION:@vedmoulya/billing-core',
      'TODO:optimize query cache',
      'TODO:fix packages/billing TODO',
    ]);
    expect(first.summary).toContain('requested work 0/1 verified');
    expect(first.summary).toContain('discovered required work 1 (0 executed)');
    expect(first.summary).toContain('discovered related work 1 (reported, not executed)');
  });

  it('selects REQUIRED work only, in the pre-existing priority order', async () => {
    const { inspector } = inspectorReturning(evidence);
    const mission = missionWith([
      objective({
        objectiveId: 'obj_done',
        title: 'Audit packages/billing end to end',
        state: 'VERIFIED',
        stateHistory: ['PENDING', 'VERIFIED'],
      }),
    ]);

    const selector = new DevelopmentObjectiveSelector(inspector);
    const result = await selector.selectNextObjective(
      mission,
      ['obj_done'],
      createTestProviderStatus(),
    );

    // Priority 0 (failing test) exists in the evidence but is NOT required by
    // the declared scope, so the required package (priority 1) is selected.
    expect(result.selected).toBe(true);
    expect(result.priority).toBe(1);
    expect(result.discoveredObjective?.title).toBe('Complete package: packages/billing');
  });
});

// ── TEST F ──────────────────────────────────────────────────────────

describe('SCOPE-01 TEST F — user isolation of discovery', () => {
  it('classifies only against THIS mission scope and inspects THIS workspace', async () => {
    const { inspector, calls } = inspectorReturning({
      incompletePackages: ['packages/other-user-work'],
    });

    const missionA = missionWith([
      objective({ objectiveId: 'obj_a', title: 'Audit packages/other-user-work' }),
    ]);
    const missionB = createTestMission({
      userId: 'user_b',
      objectives: [objective({ objectiveId: 'obj_b', title: 'Publish the sign-off' })],
      title: 'Other user mission',
      objective: 'Publish the sign-off',
      description: '',
      workspace: '/ws/user-b',
    });

    const reportA = classifyDiscoveredWork(missionA, {
      failingTests: [],
      incompletePackages: ['packages/other-user-work'],
      missingIntegrations: [],
      architecturalGaps: [],
      todos: [],
    });
    const reportB = classifyDiscoveredWork(missionB, {
      failingTests: [],
      incompletePackages: ['packages/other-user-work'],
      missingIntegrations: [],
      architecturalGaps: [],
      todos: [],
    });

    // Same repository evidence, opposite verdicts: the classification is
    // derived from the OWNING mission's scope, never from another mission.
    expect(reportA.required).toHaveLength(1);
    expect(reportA.required[0]?.blockingObjectiveIds).toEqual(['obj_a']);
    expect(reportB.required).toHaveLength(0);
    expect(reportB.outOfScope).toHaveLength(1);

    missionA.objectives[0]!.state = 'VERIFIED';
    missionB.objectives[0]!.state = 'VERIFIED';
    const selector = new DevelopmentObjectiveSelector(inspector);
    await selector.selectNextObjective(missionA, ['obj_a'], createTestProviderStatus());
    await selector.selectNextObjective(missionB, [], createTestProviderStatus());

    // Each mission inspected its OWN workspace — never the other's.
    expect(calls).toEqual(['/ws/user-a', '/ws/user-b']);
  });
});

// ── TEST G ──────────────────────────────────────────────────────────

describe('SCOPE-01 TEST G — existing multi-objective dependency behavior', () => {
  it('still runs a dependent objective only after its prerequisite VERIFIED', async () => {
    const { inspector } = inspectorReturning({});
    const mission = missionWith([
      objective({ objectiveId: 'obj_1', title: 'First' }),
      objective({ objectiveId: 'obj_2', title: 'Second', dependencies: ['obj_1'] }),
    ]);

    const selector = new DevelopmentObjectiveSelector(inspector);
    const providerStatus = createTestProviderStatus();

    const firstPick = await selector.selectNextObjective(mission, [], providerStatus);
    expect(firstPick.objectiveId).toBe('obj_1');

    // Prerequisite not verified yet → the dependent objective is NOT selectable.
    const blockedPick = await selector.selectNextObjective(mission, [], providerStatus);
    expect(blockedPick.objectiveId).toBe('obj_1');

    mission.objectives[0]!.state = 'VERIFIED';
    const afterVerify = await selector.selectNextObjective(mission, ['obj_1'], providerStatus);
    expect(afterVerify.objectiveId).toBe('obj_2');

    // With both verified and an empty repository, the mission has nothing left.
    mission.objectives[1]!.state = 'VERIFIED';
    const done = await selector.selectNextObjective(mission, ['obj_1', 'obj_2'], providerStatus);
    expect(done.selected).toBe(false);
    expect(done.scopeReport?.requestedWork).toMatchObject({ total: 2, verified: 2, failed: 0 });
  });

  it('a scope-less mission keeps the pre-existing discovery-driven semantics', async () => {
    const { inspector } = inspectorReturning({ todos: ['todo-alpha', 'todo-beta'] });
    const mission = createTestMission({ objectives: [], mode: 'DEVELOPMENT' });

    const report = classifyDiscoveredWork(mission, {
      failingTests: [],
      incompletePackages: [],
      missingIntegrations: [],
      architecturalGaps: [],
      todos: ['todo-alpha', 'todo-beta'],
    });
    expect(report.required).toHaveLength(2);

    const selector = new DevelopmentObjectiveSelector(inspector);
    const result = await selector.selectNextObjective(mission, [], createTestProviderStatus());
    expect(result.selected).toBe(true);
    expect(result.discoveredObjective?.title).toBe('Resolve TODO: todo-alpha');
  });
});
