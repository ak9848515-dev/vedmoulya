// Deterministic fixtures: clock, execution ports, frozen run factory,
// and the memory service factory.

import type {
  AgentAiActionInput,
  AgentAiActionResult,
  AgentAiExecutionPort,
  AgentClockPort,
  AgentExecutionRun,
  AgentExecutionTraceRecord,
  AgentPlan,
  AgentToolActionResult,
  AgentToolExecutionPort,
  AgentToolInfo,
  AgentToolRegistryPort,
  ToolPermissionClass,
} from '@vedmoulya/agent-execution';
import type { CapabilityType } from '@vedmoulya/ai';
import { ExecutionMemoryService } from '../application/ExecutionMemoryService.js';
import { InMemoryExecutionMemoryStore } from '../infrastructure/InMemoryExecutionMemoryStore.js';

export class FakeClock implements AgentClockPort {
  private ms = 1_700_000_000_000;
  now(): string {
    return new Date(this.ms).toISOString();
  }
  timestampMs(): number {
    return this.ms;
  }
  advance(ms: number): void {
    this.ms += ms;
  }
  advanceDays(days: number): void {
    this.ms += days * 24 * 60 * 60 * 1000;
  }
}

export class FakeAiPort implements AgentAiExecutionPort {
  public calls: AgentAiActionInput[] = [];
  constructor(private readonly options: { content?: string; error?: string } = {}) {}
  async execute(input: AgentAiActionInput): Promise<AgentAiActionResult> {
    this.calls.push(input);
    if (this.options.error !== undefined) {
      return { error: this.options.error, provider: 'mock', model: 'mock-1' };
    }
    return {
      content: this.options.content ?? `answer for ${input.instruction}`,
      provider: 'mock',
      model: 'mock-1',
      tokens: { input: 10, output: 5, total: 15 },
      costUsd: 0.00001,
      latencyMs: 1,
    };
  }
  async canRoute(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

export interface FakeToolSpec {
  permissionClass: ToolPermissionClass;
  outcome?: string;
  denied?: boolean;
  error?: string;
}

export class FakeToolRegistry implements AgentToolRegistryPort {
  constructor(private readonly tools: Record<string, FakeToolSpec> = {}) {}
  listAllowed(): string[] {
    return Object.keys(this.tools);
  }
  describe(toolName: string): AgentToolInfo | undefined {
    const spec = this.tools[toolName];
    if (spec === undefined) return undefined;
    return { toolName, permissionClass: spec.permissionClass, requiresApproval: false };
  }
}

export class FakeToolPort implements AgentToolExecutionPort {
  public calls: Array<{ toolName: string; arguments: Record<string, unknown> }> = [];
  constructor(private readonly spec: FakeToolSpec) {}
  async execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
  }): Promise<AgentToolActionResult> {
    this.calls.push(input);
    if (this.spec.denied === true) {
      return { ok: false, denied: true, outcome: '', error: 'denied by security policy' };
    }
    if (this.spec.error !== undefined) {
      return { ok: false, denied: false, outcome: '', error: this.spec.error };
    }
    return {
      ok: true,
      denied: false,
      outcome: this.spec.outcome ?? `ok from ${input.toolName}`,
      artifacts: [{ name: `${input.toolName}.out`, type: 'text' }],
      latencyMs: 1,
    };
  }
  listAllowed(): string[] {
    return ['read.tool'];
  }
}

// ── Frozen run factory (for record/signal unit tests) ─────────────

export function makeAiStep(
  stepId: string,
  options: { capability?: CapabilityType; instruction?: string; verificationText?: string } = {},
): AgentPlan['steps'][number] {
  const capability: CapabilityType = options.capability ?? 'reasoning';
  return {
    stepId,
    objective: `Do ${stepId}`,
    capability,
    requiredCapabilities: options.capability === 'coding' ? ['coding', 'reasoning'] : undefined,
    dependencies: [],
    allowedTools: [],
    actions: [
      {
        actionId: `${stepId}-a1`,
        kind: 'ai',
        capability,
        instruction: options.instruction ?? `Perform ${stepId} for {goal}`,
        expectedOutcome: 'a result',
      },
    ],
    verificationPolicy:
      options.verificationText !== undefined
        ? {
            kind: 'rule',
            description: 'output includes keyword',
            checks: [{ name: 'has-keyword', kind: 'includes', text: options.verificationText }],
          }
        : undefined,
    recoveryPolicy: { maxAttempts: 2, maxRevisions: 1 },
  };
}

export function makePlan(
  options: { objective?: string; steps?: AgentPlan['steps'] } = {},
): AgentPlan {
  return {
    planId: 'plan-test-1',
    goalId: 'goal-test-1',
    objective: options.objective ?? 'Complete the repository task',
    steps: options.steps ?? [makeAiStep('step-1', { verificationText: 'pass' })],
  };
}

