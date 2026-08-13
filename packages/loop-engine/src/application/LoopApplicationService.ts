// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: Application Service
// EPIC-006 — Phase 14. The loop.* execution contract:
//   loop.start      — understand + plan, then execute bounded in background
//   loop.status     — status + budget snapshot
//   loop.getTrace   — full explainable execution trace
//   loop.cancel     — abort a running loop (explicit CANCELLED reason)
//   loop.resume     — continue a suspended run with user clarification
// Internal engine details are never exposed (Phase 14).
//
// Memory (Phase 9): proposedMemories are surfaced for user approval —
// this service NEVER writes to a Memory Engine automatically.
// ──────────────────────────────────────────────────────────────────

import {
  generateId,
  NotFoundError,
  ConflictError,
  NOOP_TELEMETRY,
  normalizeTraceStatus,
} from '@vedmoulya/core';
import type { TelemetryPort, TelemetrySpanHandle, TraceStatus } from '@vedmoulya/core';
import { LoopEngine } from '../domain/LoopEngine.js';
import { GoalUnderstandingService } from '../domain/GoalUnderstandingService.js';
import { TaskDecompositionService } from '../domain/TaskDecompositionService.js';
import { LoopMapper } from './LoopMapper.js';
import { InMemoryLoopRunStore, type LoopRunStore } from '../infrastructure/LoopRunStore.js';
import { SystemClock } from '../infrastructure/SystemClock.js';
import type { LoopEnginePorts } from '../contracts/loop-ports.js';
import type { LoopBudgetConfig, LoopRun, LoopRunStatus } from '../types/loop-types.js';
import type {
  LoopCancelResultDTO,
  LoopPatternDTO,
  LoopRunDTO,
  LoopRunSummaryDTO,
  LoopStartResultDTO,
  LoopStatusDTO,
} from './LoopDTO.js';

export interface LoopApplicationServiceOptions {
  specialist: LoopEnginePorts['specialist'];
  rag?: LoopEnginePorts['rag'];
  tools?: LoopEnginePorts['tools'];
  clock?: LoopEnginePorts['clock'];
  store?: LoopRunStore;
  /**
   * EPIC-012 — optional telemetry port. When provided, loop executions emit
   * correlated spans/events (loop.run root span, loop.step events, loop.resume
   * spans) into the ExecutionTrace spine. Defaults to a zero-overhead NOOP.
   */
  telemetry?: TelemetryPort;
}

export interface LoopStartInput {
  goal: string;
  userId: string;
  budgetOverride?: Partial<LoopBudgetConfig>;
  collection?: string;
}

const SUSPENDED: LoopRunStatus[] = ['suspended'];

export class LoopApplicationService {
  private readonly store: LoopRunStore;
  private readonly engine: LoopEngine;
  private readonly understanding = new GoalUnderstandingService();
  private readonly decomposer = new TaskDecompositionService();
  private readonly controllers = new Map<string, AbortController>();
  private readonly ports: LoopEnginePorts;
  private readonly telemetry: TelemetryPort;
  /** Open telemetry span per active run (ended on completion/cancel). */
  private readonly runSpans = new Map<string, TelemetrySpanHandle>();

  constructor(options: LoopApplicationServiceOptions) {
    this.telemetry = options.telemetry ?? NOOP_TELEMETRY;
    this.ports = {
      specialist: options.specialist,
      rag: options.rag,
      tools: options.tools,
      clock: options.clock ?? new SystemClock(),
    };
    this.store = options.store ?? new InMemoryLoopRunStore();
    this.engine = new LoopEngine({
      ...this.ports,
      onStep: ({ runId, userId, step }): void => {
        const run = this.store.get(runId);
        if (run && run.userId === userId) {
          // Step was already appended by the engine; refresh the snapshot.
          this.store.save(run);
        }
        // EPIC-012: emit a loop.step event onto the run's span.
        this.runSpans.get(runId)?.addEvent('loop.step', {
          capability: step.capability,
          provider: step.provider,
          iteration: step.iteration,
          status: step.status,
          tokens_total: step.tokens.total,
          cost_usd: step.costUsd,
        });
      },
      onRunUpdated: (run): void => {
        this.store.save(run);
      },
    });
  }

