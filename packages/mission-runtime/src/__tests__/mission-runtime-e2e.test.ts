// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime E2E (BLD-022)
//
// Runs the REAL composition — real MissionControllerService, real
// PlanningApplicationService/PlannerService, real AgentExecutionService,
// real AIOrchestrationService with registered providers, real governed
// ToolRegistry executing a real (temporary) workspace — and proves the
// required behaviors A–H. The only test doubles are provider ADAPTERS
// implementing the frozen ProviderAdapter contract (simulating a real
// provider failing/recovering) — no runtime layer is mocked.
// ──────────────────────────────────────────────────────────────────

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import type { ProviderAdapter } from '@vedmoulya/services';
import type { AIResponse, CapabilityType } from '@vedmoulya/ai';
import { MockProvider } from '@vedmoulya/orchestrator';
import { createMissionRuntime, WORKSPACE_WRITE_TOOL, RuntimeGitSafetyAdapter } from '../index.js';
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
 * Test-only provider adapter (implements the SAME frozen ProviderAdapter
 * contract as every real provider). Fails every execution with a 5xx so
 * the runtime's existing retry/fallback logic is exercised for real.
 */
class FlakyProvider implements ProviderAdapter {
  name: string;
  family = 'flaky-test';
  capabilities: CapabilityType[] = ALL_CAPABILITIES;
  executeCalls = 0;
  healthStatus: 'healthy' | 'down' = 'healthy';

  constructor(name: string) {
    this.name = name;
  }

  async isHealthy(): Promise<boolean> {
    return this.healthStatus === 'healthy';
  }

  async getHealth() {
    return {
      providerId: this.name,
      status: this.healthStatus,
      latency: 1,
      errorRate: this.healthStatus === 'healthy' ? 0 : 1,
      lastChecked: new Date(),
      isRateLimited: false,
    };
  }

  async execute(): Promise<AIResponse> {
    this.executeCalls += 1;
    throw new Error('api error: 503 provider unavailable');
  }
}

const tempRoots: string[] = [];
function newWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vedmoulya-mission-e2e-'));
  tempRoots.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

interface RuntimeOverrides {
  providers?: (orchestrator: AIOrchestrationService) => void;
  workspaceTools?: boolean;
  stores?: {
    missions?: import('@vedmoulya/mission-controller').MissionStore;
    checkpoints?: import('@vedmoulya/mission-controller').CheckpointStore;
  };
  contentPolicy?: (content: string) => string | undefined;
}

function makeRuntime(workspace: string, overrides: RuntimeOverrides = {}): MissionRuntime {
  return createMissionRuntime({
    workspaceRoot: workspace,
    workspaceTools: overrides.workspaceTools,
    workspaceToolOptions: overrides.contentPolicy
      ? { contentPolicy: overrides.contentPolicy }
      : undefined,
    orchestratorOptions: { retryBaseDelayMs: 1 },
    registerProviders:
      overrides.providers ??
      ((orchestrator) => {
        orchestrator.registerProvider(new MockProvider());
      }),
    stores: overrides.stores,
  });
}

function devConstraints(): { allowedTools: string[]; grantedPermissionClasses: string[] } {
  return {
    allowedTools: ['workspace_write', 'workspace_read'],
    grantedPermissionClasses: ['READ', 'WRITE'],
  };
}

const workspaceAuditWrites = (runtime: MissionRuntime): number =>
  runtime.toolRegistry
    .getAuditTrail()
    .filter((event) => event.toolName === WORKSPACE_WRITE_TOOL && event.outcome === 'success')
    .length;

