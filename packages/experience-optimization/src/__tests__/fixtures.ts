// Deterministic fixtures for the experience-optimization package.

import type {
  AgentExecutionRun,
  AgentExecutionTraceRecord,
  AgentPlan,
  RecoveryStrategyType,
} from '@vedmoulya/agent-execution';
import type { CapabilityType } from '@vedmoulya/ai';
import {
  ExecutionMemoryService,
  InMemoryExecutionMemoryStore,
  type MemoryEntry,
} from '@vedmoulya/execution-memory';
import { ExperienceOptimizationService } from '../application/ExperienceOptimizationService.js';
import { ExperienceMemoryPortAdapter } from '../infrastructure/ExperienceMemoryPortAdapter.js';
import { InMemoryRecommendationOutcomeStore } from '../infrastructure/InMemoryRecommendationOutcomeStore.js';

export class FakeClock {
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

export function makeStep(
  stepId: string,
  options: { capability?: CapabilityType; toolName?: string } = {},
): AgentPlan['steps'][number] {
  const capability: CapabilityType = options.capability ?? 'reasoning';
  return {
    stepId,
    objective: `Do ${stepId}`,
    capability,
    requiredCapabilities: capability === 'coding' ? ['coding', 'reasoning'] : undefined,
    dependencies: [],
    allowedTools: options.toolName !== undefined ? [options.toolName] : [],
    // AgentActionSpec is a discriminated union — tool actions carry a
    // toolName, AI actions carry capability + instruction. Never a union
    // object that matches neither branch.
    actions:
      options.toolName !== undefined
        ? [
            {
              actionId: `${stepId}-a1`,
              kind: 'tool' as const,
              toolName: options.toolName,
              expectedOutcome: 'a result',
            },
          ]
        : [
            {
              actionId: `${stepId}-a1`,
              kind: 'ai' as const,
              capability,
              instruction: `Perform ${stepId}`,
              expectedOutcome: 'a result',
            },
          ],
    verificationPolicy: {
      kind: 'rule',
      description: 'keyword',
      checks: [{ name: 'has-keyword', kind: 'includes', text: 'pass' }],
    },
    recoveryPolicy: { maxAttempts: 2, maxRevisions: 1 },
  };
}

export function makeCompletedRun(
  options: {
    runId?: string;
    userId?: string;
    goal?: string;
    outcome?: AgentExecutionRun['outcome'];
    capability?: CapabilityType;
    provider?: string;
    model?: string;
    toolName?: string;
    stepCount?: number;
    verdicts?: AgentExecutionTraceRecord['verdict'][];
    recoveryStrategy?: RecoveryStrategyType;
    withRecovery?: boolean;
  } = {},
): { run: AgentExecutionRun; traces: AgentExecutionTraceRecord[] } {
  const capability = options.capability ?? 'coding';
  const stepCount = options.stepCount ?? 1;
  const steps = Array.from({ length: stepCount }, (_, i) =>
    makeStep(`step-${i + 1}`, { capability, toolName: options.toolName }),
  );
  const plan: AgentPlan = {
    planId: `plan-${options.runId ?? '1'}`,
    goalId: `goal-${options.runId ?? '1'}`,
    objective: options.goal ?? 'Fix the failing tests',
    steps,
  };
  const runId = options.runId ?? 'run-1';
  const now = '2026-01-01T00:00:00.000Z';
  const verdicts = options.verdicts ?? Array.from({ length: stepCount }, () => 'VERIFIED' as const);
  const traces: AgentExecutionTraceRecord[] = [];
  steps.forEach((step, i) => {
    const verdict = verdicts[i] ?? 'VERIFIED';
    traces.push({
      runId,
      goalId: plan.goalId,
      planId: plan.planId,
      stepId: step.stepId,
      actionId: `${step.stepId}-a1`,
      phase: 'action',
      attempt: 1,
      revision: 0,
      kind: options.toolName !== undefined ? 'tool' : 'ai',
      capability,
      provider: options.provider,
      model: options.model,
      toolName: options.toolName,
      status: verdict === 'VERIFIED' ? 'succeeded' : 'failed',
      tokensUsed: 15,
      costUsd: 0.001,
      latencyMs: 5,
      message: 'ok',
      startedAt: now,
      endedAt: now,
    });
    // A verification record exists for EVERY step (verbatim frozen verdict).
    // Without it, VERIFIED runs would carry no verification evidence and
    // could never produce VERIFICATION_SUCCESS / TOOL_SUCCESS signals.
    traces.push({
      runId,
      goalId: plan.goalId,
      planId: plan.planId,
      stepId: step.stepId,
      phase: 'verification',
      attempt: 1,
      status: verdict,
      verdict,
      tokensUsed: 0,
      costUsd: 0,
      latencyMs: 0,
      message: `verification ${verdict}`,
      startedAt: now,
      endedAt: now,
    });
    if (options.withRecovery === true) {
      traces.push({
        runId,
        goalId: plan.goalId,
        planId: plan.planId,
        stepId: step.stepId,
        phase: 'recovery',
        attempt: 1,
        status: 'recovered',
        recovery: options.recoveryStrategy ?? 'alternate_tool',
        tokensUsed: 0,
        costUsd: 0,
        latencyMs: 0,
        message: 'recovery',
        startedAt: now,
        endedAt: now,
      });
    }
  });
  const allVerified = verdicts.every((v) => v === 'VERIFIED');
  const run: AgentExecutionRun = {
    runId,
    goalId: plan.goalId,
    planId: plan.planId,
    userId: options.userId ?? 'user-1',
    goal: options.goal ?? 'Fix the failing tests',
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
      attempts: stepCount,
      revisions: 0,
      toolCalls: options.toolName !== undefined ? stepCount : 0,
      tokensUsed: 15,
      costUsd: 0.001,
      latencyMs: 5,
    },
    state: 'COMPLETED',
    stateHistory: ['PLANNING', 'EXECUTING', 'COMPLETED'],
    stepResults: steps.map((step) => ({
      stepId: step.stepId,
      objective: step.objective,
      status: 'completed',
      verified: true,
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
    outcome: options.outcome ?? (allVerified ? 'ACHIEVED' : 'FAILED'),
    outcomeReasons: [],
    error: undefined,
    createdAt: now,
    updatedAt: now,
    finishedAt: now,
  };
  return { run, traces };
}

/** A valid, ready-to-save MemoryEntry (full control for unit tests). */
export function makeEntry(
  overrides: Partial<MemoryEntry> & { subject: string; category: MemoryEntry['category'] },
): MemoryEntry {
  const base: MemoryEntry = {
    entryId: `entry-${overrides.subject}`,
    fingerprint: `fp-${overrides.category}-${overrides.subject}`,
    category: overrides.category,
    scope: 'GLOBAL',
    subject: overrides.subject,
    predicate: 'verified_success_rate',
    value: 0.9,
    sampleCount: 10,
    successCount: 9,
    failureCount: 1,
    verifiedCount: 9,
    evidence: { executionIds: ['run-1'], evidenceCount: 1 },
    confidence: { score: 0.8, level: 'HIGH', factors: ['sampleCount>=5', 'verifiedRatio>=0.6'] },
    recency: 0.9,
    provenance: { executionIds: ['run-1'], sourceType: 'execution' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  return {
    ...base,
    ...overrides,
    entryId: overrides.entryId ?? base.entryId,
    fingerprint: overrides.fingerprint ?? base.fingerprint,
  };
}

export interface TestRig {
  clock: FakeClock;
  service: ExecutionMemoryService;
  optimization: ExperienceOptimizationService;
  store: InMemoryExecutionMemoryStore;
  outcomes: InMemoryRecommendationOutcomeStore;
}

export function makeRig(options: { random?: () => number } = {}): TestRig {
  const clock = new FakeClock();
  const store = new InMemoryExecutionMemoryStore();
  const service = new ExecutionMemoryService({ store, clock });
  const outcomes = new InMemoryRecommendationOutcomeStore();
  const memoryPort = new ExperienceMemoryPortAdapter(service, 45, () => clock.timestampMs());
  const optimization = new ExperienceOptimizationService({
    memory: memoryPort,
    outcomes,
    clock: () => clock.now(),
    random: options.random,
  });
  return { clock, service, store, optimization, outcomes };
}

export async function ingestRuns(
  rig: TestRig,
  runs: Array<ReturnType<typeof makeCompletedRun> & { count?: number }>,
): Promise<void> {
  for (const { run, traces, count } of runs) {
    const n = count ?? 1;
    for (let i = 0; i < n; i++) {
      await rig.service.ingestRun(run, traces);
    }
  }
}