  /**
   * Start a loop run. Understands the goal, plans the task graph, persists
   * the pending run and executes it in the background (checkpointed after
   * every step, so status/getTrace work mid-run). Returns immediately.
   */
  start(input: LoopStartInput): LoopStartResultDTO {
    if (!input.goal.trim()) {
      throw new Error('goal is required');
    }
    const spec = this.understanding.derive(input.goal, {
      collection: input.collection,
      budget: input.budgetOverride,
    });
    const graph = this.decomposer.buildGraph(spec);
    const runId = `run-${generateId()}`;
    const controller = new AbortController();
    this.controllers.set(runId, controller);

    const now = this.ports.clock.now();
    const run: LoopRun = {
      runId,
      goalId: spec.goalId,
      userId: input.userId,
      goal: input.goal,
      specification: spec,
      graph,
      steps: [],
      budgetConfig: spec.budget,
      budgetUsage: {
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        costUsd: 0,
        latencyMs: 0,
        providerCalls: 0,
        toolCalls: 0,
        iterations: 0,
      },
      status: 'pending',
      evidenceStates: [],
      proposedMemories: [],
      createdAt: now,
      updatedAt: now,
    };
    this.store.save(run);

    // EPIC-012: open the loop.run span (ended by executeAsync / cancel).
    const span = this.telemetry.startSpan({
      name: 'loop.run',
      kind: 'engine',
      executionId: runId,
      userId: input.userId,
      attributes: { goal: input.goal.slice(0, 160) },
    });
    this.runSpans.set(runId, span);

    void this.executeAsync(runId, input, controller.signal, span);

    return LoopMapper.toStartResultDTO(run);
  }

  /** Map a loop termination reason / status onto the trace vocabulary. */
  private static traceStatusOf(run: LoopRun): TraceStatus {
    if (run.terminationReason) return normalizeTraceStatus(run.terminationReason);
    return normalizeTraceStatus(run.status);
  }

  /** Execute a started run in the background (checkpointed per step). */
  private async executeAsync(
    runId: string,
    input: LoopStartInput,
    signal: AbortSignal,
    span: TelemetrySpanHandle,
  ): Promise<void> {
    const pending = this.store.get(runId);
    if (!pending) return;
    pending.status = 'running';
    this.store.save(pending);
    try {
      const finished = await this.engine.run({
        goal: input.goal,
        userId: input.userId,
        specification: pending.specification,
        budgetOverride: input.budgetOverride,
        collection: input.collection,
        signal,
        runId,
      });
      this.store.save(finished);
      span.setAttribute('termination_reason', finished.terminationReason ?? finished.status);
      span.setAttribute('iterations', finished.budgetUsage.iterations);
      span.setAttribute('provider_calls', finished.budgetUsage.providerCalls);
      span.setAttribute('tokens_total', finished.budgetUsage.tokensTotal);
      span.setAttribute('cost_usd', finished.budgetUsage.costUsd);
      span.end(LoopApplicationService.traceStatusOf(finished));
    } catch (error) {
      const run = this.store.get(runId);
      if (run) {
        run.status = 'failed';
        run.error = error instanceof Error ? error.message : String(error);
        run.updatedAt = this.ports.clock.now();
        this.store.save(run);
      }
      span.end('FAILED', {
        code: 'LOOP_EXECUTION_FAILED',
        message: error instanceof Error ? error.message.slice(0, 300) : String(error),
      });
    } finally {
      this.controllers.delete(runId);
      this.runSpans.delete(runId);
    }
  }