describe('Mission Runtime E2E — real composition (BLD-022)', () => {
  it('TEST A: two sequential objectives — plan, AI execution, ToolRuntime change, verification, checkpoint, autonomous continuation, no second user prompt', async () => {
    const workspace = newWorkspace();
    const runtime = makeRuntime(workspace);
    const mission = await runtime.controller.createMission({
      userId: 'eng-1',
      title: 'Autonomous workspace documentation',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: devConstraints(),
      initialObjectives: [
        'Create the workspace file alpha-notes.md with the alpha sprint summary content',
        'Create the workspace file beta-notes.md with the beta sprint summary content',
      ],
    });
    await runtime.controller.startMission(mission.missionId);
    // ONE autonomous loop call drives BOTH objectives — no second prompt.
    const completed = await runtime.controller.runAutonomousLoop(mission.missionId);

    expect(completed.state).toBe('COMPLETED');
    expect(completed.outcome).toBe('ACHIEVED');
    expect(completed.objectives.every((objective) => objective.state === 'VERIFIED')).toBe(true);
    expect(completed.objectives.every((objective) => objective.verifiedOutcome?.achieved)).toBe(
      true,
    );
    expect(completed.objectives[0]?.verifiedOutcome?.evidence.length).toBeGreaterThan(0);
    expect(completed.checkpoints).toHaveLength(2);
    expect(completed.budgetUsage.objectivesCompleted).toBe(2);
    // Real changes through the governed ToolRuntime + real provider usage.
    expect(workspaceAuditWrites(runtime)).toBe(2);
    expect(completed.budgetUsage.tokensConsumed).toBeGreaterThan(0);
    expect(completed.budgetUsage.toolCallsExecuted).toBeGreaterThan(0);
    const alphaPath = path.join(workspace, 'alpha-notes.md');
    const betaPath = path.join(workspace, 'beta-notes.md');
    expect(existsSync(alphaPath)).toBe(true);
    expect(existsSync(betaPath)).toBe(true);
    expect(readFileSync(alphaPath, 'utf8')).toContain('alpha sprint summary content');
    expect(readFileSync(betaPath, 'utf8')).toContain('beta sprint summary content');
  });

  it('TEST B: primary provider fails at execution → existing routing fallback → alternate provider serves → mission continues', async () => {
    const workspace = newWorkspace();
    let flakyProvider: FlakyProvider | undefined;
    const runtime = makeRuntime(workspace, {
      providers: (orchestrator) => {
        flakyProvider = new FlakyProvider('flaky-primary');
        orchestrator.registerProvider(flakyProvider);
        orchestrator.registerProvider(new MockProvider());
      },
    });
    const mission = await runtime.controller.createMission({
      userId: 'eng-2',
      title: 'Provider failover mission',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: devConstraints(),
      initialObjectives: [
        'Create the workspace file failover-notes.md with the failover summary content',
      ],
    });
    await runtime.controller.startMission(mission.missionId);
    const done = await runtime.controller.runAutonomousLoop(mission.missionId);

    expect(flakyProvider).toBeDefined();
    expect(flakyProvider?.executeCalls).toBeGreaterThan(0); // primary really attempted
    expect(done.state).toBe('COMPLETED');
    expect(done.objectives[0]?.state).toBe('VERIFIED');
    expect(existsSync(path.join(workspace, 'failover-notes.md'))).toBe(true);
    expect(done.budgetUsage.objectivesCompleted).toBe(1);
  });

  it('TEST C: all providers unavailable → WAITING_FOR_PROVIDER, no fabricated execution, no busy loop, checkpoint persisted', async () => {
    const workspace = newWorkspace();
    const flaky = new FlakyProvider('down-provider');
    flaky.healthStatus = 'down';
    const runtime = makeRuntime(workspace, {
      providers: (orchestrator) => {
        orchestrator.registerProvider(flaky);
      },
    });
    const mission = await runtime.controller.createMission({
      userId: 'eng-3',
      title: 'Blocked on providers',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: devConstraints(),
      initialObjectives: [
        'Create the workspace file blocked-notes.md with the blocked summary content',
      ],
    });
    await runtime.controller.startMission(mission.missionId);
    const waiting = await runtime.controller.runAutonomousLoop(mission.missionId);

    expect(waiting.state).toBe('WAITING_FOR_PROVIDER');
    expect(waiting.outcomeReason).toContain('No capable provider');
    expect(flaky.executeCalls).toBe(0); // nothing fabricated
    expect(existsSync(path.join(workspace, 'blocked-notes.md'))).toBe(false);
    const checkpoint = await runtime.stores.checkpoints.getLatestForMission(mission.missionId);
    expect(checkpoint).toBeDefined();
    expect(checkpoint?.missionId).toBe(mission.missionId);
    expect(checkpoint?.remainingWork.some((work) => work.includes('blocked-notes.md'))).toBe(true);
  });

  it('TEST D: required tool unavailable → governed denial, honest failure, no fabricated success', async () => {
    // D1 — the tool is not registered on the governed registry at all.
    const workspace1 = newWorkspace();
    const runtime1 = makeRuntime(workspace1, { workspaceTools: false });
    const mission1 = await runtime1.controller.createMission({
      userId: 'eng-4',
      title: 'Missing tool mission',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace: workspace1,
      constraints: devConstraints(),
      initialObjectives: [
        'Create the workspace file denied-notes.md with the denied summary content',
      ],
    });
    await runtime1.controller.startMission(mission1.missionId);
    const done1 = await runtime1.controller.runAutonomousLoop(mission1.missionId);

    expect(done1.objectives[0]?.state).toBe('FAILED');
    expect(done1.objectives[0]?.verifiedOutcome).toBeUndefined();
    expect(existsSync(path.join(workspace1, 'denied-notes.md'))).toBe(false);
    expect(done1.state).toBe('FAILED'); // nothing achieved → honest failure
  });

  it('TEST D2: tool exists but mission constraints deny it → pre-execution refusal', async () => {
    const workspace2 = newWorkspace();
    const runtime2 = makeRuntime(workspace2);
    const mission2 = await runtime2.controller.createMission({
      userId: 'eng-4',
      title: 'Constraint-denied mission',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace: workspace2,
      constraints: { allowedTools: ['workspace_read'], grantedPermissionClasses: ['READ'] },
      initialObjectives: [
        'Create the workspace file not-allowed.md with the not allowed summary content',
      ],
    });
    await runtime2.controller.startMission(mission2.missionId);
    const done2 = await runtime2.controller.runAutonomousLoop(mission2.missionId);

    expect(done2.objectives[0]?.state).toBe('FAILED');
    expect(done2.objectives[0]?.failureReason).toContain('mission constraints deny required tools');
    expect(done2.objectives[0]?.verifiedOutcome).toBeUndefined();
    expect(existsSync(path.join(workspace2, 'not-allowed.md'))).toBe(false);
    expect(workspaceAuditWrites(runtime2)).toBe(0);
  });

  it('TEST E: crash simulation → restart → recovery from persisted checkpoint, no duplicate verified objective', async () => {
    const workspace = newWorkspace();
    const { InMemoryMissionStore, InMemoryCheckpointStore } =
      await import('@vedmoulya/mission-controller');
    const stores = {
      missions: new InMemoryMissionStore(),
      checkpoints: new InMemoryCheckpointStore(),
    };
    const beforeCrash = makeRuntime(workspace, { stores });
    const mission = await beforeCrash.controller.createMission({
      userId: 'eng-5',
      title: 'Crash recovery mission',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: devConstraints(),
      initialObjectives: [
        'Create the workspace file crash-a-notes.md with the crash alpha summary content',
        'Create the workspace file crash-b-notes.md with the crash beta summary content',
      ],
    });
    await beforeCrash.controller.startMission(mission.missionId);
    // Objective 1 completes + checkpoints — then the "process" dies.
    await beforeCrash.controller.runNextObjective(mission.missionId);
    const missionAfterCrash = await stores.missions.get(mission.missionId);
    expect(missionAfterCrash?.objectives[0]?.state).toBe('VERIFIED');

    // Fresh "process": new runtime over the SAME durable stores. Recovery
    // resumes from the last verified checkpoint and runs the next objective
    // only — objective 1 is never re-executed (no duplicate work).
    const afterRestart = makeRuntime(workspace, { stores });
    const recovered = await afterRestart.controller.resumeFromCheckpoint(mission.missionId);

    expect(recovered.state).toBe('RUNNING'); // resumed autonomously
    expect(recovered.objectives[0]?.state).toBe('VERIFIED'); // never re-executed
    expect(recovered.objectives[1]?.state).toBe('VERIFIED'); // resumed + finished
    // The restarted registry audited exactly ONE workspace write (objective 2).
    expect(workspaceAuditWrites(afterRestart)).toBe(1);
    // The autonomous loop then completes the mission — still no duplicate work.
    const completed = await afterRestart.controller.runAutonomousLoop(mission.missionId);
    expect(completed.state).toBe('COMPLETED');
    expect(completed.outcome).toBe('ACHIEVED');
    expect(completed.budgetUsage.objectivesCompleted).toBe(2);
    expect(existsSync(path.join(workspace, 'crash-a-notes.md'))).toBe(true);
    expect(existsSync(path.join(workspace, 'crash-b-notes.md'))).toBe(true);
    const checkpoints = await stores.checkpoints.listForMission(mission.missionId);
    expect(checkpoints).toHaveLength(2); // no duplicate checkpointed work
  });

  it('TEST F: high-risk git operation → approval required → cannot execute without approval', async () => {
    const workspace = newWorkspace();
    const runtime = makeRuntime(workspace);
    const adapter = runtime.ports.gitSafety;

    expect(adapter.requiresApproval('force_push')).toBe(true);
    expect(adapter.isSafe('force_push')).toBe(false);
    expect(adapter.requiresApproval('production_deploy')).toBe(true);
    expect(adapter.requiresApproval('change_secrets')).toBe(true);

    // Without approval: refused — nothing executed, decision audited.
    const denied = await adapter.requestOperation('force_push', {}, { approved: false });
    expect(denied.allowed).toBe(false);
    expect(denied.executed).toBe(false);
    expect(denied.requiresApproval).toBe(true);
    expect(denied.reason).toContain('explicit approval');
    expect(
      adapter.getAuditTrail().some((event) => event.operation === 'force_push' && !event.allowed),
    ).toBe(true);

    // With approval but no operator-bound executor: explicit refusal — never faked.
    const approvedUnbound = await adapter.requestOperation(
      'force_push',
      {},
      { approved: true, approvedBy: 'human-1' },
    );
    expect(approvedUnbound.allowed).toBe(true);
    expect(approvedUnbound.executed).toBe(false);
    expect(approvedUnbound.reason).toContain('no operator executor is bound');

    // With approval AND an operator-bound executor: the operator tooling runs it.
    const operatorBound = new RuntimeGitSafetyAdapter({
      workspaceRoot: workspace,
      approvedExecutor: async () => ({ detail: 'executed by operator tooling' }),
    });
    const executed = await operatorBound.requestOperation(
      'force_push',
      {},
      { approved: true, approvedBy: 'human-1' },
    );
    expect(executed.allowed).toBe(true);
    expect(executed.executed).toBe(true);

    // Safe read operations need no approval and run through the bounded reader.
    const safe = await adapter.requestOperation('status', {}, { approved: false });
    expect(safe.allowed).toBe(true);
    expect(safe.requiresApproval).toBe(false);
    expect(safe.detail).toContain('no git repository'); // honest for a plain temp dir

    // The mission-facing port enforces the same policy.
    expect(runtime.controller.getGitSafety().requiresApproval('history_rewrite')).toBe(true);
  });

  it('TEST G: verification failure → bounded recovery/retry → no false completion', async () => {
    const workspace = newWorkspace();
    const runtime = makeRuntime(workspace, {
      contentPolicy: (content) =>
        /forbidden/i.test(content) ? 'forbidden marker content' : undefined,
    });
    const mission = await runtime.controller.createMission({
      userId: 'eng-6',
      title: 'Verification failure mission',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      budget: { maxRetries: 1 },
      constraints: devConstraints(),
      initialObjectives: [
        'Create the workspace file forbidden-notes.md with FORBIDDEN content that must be rejected',
      ],
    });
    await runtime.controller.startMission(mission.missionId);
    const done = await runtime.controller.runAutonomousLoop(mission.missionId);

    // Bounded retry consumed, then the mission stopped honestly.
    expect(done.budgetUsage.retriesConsumed).toBe(1);
    expect(done.state).toBe('FAILED');
    expect(done.objectives[0]?.verifiedOutcome).toBeUndefined();
    expect(existsSync(path.join(workspace, 'forbidden-notes.md'))).toBe(false);
    // The checkpoint records the retry-queued failure honestly — never
    // VERIFIED, never claimed complete (verifiedOutcome is absent).
    const checkpoint = await runtime.stores.checkpoints.getLatestForMission(mission.missionId);
    expect(checkpoint?.verifiedOutcome).toBeUndefined();
    expect(checkpoint?.state).not.toBe('VERIFIED');
  });

  it('TEST H: mission budget exhausted → autonomous execution stops safely', async () => {
    const workspace = newWorkspace();
    const runtime = makeRuntime(workspace);
    const mission = await runtime.controller.createMission({
      userId: 'eng-7',
      title: 'Budget ceiling mission',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      budget: { maxObjectives: 1 },
      constraints: devConstraints(),
      initialObjectives: [
        'Create the workspace file budget-a-notes.md with the budget alpha summary content',
        'Create the workspace file budget-b-notes.md with the budget beta summary content',
      ],
    });
    await runtime.controller.startMission(mission.missionId);
    const done = await runtime.controller.runAutonomousLoop(mission.missionId);

    expect(done.state).toBe('FAILED');
    expect(done.outcomeReason).toBe('Maximum objectives reached');
    expect(done.budgetUsage.objectivesCompleted).toBe(1);
    expect(done.objectives[0]?.state).toBe('VERIFIED');
    expect(done.objectives[1]?.state).toBe('PENDING'); // never started
    expect(done.objectives[1]?.verifiedOutcome).toBeUndefined();
    expect(existsSync(path.join(workspace, 'budget-a-notes.md'))).toBe(true);
    expect(existsSync(path.join(workspace, 'budget-b-notes.md'))).toBe(false);
  });
});
