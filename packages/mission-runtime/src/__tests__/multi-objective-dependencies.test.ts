// ──────────────────────────────────────────────────────────────────
// VedMoulya — Multi-objective Mission dependency acceptance (REAL-07)
//
// Proves the EXISTING Mission runtime can execute a single user goal as
// MULTIPLE interdependent objectives with REAL governed tool execution,
// REAL verification, per-objective checkpoints, honest failure isolation
// and restart-safe resume.
//
// The ONLY test double is a deterministic ProviderAdapter implementing the
// frozen ProviderAdapter contract (the real provider proof is the live
// harness). No runtime, tool, controller or persistence layer is mocked.
//
// Explicit dependencies are declared at creation through the additive
// `objectiveDependencies` field, which only populates the objective's
// EXISTING `dependencies` contract consumed by the EXISTING objective
// selectors — no new dependency engine.
// ──────────────────────────────────────────────────────────────────

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { ProviderAdapter } from '@vedmoulya/services';
import type { AIResponse, CapabilityType } from '@vedmoulya/ai';
import { InMemoryCheckpointStore, InMemoryMissionStore } from '@vedmoulya/mission-controller';
import { createMissionRuntime } from '../index.js';
import type { MissionRuntime } from '../index.js';

const ALL_CAPABILITIES: CapabilityType[] = [
  'reasoning',
  'coding',
  'vision',
  'embeddings',
  'summarization',
  'classification',
  'translation',
  'speech',
  'image_understanding',
  'general_conversation',
  'content_generation',
];

/**
 * Deterministic REAL (non-mock) provider: declares the `ollama` family so it
 * is genuinely eligible for routing, and answers the confirmation prompt with
 * the literal `verified` marker the deterministic plan requires. It never
 * fabricates success for a failed tool step — verification authority stays
 * with the REAL execution run.
 */
function deterministicRealProvider(): ProviderAdapter {
  return {
    name: 'ollama-deterministic-test',
    family: 'ollama',
    capabilities: ALL_CAPABILITIES,
    isHealthy: async () => true,
    getHealth: async () => ({
      providerId: 'ollama-deterministic-test',
      status: 'healthy' as const,
      latency: 1,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 100,
      rateLimitReset: null,
    }),
    async execute(request: Parameters<ProviderAdapter['execute']>[0]): Promise<AIResponse> {
      const prompt = JSON.stringify(request.messages ?? []);
      return {
        content: `verified: the governed workspace write and read-back were observed. ${prompt}`,
        provider: 'ollama-deterministic-test',
        model: 'ollama-deterministic-test',
        confidence: 0.9,
        qualityScore: 8,
        latency: 1,
        cost: 0,
        tokenUsage: { input: 10, output: 20, total: 30 },
        validation: {
          passed: true,
          checks: [{ name: 'format', passed: true, score: 10 }],
          overallScore: 8,
          decision: 'pass' as const,
        },
        traceId: 'trace-ollama-deterministic-test',
        metadata: {
          providerFamily: 'ollama' as const,
          modelVersion: 'ollama-deterministic-test',
          processingTime: 1,
          contextUsed: ['system', 'user'],
          routingDecision: {
            selectedProvider: 'ollama-deterministic-test',
            reason: 'deterministic real test provider',
            alternativesConsidered: [],
            strategy: 'balanced' as const,
          },
          validationDetails: [],
        },
      };
    },
  };
}

const tempRoots: string[] = [];
function newWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vedmoulya-multi-objective-'));
  tempRoots.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

function devConstraints(): { allowedTools: string[]; grantedPermissionClasses: string[] } {
  return {
    allowedTools: ['workspace_write', 'workspace_read'],
    grantedPermissionClasses: ['READ', 'WRITE'],
  };
}

function makeRuntime(
  workspace: string,
  overrides: {
    stores?: { missions?: InMemoryMissionStore; checkpoints?: InMemoryCheckpointStore };
    contentPolicy?: (content: string) => string | undefined;
  } = {},
): MissionRuntime {
  return createMissionRuntime({
    workspaceRoot: workspace,
    workspaceTools: true,
    workspaceToolOptions: overrides.contentPolicy
      ? { contentPolicy: overrides.contentPolicy }
      : undefined,
    orchestratorOptions: { retryBaseDelayMs: 1 },
    registerProviders: (orchestrator) => orchestrator.registerProvider(deterministicRealProvider()),
    stores: overrides.stores,
  });
}