  /**
   * Synchronous full run (deterministic tests + operator scripts). Executes
   * the loop end-to-end and returns the finished run.
   */
  async runSync(input: LoopStartInput): Promise<LoopRun> {
    return this.telemetry.withSpan(
      {
        name: 'loop.run_sync',
        kind: 'engine',
        executionId: `run-sync-${generateId()}`,
        userId: input.userId,
        attributes: { goal: input.goal.slice(0, 160) },
      },
      async (span) => {
        try {
          const finished = await this.engine.run({
            goal: input.goal,
            userId: input.userId,
            budgetOverride: input.budgetOverride,
            collection: input.collection,
          });
          span.setAttribute('termination_reason', finished.terminationReason ?? finished.status);
          span.setAttribute('iterations', finished.budgetUsage.iterations);
          span.setAttribute('tokens_total', finished.budgetUsage.tokensTotal);
          span.setAttribute('cost_usd', finished.budgetUsage.costUsd);
          span.end(LoopApplicationService.traceStatusOf(finished));
          return finished;
        } catch (error) {
          span.end('FAILED', {
            code: 'LOOP_EXECUTION_FAILED',
            message: error instanceof Error ? error.message.slice(0, 300) : String(error),
          });
          throw error;
        }
      },
    );
  }

  /** Resolve a run, enforcing the caller owns it (IDOR). */
  private getOwnedRun(runId: string, userId: string): LoopRun {
    const run = this.store.get(runId);
    if (!run) {
      throw new NotFoundError('LoopRun', runId);
    }
    if (run.userId !== userId) {
      throw new NotFoundError('LoopRun', runId);
    }
    return run;
  }

  status(runId: string, userId: string): LoopStatusDTO {
    return LoopMapper.toStatusDTO(this.getOwnedRun(runId, userId));
  }

  getTrace(runId: string, userId: string): LoopRunDTO {
    return LoopMapper.toRunDTO(this.getOwnedRun(runId, userId));
  }

  cancel(runId: string, userId: string): LoopCancelResultDTO {
    const run = this.getOwnedRun(runId, userId);
    const controller = this.controllers.get(runId);
    if (run.status === 'pending' || run.status === 'running') {
      controller?.abort();
      run.status = 'cancelled';
      run.terminationReason = 'CANCELLED';
      run.updatedAt = this.ports.clock.now();
      run.finishedAt = this.ports.clock.now();
      this.store.save(run);
      // EPIC-012: the cancel is a control-plane-visible trace outcome.
      this.runSpans.get(runId)?.end('USER_CANCELLED', {
        code: 'USER_CANCELLED',
        message: 'cancelled by user',
      });
      this.runSpans.delete(runId);
      return { runId, cancelled: true, status: 'cancelled' };
    }
    return { runId, cancelled: false, status: run.status };
  }

  /**
   * Resume a suspended run (USER_CLARIFICATION_REQUIRED) with the user's
   * clarification. The clarification is appended to the goal and the loop
   * re-executes under a fresh bounded budget — never silently unbounded.
   */
  async resume(runId: string, userId: string, clarification: string): Promise<LoopRunDTO> {
    const run = this.getOwnedRun(runId, userId);
    if (!SUSPENDED.includes(run.status)) {
      throw new ConflictError(`run ${runId} is not suspended (status: ${run.status})`);
    }
    if (!clarification.trim()) {
      throw new Error('clarification is required to resume');
    }
    const finished = await this.telemetry.withSpan(
      {
        name: 'loop.resume',
        kind: 'engine',
        executionId: run.runId,
        userId,
        attributes: { clarification: clarification.slice(0, 120) },
      },
      async () =>
        this.engine.run({
          goal: run.goal,
          userId,
          collection: run.specification.evidenceRequirements[0]?.collection,
          clarification,
          runId: run.runId,
        }),
    );
    // Preserve the same run identity (the run continues, it is not a new run).
    const continued: LoopRun = {
      ...finished,
      runId: run.runId,
      goalId: run.goalId,
      createdAt: run.createdAt,
    };
    this.store.save(continued);
    return LoopMapper.toRunDTO(continued);
  }

  listRuns(userId?: string): LoopRunSummaryDTO[] {
    return this.store.list(userId).map((run) => LoopMapper.toSummaryDTO(run));
  }

  listPatterns(): LoopPatternDTO[] {
    return LoopMapper.listPatterns();
  }
}
