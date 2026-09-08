// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Application Service
//
// The agent.* execution contract (domain-first — no full UI yet):
//   agent.start       — create + validate a run, execute until pause/end
//   agent.status      — state + budget snapshot
//   agent.getTrace    — sanitized correlated execution trace
//   agent.approveStep — record a human approval and continue
//   agent.rejectStep  — record a human rejection (step fails, goal FAILED)
//   agent.cancel      — cancel a paused run
//   agent.list        — owned runs
//
// Governance is authoritative: every approval/rejection is recorded on the
// run with the deciding owner id; nothing executes past a gate without a
// recorded decision.
// ──────────────────────────────────────────────────────────────────

import { generateId, NotFoundError, ConflictError } from '@vedmoulya/core';
import type {
  AgentAiExecutionPort,
  AgentClockPort,
  AgentExecutionRunStorePort,
  AgentModelVerifierPort,
  AgentToolExecutionPort,
  AgentToolRegistryPort,
} from '../contracts/agent-execution-ports.js';
import { AgentExecutionEngine } from '../domain/AgentExecutionEngine.js';
import { buildExecutionTrace } from '../domain/trace.js';
import { SystemClock } from '../infrastructure/SystemClock.js';
import { ownsRun } from '../domain/approval-policy.js';
import { InMemoryAgentExecutionStore } from '../infrastructure/InMemoryAgentExecutionStore.js';
import type {
  AgentAutonomyLevel,
  AgentExecutionRun,
  AgentExecutionTraceRecord,
  AgentPlan,
  AgentRunBudgetConfig,
  AgentRunUsage,
  GoalOutcome,
} from '../types/agent-execution-types.js';
import { AGENT_TERMINAL_STATES, DEFAULT_AGENT_RUN_BUDGET } from '../types/agent-execution-types.js';

export interface AgentExecutionServiceOptions {
  ai?: AgentAiExecutionPort;
  tools?: AgentToolExecutionPort;
  toolRegistry?: AgentToolRegistryPort;
  modelVerifier?: AgentModelVerifierPort;
  clock?: AgentClockPort;
  store?: AgentExecutionRunStorePort;
}

export interface StartAgentExecutionInput {
  userId: string;
  goal: string;
  goalId?: string;
  /** The authoritative plan — produced by the existing planning layer.
   *  goalId/planId may be omitted; the service generates them when absent. */
  plan: Omit<AgentPlan, 'goalId' | 'planId'> & Partial<Pick<AgentPlan, 'goalId' | 'planId'>>;
  autonomyLevel?: AgentAutonomyLevel;
  budget?: Partial<AgentRunBudgetConfig>;
}

export interface AgentRunStatusDTO {
  runId: string;
  goalId: string;
  planId: string;
  state: string;
  outcome?: GoalOutcome;
  currentStepId?: string;
  completedSteps: string[];
  blockedSteps: string[];
  failedSteps: string[];
  waitingSteps: string[];
  usage: AgentRunUsage;
  validationIssueCount: number;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

const APPROVAL_GATED_STATES = ['WAITING_FOR_APPROVAL'];

export class AgentExecutionService {
  private readonly store: AgentExecutionRunStorePort;
  private readonly engine: AgentExecutionEngine;
  private readonly clock: AgentClockPort;

