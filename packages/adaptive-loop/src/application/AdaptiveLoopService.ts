// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: Application Service
//
// The application seam for the frozen foundations. Given a goal + a READY
// plan (produced by the frozen planning boundary), it drives the adaptive
// engine and keeps runs resumable across approval gates.
//
//   plan (READY) → AdaptiveEngine → decision model consultation (optional)
//   → validated proposals → frozen execution ports → observations →
//   verification (frozen) → VERIFIED / COMPLETED / BLOCKED / FAILED_FINAL
//
// Approvals are explicit and recorded: approve()/reject() are the ONLY way
// a WAITING_FOR_APPROVAL run resumes. The model cannot approve itself.
// ──────────────────────────────────────────────────────────────────

import type { AgentPlan } from '@vedmoulya/agent-execution';
import type {
  AdaptiveApprovalStore,
  AdaptivePlannerPort,
  AdaptiveRunStore,
} from '../contracts/adaptive-loop-ports.js';
import type { AgentDecisionModelPort } from '../contracts/adaptive-loop-ports.js';
import { AdaptiveEngine } from '../domain/adaptive-engine.js';
import type { AdaptiveRun } from '../types/adaptive-loop-types.js';
import { InMemoryAdaptiveApprovalStore } from '../infrastructure/InMemoryAdaptiveApprovalStore.js';

export interface AdaptiveLoopServiceOptions {
  /** Decision model port (optional — deterministic CONTINUE when absent). */
  decisionModel?: AgentDecisionModelPort;
  /** Bounded replan through the frozen planning boundary (optional). */
  planner?: AdaptivePlannerPort;
  /** Explicit approval store (default: in-memory). */
  approvals?: AdaptiveApprovalStore;
  /** Run persistence for resume-after-approval (default: in-memory). */
  store?: AdaptiveRunStore;
  /** Persistent-clock override for tests. */
  clock?: { now(): string; timestampMs(): number };
  /** Ports required for actual execution (production wiring). */
  ports: {
    ai?: import('@vedmoulya/agent-execution').AgentAiExecutionPort;
    tools?: import('@vedmoulya/agent-execution').AgentToolExecutionPort;
    toolRegistry?: import('@vedmoulya/agent-execution').AgentToolRegistryPort;
    modelVerifier?: import('@vedmoulya/agent-execution').AgentModelVerifierPort;
  };
}

export interface AdaptiveRunInput {
  userId: string;
  goal: string;
  /** The READY plan from the frozen planning boundary. */
  plan: AgentPlan;
  goalId?: string;
  autonomyLevel?: 'ASSISTED' | 'SUPERVISED' | 'CONTROLLED_AUTONOMOUS';
  allowedTools?: string[];
  grantedPermissionClasses?: Array<
    'READ' | 'WRITE' | 'EXECUTE' | 'DELETE' | 'NETWORK' | 'SECRETS' | 'DEPLOYMENT'
  >;
  budget?: Record<string, number>;
  loopBudgets?: Record<string, number>;
}

export interface AdaptiveRunStatusDTO {
  runId: string;
  goal: string;
  state: AdaptiveRun['state'];
  stateHistory: AdaptiveRun['stateHistory'];
  outcome?: AdaptiveRun['outcome'];
  terminationReason?: AdaptiveRun['terminationReason'];
  error?: string;
  observationsCount: number;
  decisions: number;
  executedActions: number;
  stepStatus: AdaptiveRun['stepStatus'];
}

/** In-memory run registry keyed by runId. */
export class InMemoryAdaptiveRunStore implements AdaptiveRunStore {
  private readonly runs = new Map<string, AdaptiveRun>();
  save(run: AdaptiveRun): void {
    this.runs.set(run.runId, run);
  }
  get(runId: string): AdaptiveRun | undefined {
    return this.runs.get(runId);
  }
  list(ownerId?: string): AdaptiveRun[] {
    return [...this.runs.values()].filter((r) => ownerId === undefined || r.userId === ownerId);
  }
}

export class AdaptiveLoopService {
  private readonly engine: AdaptiveEngine;
  private readonly approvals: AdaptiveApprovalStore;
  private readonly store: AdaptiveRunStore;

  constructor(options: AdaptiveLoopServiceOptions) {
    this.approvals = options.approvals ?? new InMemoryAdaptiveApprovalStore();
    this.store = options.store ?? new InMemoryAdaptiveRunStore();
    const clock = options.clock ?? {
      now: (): string => new Date().toISOString(),
      timestampMs: (): number => Date.now(),
    };
    this.engine = new AdaptiveEngine({
      ai: options.ports.ai,
      tools: options.ports.tools,
      toolRegistry: options.ports.toolRegistry,
      modelVerifier: options.ports.modelVerifier,
      decisionModel: options.decisionModel,
      planner: options.planner,
      approvals: this.approvals,
      clock,
      onUpdate: (run): void => {
        this.store.save(run);
      },
    });
  }

  /** Start (or resume) an adaptive run. */
  async start(input: AdaptiveRunInput): Promise<AdaptiveRun> {
    const run = this.engine.createRun({
      ...input,
      planId: input.plan.planId,
      goalId: input.goalId ?? input.plan.goalId,
    });
    this.store.save(run);
    const finished = await this.engine.run(run);
    this.store.save(finished);
    return finished;
  }

  /** Approve the pending proposal of a WAITING_FOR_APPROVAL run. */
  async approve(runId: string, proposalId: string, actor: string): Promise<AdaptiveRun> {
    const run = this.getOwnedRun(runId, actor);
    const ok = this.approvals.approve(runId, proposalId, actor);
    if (!ok) {
      run.error = `no pending approval for proposal ${proposalId}`;
      return run;
    }
    const resumed = await this.engine.resume(run);
    this.store.save(resumed);
    return resumed;
  }

  /** Reject the pending proposal — the run fails honestly. */
  async reject(runId: string, proposalId: string, actor: string): Promise<AdaptiveRun> {
    const run = this.getOwnedRun(runId, actor);
    this.approvals.reject(runId, proposalId, actor);
    const resumed = await this.engine.resume(run);
    this.store.save(resumed);
    return resumed;
  }

  getRun(runId: string, ownerId?: string): AdaptiveRun | undefined {
    const run = this.store.get(runId);
    if (run === undefined) return undefined;
    if (ownerId !== undefined && run.userId !== ownerId) return undefined;
    return run;
  }

  listRuns(ownerId?: string): AdaptiveRun[] {
    return this.store.list(ownerId);
  }

  toDTO(run: AdaptiveRun): AdaptiveRunStatusDTO {
    return {
      runId: run.runId,
      goal: run.goal,
      state: run.state,
      stateHistory: run.stateHistory,
      outcome: run.outcome,
      terminationReason: run.terminationReason,
      error: run.error,
      observationsCount: run.observations.length,
      decisions: run.decisionRecords.length,
      executedActions: run.executedActions.length,
      stepStatus: run.stepStatus,
    };
  }

  private getOwnedRun(runId: string, actor: string): AdaptiveRun {
    const run = this.store.get(runId);
    if (run === undefined) {
      throw new Error(`run ${runId} not found`);
    }
    if (run.userId !== undefined && run.userId !== actor) {
      throw new Error(`user ${actor} does not own run ${runId}`);
    }
    return run;
  }
}
