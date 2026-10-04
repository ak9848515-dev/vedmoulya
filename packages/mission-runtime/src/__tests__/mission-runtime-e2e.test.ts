// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VedMoulya â€” Mission Runtime E2E (BLD-022)
//
// Runs the REAL composition â€” real MissionControllerService, real
// PlanningApplicationService/PlannerService, real AgentExecutionService,
// real AIOrchestrationService with registered providers, real governed
// ToolRegistry executing a real (temporary) workspace â€” and proves the
// required behaviors Aâ€“H. The only test doubles are provider ADAPTERS
// implementing the frozen ProviderAdapter contract (simulating a real
// provider failing/recovering) â€” no runtime layer is mocked.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

/**
 * A REAL (non-synthetic) provider that always serves. It exists so failover
 * tests can prove real-provider routing instead of leaning on MockProvider â€”
 * a synthetic provider is deliberately refused once a real one has failed,
 * which is the anti-fabrication guarantee this suite must respect.

 */
function realAlternateProvider(): ProviderAdapter {
  return {
    name: 'real-alternate',
    family: 'flaky-test',
    capabilities: ALL_CAPABILITIES,
    isHealthy: async () => true,
    getHealth: async () => ({
      providerId: 'real-alternate',
      status: 'healthy',
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
        content: `Confirmed against the observed request. ${prompt}`,
        provider: 'real-alternate',
        model: 'real-alternate-deterministic',
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
        traceId: 'trace-real-alternate',
        metadata: {
          providerFamily: 'ollama' as const,
          modelVersion: 'real-alternate-deterministic',
          processingTime: 1,
          contextUsed: ['system', 'user'],
          routingDecision: {
            selectedProvider: 'real-alternate',
            reason: 'deterministic real alternate provider',
            alternativesConsidered: [],
            strategy: 'balanced' as const,
          },
          validationDetails: [],
        },
      };
    },
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FILE-ARTIFACT TOOL PROVISIONING â€” deterministic integration proof.
//
// The live Mission failure was diagnosed to the planner: a "create a file
// with exact contents" objective matched no tool-bearing template and fell
// through to GENERIC (aiStep only â‡’ zero tool actions). These tests prove
// the fix end-to-end through the REAL composition: real governed workspace
// tools, the real AgentExecutionEngine, real verification, real checkpoint.
//
// The AI is a deterministic stub HERE ONLY â€” this test proves tool
// provisioning and dispatch. The real-provider proof is the live harness.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('file-artifact objective reaches the real workspace tools', () => {
  it('writes and reads back the exact content through governed tools', async () => {
    const workspace = newWorkspace();
    const runtime = makeRuntime(workspace, { workspaceTools: true });
    const objective =
      'Create a file named mission-acceptance.txt with exact contents VEDMOULYA_MISSION_ACCEPTANCE_OK';

    const mission = await runtime.controller.createMission({
      userId: 'acceptance-1',
      title: 'File artifact acceptance',
      objective,
      mode: 'DEVELOPMENT',
      workspace,
      constraints: devConstraints(),
      initialObjectives: [objective],
    });
    await runtime.controller.startMission(mission.missionId);
    const completed = await runtime.controller.runAutonomousLoop(mission.missionId);

    // EXACT content, read from the real filesystem â€” not a substring match.
    const file = path.join(workspace, 'mission-acceptance.txt');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe('VEDMOULYA_MISSION_ACCEPTANCE_OK');

    // REAL governed tool calls happened (write + read-back). Bounded recovery
    // may re-run a step, so assert presence and the exact count observed by the
    // budget rather than an exact single write.
    const audit = runtime.toolRegistry.getAuditTrail();
    expect(audit.filter((e) => e.toolName === 'workspace_write').length).toBeGreaterThan(0);
    expect(audit.filter((e) => e.toolName === 'workspace_read').length).toBeGreaterThan(0);
    expect(completed.budgetUsage.toolCallsExecuted).toBeGreaterThanOrEqual(2);

    // REAL verification, memory-bearing evidence and a checkpoint.
    expect(completed.objectives[0]?.state).toBe('VERIFIED');
    expect(completed.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    expect(completed.objectives[0]?.verifiedOutcome?.evidence.length).toBeGreaterThan(0);
    expect(completed.checkpoints.length).toBeGreaterThan(0);
    expect(completed.state).toBe('COMPLETED');
  });

  it('E: a tool name the principal does not hold is still refused', async () => {
    const workspace = newWorkspace();
    const runtime = makeRuntime(workspace, { workspaceTools: true });
    // READ-only principal: the plan may not write.
    const mission = await runtime.controller.createMission({
      userId: 'acceptance-2',
      title: 'Read-only principal',
      objective: 'Inspect the workspace',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: { allowedTools: ['workspace_read'], grantedPermissionClasses: ['READ'] },
      initialObjectives: [
        'Create a file named mission-acceptance.txt with exact contents VEDMOULYA_MISSION_ACCEPTANCE_OK',
      ],
    });
    await runtime.controller.startMission(mission.missionId);
    const completed = await runtime.controller.runAutonomousLoop(mission.missionId);

    // The authorization boundary is unchanged: no write ever happened.
    expect(existsSync(path.join(workspace, 'mission-acceptance.txt'))).toBe(false);
    expect(
      runtime.toolRegistry.getAuditTrail().filter((e) => e.toolName === 'workspace_write'),
    ).toHaveLength(0);
    expect(completed.state).not.toBe('COMPLETED');
  });
});

describe('Mission Runtime E2E â€” real composition (BLD-022)', () => {
  it('TEST A: two sequential objectives â€” plan, AI execution, ToolRuntime change, verification, checkpoint, autonomous continuation, no second user prompt', async () => {
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
    // ONE autonomous loop call drives BOTH objectives â€” no second prompt.
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

  it('TEST B: primary provider fails at execution â†’ existing routing fallback â†’ alternate provider serves â†’ mission continues', async () => {
    const workspace = newWorkspace();
    let flakyProvider: FlakyProvider | undefined;
    const runtime = makeRuntime(workspace, {
      workspaceTools: true,
      providers: (orchestrator) => {
        flakyProvider = new FlakyProvider('flaky-primary');
        orchestrator.registerProvider(flakyProvider);
        // The alternate must be a REAL provider: a synthetic one is refused
        // once a real provider existed and failed, so using MockProvider here
        // would no longer prove failover â€” it would prove nothing executes.
        orchestrator.registerProvider(realAlternateProvider());
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

  it('TEST C: all providers unavailable â†’ WAITING_FOR_PROVIDER, no fabricated execution, no busy loop, checkpoint persisted', async () => {
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

  it('TEST D: required tool unavailable â†’ governed denial, honest failure, no fabricated success', async () => {
    // D1 â€” the tool is not registered on the governed registry at all.
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
    expect(done1.state).toBe('FAILED'); // nothing achieved â†’ honest failure
  });

  it('TEST D2: tool exists but mission constraints deny it â†’ pre-execution refusal', async () => {
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

  it('TEST E: crash simulation â†’ restart â†’ recovery from persisted checkpoint, no duplicate verified objective', async () => {
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
    // Objective 1 completes + checkpoints â€” then the "process" dies.
    await beforeCrash.controller.runNextObjective(mission.missionId);
    const missionAfterCrash = await stores.missions.get(mission.missionId);
    expect(missionAfterCrash?.objectives[0]?.state).toBe('VERIFIED');

    // Fresh "process": new runtime over the SAME durable stores. Recovery
    // resumes from the last verified checkpoint and runs the next objective
    // only â€” objective 1 is never re-executed (no duplicate work).
    const afterRestart = makeRuntime(workspace, { stores });
    const recovered = await afterRestart.controller.resumeFromCheckpoint(mission.missionId);

    expect(recovered.state).toBe('RUNNING'); // resumed autonomously
    expect(recovered.objectives[0]?.state).toBe('VERIFIED'); // never re-executed
    expect(recovered.objectives[1]?.state).toBe('VERIFIED'); // resumed + finished
    // The restarted registry audited exactly ONE workspace write (objective 2).
    expect(workspaceAuditWrites(afterRestart)).toBe(1);
    // The autonomous loop then completes the mission â€” still no duplicate work.
    const completed = await afterRestart.controller.runAutonomousLoop(mission.missionId);
    expect(completed.state).toBe('COMPLETED');
    expect(completed.outcome).toBe('ACHIEVED');
    expect(completed.budgetUsage.objectivesCompleted).toBe(2);
    expect(existsSync(path.join(workspace, 'crash-a-notes.md'))).toBe(true);
    expect(existsSync(path.join(workspace, 'crash-b-notes.md'))).toBe(true);
    const checkpoints = await stores.checkpoints.listForMission(mission.missionId);
    expect(checkpoints).toHaveLength(2); // no duplicate checkpointed work
  });

  it('TEST F: high-risk git operation â†’ approval required â†’ cannot execute without approval', async () => {
    const workspace = newWorkspace();
    const runtime = makeRuntime(workspace);
    const adapter = runtime.ports.gitSafety;

    expect(adapter.requiresApproval('force_push')).toBe(true);
    expect(adapter.isSafe('force_push')).toBe(false);
    expect(adapter.requiresApproval('production_deploy')).toBe(true);
    expect(adapter.requiresApproval('change_secrets')).toBe(true);

    // Without approval: refused â€” nothing executed, decision audited.
    const denied = await adapter.requestOperation('force_push', {}, { approved: false });
    expect(denied.allowed).toBe(false);
    expect(denied.executed).toBe(false);
    expect(denied.requiresApproval).toBe(true);
    expect(denied.reason).toContain('explicit approval');
    expect(
      adapter.getAuditTrail().some((event) => event.operation === 'force_push' && !event.allowed),
    ).toBe(true);

    // With approval but no operator-bound executor: explicit refusal â€” never faked.
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

  it('TEST G: verification failure â†’ bounded recovery/retry â†’ no false completion', async () => {
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
    // The checkpoint records the retry-queued failure honestly â€” never
    // VERIFIED, never claimed complete (verifiedOutcome is absent).
    const checkpoint = await runtime.stores.checkpoints.getLatestForMission(mission.missionId);
    expect(checkpoint?.verifiedOutcome).toBeUndefined();
    expect(checkpoint?.state).not.toBe('VERIFIED');
  });

  it('TEST H: mission budget exhausted â†’ autonomous execution stops safely', async () => {
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

  // ──────────────────────────────────────────────────────────────────
  // MISSION IDENTITY → AI USAGE
  //
  // The Mission runtime already knew its own missionId/objectiveId
  // (`executionContext` on executePlan), but the adapter used it only to
  // index a lookup and then DISCARDED it — so no provider execution could
  // ever be attributed to a Mission. These tests prove the identity now
  // survives into the run that issues every AI execution, and that a
  // generic (Ask/Brain-shaped) run never gains an invented Mission.
  // ──────────────────────────────────────────────────────────────────
  describe('mission identity reaches the AI execution run', () => {
    it('carries the real missionId/objectiveId onto the Mission AI run', async () => {
      const workspace = newWorkspace();
      const runtime = makeRuntime(workspace, { workspaceTools: true });
      const objective =
        'Create a file named identity-probe.txt with exact contents VEDMOULYA_IDENTITY_PROBE';

      const mission = await runtime.controller.createMission({
        userId: 'identity-user-1',
        title: 'Identity propagation',
        objective,
        mode: 'DEVELOPMENT',
        workspace,
        constraints: devConstraints(),
        initialObjectives: [objective],
      });
      const objectiveId = mission.objectives[0]!.objectiveId;
      await runtime.controller.startMission(mission.missionId);
      await runtime.controller.runAutonomousLoop(mission.missionId);

      const run = runtime.runs.forObjective(mission.missionId, objectiveId);
      expect(run).toBeDefined();
      expect(run?.userId).toBe('identity-user-1');
      expect(run?.missionContext).toEqual({ missionId: mission.missionId, objectiveId });
    });

    it('a generic (non-Mission) run carries no mission identity at all', async () => {
      const workspace = newWorkspace();
      const runtime = makeRuntime(workspace, { workspaceTools: true });

      // This is the Ask/Brain/generic-AI shape: no missionContext supplied,
      // so nothing downstream can invent a Mission from it.
      const bare = await runtime.agent.start({
        userId: 'generic-user',
        goal: 'Answer a question',
        plan: { objective: 'Answer a question', steps: [] },
        autonomyLevel: 'SUPERVISED',
      });
      expect(bare.missionContext).toBeUndefined();
      expect(bare.userId).toBe('generic-user');
    });

    it('two users never share mission identity', async () => {
      const a = newWorkspace();
      const b = newWorkspace();
      const runtime = makeRuntime(a, { workspaceTools: true });
      const objA = 'Create a file named iso-a.txt with exact contents ISO_A';
      const objB = 'Create a file named iso-b.txt with exact contents ISO_B';

      const missionA = await runtime.controller.createMission({
        userId: 'iso-user-A',
        title: 'A',
        objective: objA,
        mode: 'DEVELOPMENT',
        workspace: a,
        constraints: devConstraints(),
        initialObjectives: [objA],
      });
      const missionB = await runtime.controller.createMission({
        userId: 'iso-user-B',
        title: 'B',
        objective: objB,
        mode: 'DEVELOPMENT',
        workspace: b,
        constraints: devConstraints(),
        initialObjectives: [objB],
      });
      expect(missionA.missionId).not.toBe(missionB.missionId);
      expect(missionA.objectives[0]!.objectiveId).not.toBe(missionB.objectives[0]!.objectiveId);

      await runtime.controller.startMission(missionA.missionId);
      await runtime.controller.runAutonomousLoop(missionA.missionId);
      const runA = runtime.runs.forObjective(
        missionA.missionId,
        missionA.objectives[0]!.objectiveId,
      );
      // Each run records only its OWN identity — no cross-user bleed.
      expect(runA?.missionContext?.missionId).toBe(missionA.missionId);
      expect(runA?.missionContext?.missionId).not.toBe(missionB.missionId);
      expect(runA?.userId).toBe('iso-user-A');
    });
  });
});