  constructor(options: AgentExecutionServiceOptions = {}) {
    this.store = options.store ?? new InMemoryAgentExecutionStore();
    this.clock = options.clock ?? new SystemClock();
    this.engine = new AgentExecutionEngine({
      ai: options.ai,
      tools: options.tools,
      toolRegistry: options.toolRegistry,
      modelVerifier: options.modelVerifier,
      clock: this.clock,
      onUpdate: (run): void => {
        this.store.save(run);
      },
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /** Create, validate and execute a run until it pauses or terminates. */
  async start(input: StartAgentExecutionInput): Promise<AgentExecutionRun> {
    if (!input.goal.trim()) {
      throw new Error('goal is required');
    }
    const budget: AgentRunBudgetConfig = {
      ...DEFAULT_AGENT_RUN_BUDGET,
      ...(input.budget ?? {}),
    };
    const now = this.clock.now();
    const goalId = input.goalId ?? `goal-${generateId()}`;
    const plan: AgentPlan = {
      ...input.plan,
      goalId: input.plan.goalId ?? goalId,
      planId: input.plan.planId ?? `plan-${generateId()}`,
    };
    const run: AgentExecutionRun = {
      runId: `agent-run-${generateId()}`,
      goalId: plan.goalId,
      planId: plan.planId,
      userId: input.userId,
      goal: input.goal,
      objective: plan.objective,
      autonomyLevel: input.autonomyLevel ?? 'SUPERVISED',
      plan,
      budget,
      usage: { attempts: 0, revisions: 0, toolCalls: 0, tokensUsed: 0, costUsd: 0, latencyMs: 0 },
      state: 'PLANNING',
      stateHistory: ['PLANNING'],
      stepResults: plan.steps.map((step) => ({
        stepId: step.stepId,
        objective: step.objective,
        status: 'pending' as const,
        verified: false,
        actions: [],
        observations: [],
        recoveries: [],
        attempts: 0,
        revisions: 0,
        toolCalls: 0,
        tokensUsed: 0,
        costUsd: 0,
        latencyMs: 0,
      })),
      approvals: [],
      approvalDecisions: [],
      validationIssues: [],
      outcomeReasons: [],
      createdAt: now,
      updatedAt: now,
    };
    this.store.save(run);
    const finished = await this.engine.run(run);
    this.store.save(finished);
    return finished;
  }

  // ── Governance: human decisions ──────────────────────────────────

  /** Record an approval for a paused step and continue execution. */
  async approveStep(
    runId: string,
    userId: string,
    stepId: string,
    note?: string,
  ): Promise<AgentExecutionRun> {
    const run = this.getOwnedRun(runId, userId);
    this.assertGated(run);
    const pending = run.approvals.find(
      (a) => a.stepId === stepId && run.approvalDecisions.every((d) => d.stepId !== stepId),
    );
    if (!pending) {
      throw new ConflictError(`step ${stepId} is not awaiting approval on run ${runId}`);
    }
    run.approvalDecisions.push({
      approvalId: pending.approvalId,
      runId,
      stepId,
      decision: 'approved',
      note,
      decidedBy: userId,
      decidedAt: this.clock.now(),
    });
    this.store.save(run);
    const continued = await this.engine.resume(run);
    this.store.save(continued);
    return continued;
  }

  /** Record a rejection — the step fails and the goal is NOT achieved. */
  rejectStep(runId: string, userId: string, stepId: string, note?: string): AgentExecutionRun {
    const run = this.getOwnedRun(runId, userId);
    this.assertGated(run);
    const pending = run.approvals.find(
      (a) => a.stepId === stepId && run.approvalDecisions.every((d) => d.stepId !== stepId),
    );
    if (!pending) {
      throw new ConflictError(`step ${stepId} is not awaiting approval on run ${runId}`);
    }
    run.approvalDecisions.push({
      approvalId: pending.approvalId,
      runId,
      stepId,
      decision: 'rejected',
      note,
      decidedBy: userId,
      decidedAt: this.clock.now(),
    });
    const stepResult = run.stepResults.find((s) => s.stepId === stepId);
    if (stepResult) {
      stepResult.status = 'failed';
      stepResult.error = note ?? 'approval rejected by the user';
      stepResult.endedAt = this.clock.now();
    }
    run.outcome = 'FAILED';
    run.outcomeReasons.push(`approval rejected for step "${stepId}"`);
    run.error = note ?? 'approval rejected by the user';
    run.finishedAt = this.clock.now();
    run.state = 'FAILED_FINAL';
    run.stateHistory.push('FAILED_FINAL');
    run.updatedAt = this.clock.now();
    this.store.save(run);
    return run;
  }

  /** Cancel a paused (non-terminal) run. */
  cancel(runId: string, userId: string): AgentExecutionRun {
    const run = this.getOwnedRun(runId, userId);
    if (AGENT_TERMINAL_STATES.includes(run.state)) {
      throw new ConflictError(`run ${runId} is already in terminal state ${run.state}`);
    }
    run.state = 'CANCELLED';
    run.stateHistory.push('CANCELLED');
    run.outcomeReasons.push('cancelled by the user');
    run.finishedAt = this.clock.now();
    run.updatedAt = this.clock.now();
    this.store.save(run);
    return run;
  }

  // ── Reads (owner-scoped) ─────────────────────────────────────────

  status(runId: string, userId: string): AgentRunStatusDTO {
    const run = this.getOwnedRun(runId, userId);
    return {
      runId: run.runId,
      goalId: run.goalId,
      planId: run.planId,
      state: run.state,
      outcome: run.outcome,
      currentStepId: run.currentStepId,
      completedSteps: run.stepResults.filter((s) => s.status === 'completed').map((s) => s.stepId),
      blockedSteps: run.stepResults.filter((s) => s.status === 'blocked').map((s) => s.stepId),
      failedSteps: run.stepResults.filter((s) => s.status === 'failed').map((s) => s.stepId),
      waitingSteps: run.stepResults
        .filter((s) => s.status === 'waiting_approval' || s.status === 'running')
        .map((s) => s.stepId),
      usage: run.usage,
      validationIssueCount: run.validationIssues.length,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      finishedAt: run.finishedAt,
    };
  }

  /** Sanitized, correlated execution trace (no prompts, no secrets). */
  getTrace(runId: string, userId: string): AgentExecutionTraceRecord[] {
    const run = this.getOwnedRun(runId, userId);
    return buildExecutionTrace(run);
  }

  list(userId: string): AgentExecutionRun[] {
    return this.store.list(userId);
  }

  // ── Internal ─────────────────────────────────────────────────────

  private getOwnedRun(runId: string, userId: string): AgentExecutionRun {
    const run = this.store.get(runId);
    if (!run) {
      throw new NotFoundError('AgentExecutionRun', runId);
    }
    if (!ownsRun(run, userId)) {
      throw new NotFoundError('AgentExecutionRun', runId);
    }
    return run;
  }

  private assertGated(run: AgentExecutionRun): void {
    if (!APPROVAL_GATED_STATES.includes(run.state)) {
      throw new ConflictError(`run ${run.runId} is not waiting for approval (state: ${run.state})`);
    }
  }
}