// One user goal split into three dependent objectives. Each objective is a
// workspace-file artifact goal so the EXISTING deterministic template estate
// performs a REAL governed write + read-back.
const OBJECTIVE_1 =
  'Create the workspace file source-notes.md with content Project Alpha notes milestone one is complete';
const OBJECTIVE_2 =
  'Create the workspace file status-report.md with content Project Alpha status report milestone one complete and three open issues remain';
const OBJECTIVE_3 =
  'Create the workspace file action-plan.md with content Project Alpha action plan resolve three open issues and schedule the next review';

const ARTIFACTS = ['source-notes.md', 'status-report.md', 'action-plan.md'];

describe('multi-objective mission — explicit dependencies (REAL-07)', () => {
  it('runs three dependent objectives to ACHIEVED with real artifacts, verification and checkpoints', async () => {
    const workspace = newWorkspace();
    const runtime = makeRuntime(workspace);

    const mission = await runtime.controller.createMission({
      userId: 'mo-owner',
      title: 'Project status report and action plan',
      objective:
        'Produce a project status report and a concrete action plan from the supplied notes',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: devConstraints(),
      initialObjectives: [OBJECTIVE_1, OBJECTIVE_2, OBJECTIVE_3],
      objectiveDependencies: [
        { objectiveIndex: 1, dependsOn: [0] },
        { objectiveIndex: 2, dependsOn: [1] },
      ],
    });

    // ── Explicit dependency graph is persisted on the objectives. ──
    expect(mission.objectives).toHaveLength(3);
    expect(mission.objectives[0]?.dependencies).toEqual([]);
    expect(mission.objectives[1]?.dependencies).toEqual([
      mission.objectives[0]?.objectiveId as string,
    ]);
    expect(mission.objectives[2]?.dependencies).toEqual([
      mission.objectives[1]?.objectiveId as string,
    ]);

    await runtime.controller.startMission(mission.missionId);
    const done = await runtime.controller.runAutonomousLoop(mission.missionId);

    // ── Mission completed with every objective genuinely verified. ──
    expect(done.state).toBe('COMPLETED');
    expect(done.outcome).toBe('ACHIEVED');
    expect(done.objectives.every((objective) => objective.state === 'VERIFIED')).toBe(true);
    expect(done.objectives.every((objective) => objective.verifiedOutcome?.achieved)).toBe(true);

    // ── Dependency ORDER: objective N started only after N-1 verified. ──
    const [o0, o1, o2] = done.objectives;
    expect(o0?.completedAt).toBeDefined();
    expect(o1?.startedAt).toBeDefined();
    expect(o2?.startedAt).toBeDefined();
    expect(Date.parse(o1?.startedAt as string)).toBeGreaterThanOrEqual(
      Date.parse(o0?.completedAt as string),
    );
    expect(Date.parse(o2?.startedAt as string)).toBeGreaterThanOrEqual(
      Date.parse(o1?.completedAt as string),
    );

    // ── One durable checkpoint per objective, in dependency order. ──
    expect(done.checkpoints).toHaveLength(3);
    expect(done.checkpoints.map((c) => c.objectiveId)).toEqual([
      o0?.objectiveId,
      o1?.objectiveId,
      o2?.objectiveId,
    ]);
    expect(done.checkpoints.every((c) => c.state === 'VERIFIED')).toBe(true);
    expect(done.budgetUsage.objectivesCompleted).toBe(3);

    // ── Every artifact really exists on disk with non-empty content. ──
    for (const artifact of ARTIFACTS) {
      const full = path.join(workspace, artifact);
      expect(existsSync(full)).toBe(true);
      expect(readFileSync(full, 'utf8').trim().length).toBeGreaterThan(0);
    }

    // ── Real governed tool path + real provider execution. ──
    const audit = runtime.toolRegistry.getAuditTrail();
    expect(audit.filter((e) => e.toolName === 'workspace_write').length).toBe(3);
    expect(audit.filter((e) => e.toolName === 'workspace_read').length).toBeGreaterThanOrEqual(3);
    // The retained AI confirmation is a real provider execution (usage
    // identity), but it is NOT what decides the verdict.
    expect(done.budgetUsage.tokensConsumed).toBeGreaterThan(0);
  });

  it('isolates a failed objective: prerequisite stays VERIFIED, dependent never runs, mission is not ACHIEVED', async () => {
    const workspace = newWorkspace();
    const runtime = makeRuntime(workspace, {
      // Reject ONLY objective 2's content; objectives 1 and 3 still succeed.
      contentPolicy: (content) =>
        content.includes('DENY2') ? 'deterministic failure injection for objective 2' : undefined,
    });

    const mission = await runtime.controller.createMission({
      userId: 'mo-fail-owner',
      title: 'Failure isolation mission',
      objective: 'Produce artifacts where one objective is deterministically blocked',
      mode: 'DEVELOPMENT',
      workspace,
      // No retries: the deterministic denial is non-recoverable here, so the
      // objective itself fails (rather than consuming the retry budget).
      budget: { maxRetries: 0 },
      constraints: devConstraints(),
      initialObjectives: [
        OBJECTIVE_1,
        'Create the workspace file status-report.md with content Project Alpha DENY2 status report',
        OBJECTIVE_3,
      ],
      objectiveDependencies: [
        { objectiveIndex: 1, dependsOn: [0] },
        { objectiveIndex: 2, dependsOn: [1] },
      ],
    });

    await runtime.controller.startMission(mission.missionId);
    const done = await runtime.controller.runAutonomousLoop(mission.missionId);

    // Objective 1 remains genuinely VERIFIED.
    expect(done.objectives[0]?.state).toBe('VERIFIED');
    expect(done.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    // Objective 2 did NOT become VERIFIED, and its artifact was not written.
    expect(done.objectives[1]?.state).toBe('FAILED');
    expect(done.objectives[1]?.verifiedOutcome).toBeUndefined();
    expect(existsSync(path.join(workspace, 'status-report.md'))).toBe(false);
    // Objective 3 depends on the failed objective → never selectable.
    expect(done.objectives[2]?.state).toBe('PENDING');
    expect(existsSync(path.join(workspace, 'action-plan.md'))).toBe(false);

    // Mission does not falsely complete as ACHIEVED.
    expect(done.state).not.toBe('COMPLETED');
    expect(done.outcome).not.toBe('ACHIEVED');

    // The successful objective's checkpoint persists durably.
    const checkpoint = await runtime.stores.checkpoints.getLatestForMission(mission.missionId);
    expect(checkpoint).toBeDefined();
  });

  it('resumes after a process interrupt: verified objective is not re-run and remaining objectives complete', async () => {
    const workspace = newWorkspace();
    const stores = {
      missions: new InMemoryMissionStore(),
      checkpoints: new InMemoryCheckpointStore(),
    };

    // ── Process A: only the first objective runs, then we "crash". ──
    const runtimeA = makeRuntime(workspace, { stores });
    const mission = await runtimeA.controller.createMission({
      userId: 'mo-resume-owner',
      title: 'Resume mission',
      objective: 'Produce artifacts across a simulated process restart',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: devConstraints(),
      initialObjectives: [OBJECTIVE_1, OBJECTIVE_2, OBJECTIVE_3],
      objectiveDependencies: [
        { objectiveIndex: 1, dependsOn: [0] },
        { objectiveIndex: 2, dependsOn: [1] },
      ],
    });
    await runtimeA.controller.startMission(mission.missionId);
    await runtimeA.controller.runNextObjective(mission.missionId);

    const mid = await stores.missions.get(mission.missionId);
    expect(mid?.objectives[0]?.state).toBe('VERIFIED');
    expect(mid?.objectives[1]?.state).toBe('PENDING');
    const firstVerifiedAt = mid?.objectives[0]?.verifiedOutcome?.verifiedAt;
    expect(firstVerifiedAt).toBeDefined();

    // ── Process B: fresh runtime over the SAME durable stores. ──
    const runtimeB = makeRuntime(workspace, { stores });
    const recovered = await runtimeB.controller.recoverMission(mission.missionId);
    expect(recovered.state).toBe('RUNNING');
    // The verified objective is preserved, NOT reset for re-execution.
    expect(recovered.objectives[0]?.state).toBe('VERIFIED');
    expect(recovered.objectives[0]?.verifiedOutcome?.verifiedAt).toBe(firstVerifiedAt);

    const done = await runtimeB.controller.runAutonomousLoop(mission.missionId);
    expect(done.state).toBe('COMPLETED');
    expect(done.outcome).toBe('ACHIEVED');
    expect(done.objectives[0]?.verifiedOutcome?.verifiedAt).toBe(firstVerifiedAt);
    expect(done.objectives.every((o) => o.state === 'VERIFIED')).toBe(true);
    for (const artifact of ARTIFACTS) {
      expect(existsSync(path.join(workspace, artifact))).toBe(true);
    }
  });
});