/** A completed frozen run + trace built by hand (deterministic evidence). */
export function makeCompletedRun(
  options: {
    runId?: string;
    userId?: string;
    goal?: string;
    outcome?: AgentExecutionRun['outcome'];
    attempts?: number;
    revisions?: number;
    tokensUsed?: number;
    costUsd?: number;
    error?: string;
    actionTraces?: Array<{
      stepId: string;
      actionId?: string;
      kind?: 'ai' | 'tool';
      toolName?: string;
      provider?: string;
      model?: string;
      status?: string;
      verdict?: AgentExecutionTraceRecord['verdict'];
      recovery?: AgentExecutionTraceRecord['recovery'];
      fallback?: boolean;
      tokensUsed?: number;
      latencyMs?: number;
      message?: string;
    }>;
    plan?: AgentPlan;
  } = {},
): { run: AgentExecutionRun; traces: AgentExecutionTraceRecord[] } {
  const plan = options.plan ?? makePlan();
  const now = '2026-01-01T00:00:00.000Z';
  const runId = options.runId ?? 'run-1';
  const actionTraces = options.actionTraces ?? [
    {
      stepId: 'step-1',
      actionId: 'action-1',
      kind: 'ai',
      provider: 'mock',
      model: 'mock-1',
      status: 'succeeded',
      verdict: 'VERIFIED',
      tokensUsed: 15,
      latencyMs: 5,
    },
  ];
  const traces: AgentExecutionTraceRecord[] = actionTraces.flatMap((t) => {
    const records: AgentExecutionTraceRecord[] = [
      {
        runId,
        goalId: plan.goalId,
        planId: plan.planId,
        stepId: t.stepId,
        actionId: t.actionId,
        phase: 'action',
        attempt: 1,
        revision: 0,
        kind: t.kind ?? 'ai',
        capability: 'reasoning',
        provider: t.provider,
        model: t.model,
        toolName: t.toolName,
        status: t.status ?? 'succeeded',
        tokensUsed: t.tokensUsed ?? 15,
        costUsd: 0.00001,
        latencyMs: t.latencyMs ?? 5,
        message: t.message ?? 'ok',
        startedAt: now,
        endedAt: now,
      },
    ];
    if (t.verdict !== undefined) {
      records.push({
        runId,
        goalId: plan.goalId,
        planId: plan.planId,
        stepId: t.stepId,
        actionId: t.actionId,
        phase: 'verification',
        attempt: 1,
        status: t.verdict,
        verdict: t.verdict,
        tokensUsed: 0,
        costUsd: 0,
        latencyMs: 0,
        message: `verification ${t.verdict}`,
        startedAt: now,
        endedAt: now,
      });
    }
    if (t.recovery !== undefined) {
      records.push({
        runId,
        goalId: plan.goalId,
        planId: plan.planId,
        stepId: t.stepId,
        phase: 'recovery',
        attempt: 1,
        status: 'recovering',
        recovery: t.recovery,
        tokensUsed: 0,
        costUsd: 0,
        latencyMs: 0,
        message: 'recovery',
        startedAt: now,
        endedAt: now,
      });
    }
    return records;
  });

  const succeededSteps = actionTraces.filter(
    (t) => (t.verdict ?? 'VERIFIED') === 'VERIFIED',
  ).length;
  const run: AgentExecutionRun = {
    runId,
    goalId: plan.goalId,
    planId: plan.planId,
    userId: options.userId ?? 'user-1',
    goal: options.goal ?? 'Complete the repository task',
    objective: plan.objective,
    autonomyLevel: 'SUPERVISED',
    plan,
    budget: {
      maxAttemptsPerStep: 2,
      maxRevisionsPerStep: 1,
      maxToolCalls: 8,
      maxTokens: 64_000,
      maxCostUsd: 1,
      maxLatencyMs: 300_000,
    },
    usage: {
      attempts: options.attempts ?? actionTraces.length,
      revisions: options.revisions ?? 0,
      toolCalls: actionTraces.filter((t) => t.kind === 'tool').length,
      tokensUsed: options.tokensUsed ?? 15,
      costUsd: options.costUsd ?? 0.00001,
      latencyMs: 5,
    },
    state: 'COMPLETED',
    stateHistory: ['PLANNING', 'EXECUTING', 'COMPLETED'],
    stepResults: plan.steps.map((step) => ({
      stepId: step.stepId,
      objective: step.objective,
      status: 'completed',
      verified: succeededSteps > 0,
      actions: [],
      observations: [],
      recoveries: [],
      attempts: 1,
      revisions: 0,
      toolCalls: 0,
      tokensUsed: 0,
      costUsd: 0,
      latencyMs: 0,
    })),
    approvals: [],
    approvalDecisions: [],
    validationIssues: [],
    outcome: options.outcome ?? 'ACHIEVED',
    outcomeReasons: [],
    error: options.error,
    createdAt: now,
    updatedAt: now,
    finishedAt: now,
  };
  return { run, traces };
}

export function makeMemoryService(
  options: {
    clock?: FakeClock;
    store?: import('../contracts/execution-memory-ports.js').ExecutionMemoryStore;
    retentionDays?: number;
    halfLifeDays?: number;
  } = {},
): {
  service: ExecutionMemoryService;
  clock: FakeClock;
  store: import('../contracts/execution-memory-ports.js').ExecutionMemoryStore;
} {
  const clock = options.clock ?? new FakeClock();
  const store = options.store ?? new InMemoryExecutionMemoryStore();
  const service = new ExecutionMemoryService({
    store,
    clock,
    retentionDays: options.retentionDays,
    halfLifeDays: options.halfLifeDays,
  });
  return { service, clock, store };
}
