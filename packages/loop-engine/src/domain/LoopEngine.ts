// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: the bounded orchestration loop
// EPIC-006 — Phases 4–8, 11–12.
//
//   PLAN → EXECUTE → OBSERVE → EVALUATE → CRITIQUE → REFINE →
//   RE-EXECUTE → VERIFY → COMPLETE
//
// Invariants (enforced by construction):
//   - ALWAYS bounded: iterations, tokens, cost, latency, provider calls
//     and tool calls are checked BEFORE the next call.
//   - Evidence-First: grounding-required tasks abstain (never fabricate)
//     via the frozen runtime; the critic maps evidence state to
//     retrieve/verify actions.
//   - Adaptive: the RefinementPlanner decides WHY another iteration is
//     needed — the loop never simply calls the same model repeatedly.
//   - Explicit termination: every run ends with a TerminationReason.
//   - Explainable: every step records WHO (specialist), WHY (selection),
//     HOW MUCH (tokens/cost/latency), WHAT (evidence state, critic,
//     refinement action).
//   - No direct provider calls: all AI goes through SpecialistExecutionPort.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import { CriticEvaluator } from './CriticEvaluator.js';
import { GoalUnderstandingService } from './GoalUnderstandingService.js';
import { LoopBudget } from './LoopBudget.js';
import { RefinementPlanner } from './RefinementPlanner.js';
import { TaskDecompositionService } from './TaskDecompositionService.js';
import type {
  LoopEnginePorts,
  SpecialistExecutionInput,
  SpecialistExecutionResult,
} from '../contracts/loop-ports.js';
import type {
  CriticAssessment,
  GoalSpecification,
  LoopBudgetConfig,
  LoopRun,
  LoopTask,
  LoopTaskGraph,
  LoopTraceStep,
  TerminationReason,
} from '../types/loop-types.js';
import { EMPTY_BUDGET_USAGE } from '../types/loop-types.js';

export interface LoopRunInput {
  goal: string;
  userId: string;
  /** Pre-derived specification (skips understanding). */
  specification?: GoalSpecification;
  /**
   * Pre-built task graph (EPIC-007: application-specific graphs built by
   * the Application Factory). When provided the engine executes THIS graph
   * instead of deriving one from the pattern templates — the bounded loop,
   * critic, planner, budget and termination contracts are identical.
   */
  graph?: LoopTaskGraph;
  budgetOverride?: Partial<LoopBudgetConfig>;
  collection?: string;
  /** Resume support: clarification appended to the goal (Phase 12/14). */
  clarification?: string;
  /** External cancellation (loop.cancel). */
  signal?: AbortSignal;
  /**
   * Stable run identity for checkpointed/async runs (the application service
   * persists the run under this id; the engine reuses it).
   */
  runId?: string;
}

interface TaskOutcome {
  reason?: TerminationReason;
  toolDenied?: boolean;
  toolFailed?: boolean;
  providerFailed?: boolean;
}

interface ExecutionContext {
  run: LoopRun;
  graph: LoopTaskGraph;
  budget: LoopBudget;
  spec: GoalSpecification;
  input: LoopRunInput;
  startedMs: number;
}

/** Absolute safety valve: no run can exceed (maxIterations + 2) × 24 waves. */
function maxLoopGuard(spec: GoalSpecification): number {
  return (spec.maxIterations + 2) * 24;
}

export class LoopEngine {
  private readonly understanding = new GoalUnderstandingService();
  private readonly decomposer = new TaskDecompositionService();
  private readonly critic = new CriticEvaluator();
  private readonly planner = new RefinementPlanner();
  private readonly ports: LoopEnginePorts;

  constructor(ports: LoopEnginePorts) {
    this.ports = ports;
  }

  /** Execute one bounded loop run. */
  async run(input: LoopRunInput): Promise<LoopRun> {
    const goalText = input.clarification
      ? `${input.goal}\n\nUser clarification: ${input.clarification}`
      : input.goal;
    const spec = this.resolveSpec(input, goalText);
    const graph = input.graph ?? this.decomposer.buildGraph(spec);
    const runId = input.runId ?? `run-${generateId()}`;
    const startedMs = this.ports.clock.timestampMs();
    const now = this.ports.clock.now();
    const budget = new LoopBudget(spec.budget, EMPTY_BUDGET_USAGE);

    const run: LoopRun = {
      runId,
      goalId: spec.goalId,
      userId: input.userId,
      goal: input.goal,
      specification: spec,
      graph,
      steps: [],
      budgetConfig: spec.budget,
      budgetUsage: budget.snapshot(),
      status: 'running',
      evidenceStates: [],
      proposedMemories: [],
      createdAt: now,
      updatedAt: now,
    };

    const ctx: ExecutionContext = { run, graph, budget, spec, input, startedMs };

    // Phase 7/12: underspecified goals never get guessed — suspend for the
    // user's clarification (loop.resume continues with a fresh bounded budget).
    if (spec.clarificationNeeded) {
      run.status = 'suspended';
      run.terminationReason = 'USER_CLARIFICATION_REQUIRED';
      run.finalContent = `Clarification required: ${spec.clarificationNeeded.reason}`;
      run.finalCritic = {
        verdict: 'ABSTAIN',
        score: 0,
        checks: [
          {
            name: 'requirement',
            passed: false,
            detail: spec.clarificationNeeded.reason,
            severity: 'critical',
          },
        ],
        reasons: [spec.clarificationNeeded.reason],
      };
      run.updatedAt = this.ports.clock.now();
      run.finishedAt = this.ports.clock.now();
      this.ports.onRunUpdated?.(run);
      return run;
    }

    let finalContent = '';
    let finalCritic: CriticAssessment | undefined;
    let terminationReason: TerminationReason | undefined;
    let runStatus: LoopRun['status'] = 'completed';
    let guard = 0;
    const maxGuard = maxLoopGuard(spec);

    // Grounding is derived from the graph, NOT hardcoded: a pattern is
    // grounding-required only when at least one task actually carries an
    // evidenceRequirement with groundingRequired (e.g. the ABAP/generic
    // retrieve tasks). Evidence-less patterns (app-builder, ai-app-builder)
    // must never be forced to ABSTAIN for missing evidence that the graph
    // never requested — through the real runtime their specialist calls are
    // ungrounded and report no evidence state at all.
    const groundingRequired = graph.tasks.some(
      (t) => t.evidenceRequirement?.groundingRequired === true,
    );

    while (guard < maxGuard) {
      guard += 1;

      // 0. Cancellation.
      if (input.signal?.aborted) {
        terminationReason = 'CANCELLED';
        runStatus = 'cancelled';
        break;
      }

      // 1. Iteration + wall-clock budget gate (checked BEFORE iterating).
      const wallMs = this.ports.clock.timestampMs() - startedMs;
      budget.recordWallLatency(wallMs);
      const iterationCheck = budget.canStartIteration(wallMs);
      if (!iterationCheck.ok) {
        terminationReason = iterationCheck.reason;
        break;
      }
      budget.recordIteration();

      // 2. EXECUTE: run every pending task wave (dependencies respected).
      const outcome = await this.executePendingTasks(ctx);
      if (outcome.reason) {
        terminationReason = outcome.reason;
        break;
      }

      // 3. OBSERVE + EVALUATE: synthesize the current answer and critique it.
      finalContent = this.synthesize(graph);
      finalCritic = this.critic.evaluate({
        output: finalContent,
        successCriteria: spec.successCriteria,
        evidenceState: run.evidenceStates[run.evidenceStates.length - 1],
        groundingRequired,
        format: 'text',
        maxOutputTokens: spec.budget.maxTokens,
        toolDenied: outcome.toolDenied,
      });
      run.finalCritic = finalCritic;

      // 4. CRITIQUE → REFINE (adaptive, Phase 7).
      const decision = this.planner.decide({
        critic: finalCritic,
        evidenceStates: run.evidenceStates,
        usage: budget.snapshot(),
        maxIterations: spec.maxIterations,
        groundingRequired,
        toolDenied: outcome.toolDenied,
        toolFailed: outcome.toolFailed,
        providerFailed: outcome.providerFailed,
      });

      // 5. VERIFY → COMPLETE, or continue bounded.
      if (decision.action === 'finish') {
        terminationReason = 'SUCCESS';
        break;
      }
      if (decision.action === 'clarification_required') {
        terminationReason = 'USER_CLARIFICATION_REQUIRED';
        runStatus = 'suspended';
        this.tagLastStep(run, decision.action, decision.reason);
        break;
      }
      if (decision.action === 'stop') {
        terminationReason = decision.terminationReason ?? 'VALIDATION_FAILURE';
        this.tagLastStep(run, decision.action, decision.reason);
        break;
      }

      // RE-EXECUTE: insert the adaptive task for the next iteration.
      const inserted = this.decomposer.applyRefinement(graph, spec, decision);
      this.tagLastStep(run, decision.action, decision.reason);
      if (!inserted) {
        terminationReason = decision.terminationReason ?? 'VALIDATION_FAILURE';
        break;
      }
    }

    if (guard >= maxGuard) {
      terminationReason = 'ITERATION_LIMIT';
    }

    run.finalContent = finalContent;
    run.finalCritic = finalCritic;
    run.terminationReason = terminationReason;
    run.status = runStatus;
    run.budgetUsage = budget.snapshot();
    run.updatedAt = this.ports.clock.now();
    if (terminationReason) {
      run.finishedAt = this.ports.clock.now();
    }

    // Phase 9 — memory: NEVER auto-persist. Only durable, high-confidence,
    // final results are proposed for user approval (after the run fields are
    // finalized, so the proposal reads the real outcome).
    run.proposedMemories = this.proposeMemories(run, finalCritic);

    this.ports.onRunUpdated?.(run);
    return run;
  }

  /** Apply budget overrides on top of the derived (or supplied) spec. */
  private resolveSpec(input: LoopRunInput, goalText: string): GoalSpecification {
    const derived = this.understanding.derive(goalText, {
      collection: input.collection,
      budget: input.budgetOverride,
    });
    if (!input.specification) return derived;
    const budget: LoopBudgetConfig = { ...derived.budget, ...input.budgetOverride };
    return { ...input.specification, budget, maxIterations: budget.maxIterations };
  }

  /** Execute all pending task waves (sequential tasks in order; parallel
   *  groups concurrently, bounded by the wave structure). */
  private async executePendingTasks(ctx: ExecutionContext): Promise<TaskOutcome> {
    const { graph } = ctx;
    const waves = this.decomposer.computeWaves(graph);
    if (waves.length === 0) {
      // Nothing pending (all completed/failed) and no refinement inserted —
      // the critic will decide, but a graph with no pending work cannot
      // produce more; the outer loop terminates explicitly.
      return { reason: 'VALIDATION_FAILURE' };
    }

    for (const waveIds of waves) {
      const waveTasks = waveIds
        .map((id) => graph.tasks.find((t) => t.taskId === id))
        .filter((t): t is LoopTask => t !== undefined && t.status === 'pending');

      // Deterministic ordering: sequential tasks first (by declaration
      // order), then the parallel group of this wave.
      const sequential = waveTasks
        .filter((t) => !t.parallelEligible)
        .sort((a, b) => a.order - b.order);
      const parallel = waveTasks.filter((t) => t.parallelEligible);

      for (const task of sequential) {
        const outcome = await this.executeTask(task, ctx);
        if (outcome.reason) return outcome;
      }
      if (parallel.length > 0) {
        const outcomes = await Promise.all(parallel.map((task) => this.executeTask(task, ctx)));
        const failed = outcomes.find((o) => o.reason !== undefined);
        if (failed) return failed;
      }
    }
    return {};
  }

  /** Execute one task: tools → specialist (retry) → accounting → trace. */
  private async executeTask(task: LoopTask, ctx: ExecutionContext): Promise<TaskOutcome> {
    task.status = 'running';
    const startedAt = this.ports.clock.now();
    const taskStartMs = this.ports.clock.timestampMs();
    const baseOutcome: TaskOutcome = {};

    // ── Tools (Phase 10): allowlist, security chain, bounded count.
    let toolCalls = 0;
    if (this.ports.tools && task.allowedTools.length > 0) {
      for (const toolName of task.allowedTools) {
        const toolCheck = ctx.budget.canCallTool();
        if (!toolCheck.ok) {
          return this.failTask(task, ctx, startedAt, toolCalls, baseOutcome, {
            reason: 'BUDGET_EXCEEDED',
            message: toolCheck.detail ?? 'tool-call budget exhausted',
            status: 'blocked',
          });
        }
        ctx.budget.recordToolCall();
        toolCalls += 1;
        try {
          const result = await this.ports.tools.execute({
            toolName,
            arguments: task.toolArguments?.[toolName] ?? {},
            userId: ctx.input.userId,
          });
          if (result.denied) {
            return this.failTask(
              task,
              ctx,
              startedAt,
              toolCalls,
              { ...baseOutcome, toolDenied: true },
              {
                reason: 'SECURITY_BLOCK',
                message: `tool "${toolName}" was denied by the security policy`,
                status: 'blocked',
              },
            );
          }
          if (!result.ok) {
            return this.failTask(
              task,
              ctx,
              startedAt,
              toolCalls,
              { ...baseOutcome, toolFailed: true },
              {
                reason: 'TOOL_FAILURE',
                message: `tool "${toolName}" failed: ${result.error ?? result.outcome}`,
                status: 'failed',
              },
            );
          }
        } catch (error) {
          return this.failTask(
            task,
            ctx,
            startedAt,
            toolCalls,
            { ...baseOutcome, toolFailed: true },
            {
              reason: 'TOOL_FAILURE',
              message: error instanceof Error ? error.message : String(error),
              status: 'failed',
            },
          );
        }
      }
    }

    // ── Specialist (Phase 3): through the AI runtime, with retry policy.
    const maxRetries = task.retryPolicy.maxRetries;
    let lastResult: SpecialistExecutionResult | undefined;
    let attempts = 0;
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const providerCheck = ctx.budget.canCallProvider();
      if (!providerCheck.ok) {
        return this.failTask(task, ctx, startedAt, toolCalls, baseOutcome, {
          reason: 'BUDGET_EXCEEDED',
          message: providerCheck.detail ?? 'provider-call budget exhausted',
          status: 'blocked',
        });
      }
      attempts += 1;
      try {
        const specialistInput = this.buildSpecialistInput(task, ctx);
        lastResult = await this.ports.specialist.execute(specialistInput);
        ctx.budget.recordSpecialist({
          tokens: lastResult.tokens,
          costUsd: lastResult.costUsd,
          latencyMs: lastResult.latencyMs,
        });
        break;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await this.ports.clock.sleep(task.retryPolicy.retryDelayMs * (attempt + 1));
          continue;
        }
        return this.failTask(
          task,
          ctx,
          startedAt,
          toolCalls,
          { ...baseOutcome, providerFailed: true },
          {
            reason: 'PROVIDER_FAILURE',
            message: error instanceof Error ? error.message : String(error),
            status: 'failed',
            retried: attempt > 0,
          },
        );
      }
    }

    if (!lastResult) {
      return this.failTask(
        task,
        ctx,
        startedAt,
        toolCalls,
        { ...baseOutcome, providerFailed: true },
        {
          reason: 'PROVIDER_FAILURE',
          message: lastError instanceof Error ? lastError.message : 'specialist produced no result',
          status: 'failed',
          retried: true,
        },
      );
    }

    // ── Post-execution accounting (Phase 8): tokens/cost/latency bounds.
    const postCheck = ctx.budget.exceededAfter();
    if (!postCheck.ok) {
      return this.failTask(task, ctx, startedAt, toolCalls, baseOutcome, {
        reason: 'BUDGET_EXCEEDED',
        message: postCheck.detail ?? 'cumulative budget exceeded',
        status: 'blocked',
      });
    }
    const wallMs = this.ports.clock.timestampMs() - ctx.startedMs;
    ctx.budget.recordWallLatency(wallMs);
    if (wallMs > ctx.spec.budget.maxLatencyMs) {
      return this.failTask(task, ctx, startedAt, toolCalls, baseOutcome, {
        reason: 'TIMEOUT',
        message: `wall-clock budget exceeded (${String(wallMs)}ms)`,
        status: 'blocked',
      });
    }
    const taskElapsedMs = this.ports.clock.timestampMs() - taskStartMs;
    if (task.budget.timeoutMs !== undefined && taskElapsedMs > task.budget.timeoutMs) {
      return this.failTask(task, ctx, startedAt, toolCalls, baseOutcome, {
        reason: 'TIMEOUT',
        message: `task ${task.taskId} timed out after ${String(taskElapsedMs)}ms`,
        status: 'failed',
      });
    }

    // ── Success: record result + evidence state + trace step.
    task.status = 'completed';
    task.result = {
      content: lastResult.content,
      provider: lastResult.provider,
      model: lastResult.model,
      tokens: lastResult.tokens,
      costUsd: lastResult.costUsd,
      latencyMs: lastResult.latencyMs,
      abstained: lastResult.abstained,
      evidenceState: lastResult.evidenceState,
      selectionExplanation: lastResult.selectionExplanation,
      validationDecision: lastResult.validationDecision,
      attempts,
      fallbackUsed: false,
    };
    if (lastResult.evidenceState) {
      ctx.run.evidenceStates.push(lastResult.evidenceState);
    }

    const step: LoopTraceStep = {
      iteration: ctx.budget.snapshot().iterations,
      taskId: task.taskId,
      title: task.title,
      capability: task.capability,
      provider: lastResult.provider,
      model: lastResult.model,
      selectionReason:
        lastResult.selectionExplanation ??
        `runtime selected ${lastResult.provider}/${lastResult.model} for capability ${task.capability}`,
      tokens: lastResult.tokens,
      costUsd: lastResult.costUsd,
      latencyMs: lastResult.latencyMs,
      evidenceState: lastResult.evidenceState,
      toolCalls,
      critic: undefined,
      retried: attempts > 1,
      fallbackUsed: false,
      status: lastResult.abstained ? 'abstained' : 'completed',
      message: lastResult.abstained
        ? `Abstained: ${lastResult.evidenceState ?? 'insufficient evidence'}`
        : `Completed via ${lastResult.provider}/${lastResult.model}`,
      startedAt,
      endedAt: this.ports.clock.now(),
    };
    ctx.run.steps.push(step);
    ctx.run.budgetUsage = ctx.budget.snapshot();
    ctx.run.updatedAt = this.ports.clock.now();
    this.ports.onStep?.({ runId: ctx.run.runId, userId: ctx.run.userId, step });
    return baseOutcome;
  }

  /** Record a failed/blocked task with an explicit trace step. */
  private failTask(
    task: LoopTask,
    ctx: ExecutionContext,
    startedAt: string,
    toolCalls: number,
    outcome: TaskOutcome,
    failure: {
      reason: TerminationReason;
      message: string;
      status: LoopTraceStep['status'];
      retried?: boolean;
    },
  ): TaskOutcome {
    task.status = 'failed';
    task.error = failure.message;
    const step: LoopTraceStep = {
      iteration: ctx.budget.snapshot().iterations,
      taskId: task.taskId,
      title: task.title,
      capability: task.capability,
      provider: 'none',
      model: 'none',
      selectionReason: 'execution failed before a specialist selection was recorded',
      tokens: { input: 0, output: 0, total: 0 },
      costUsd: 0,
      latencyMs: 0,
      toolCalls,
      status: failure.status,
      retried: failure.retried === true,
      fallbackUsed: false,
      message: failure.message,
      startedAt,
      endedAt: this.ports.clock.now(),
    };
    ctx.run.steps.push(step);
    ctx.run.budgetUsage = ctx.budget.snapshot();
    ctx.run.updatedAt = this.ports.clock.now();
    this.ports.onStep?.({ runId: ctx.run.runId, userId: ctx.run.userId, step });
    return { ...outcome, reason: failure.reason };
  }

  /** Compose the specialist input for a task (dependency slots + evidence). */
  private buildSpecialistInput(task: LoopTask, ctx: ExecutionContext): SpecialistExecutionInput {
    const byId = new Map(ctx.graph.tasks.map((t) => [t.taskId, t]));
    const slots: Record<string, string> = {};
    for (const depId of task.dependencies) {
      const dep = byId.get(depId);
      if (dep?.result?.content && dep.slot) {
        slots[dep.slot] = dep.result.content.slice(0, 8_000);
      }
    }
    // Evidence context: the most recent retrieval task output becomes the
    // knowledge context for downstream tasks (minimum necessary context).
    const evidenceTask = [...ctx.graph.tasks]
      .filter((t) => t.phase === 'retrieve' && t.result?.content)
      .sort((a, b) => b.order - a.order)[0];

    let prompt = task.input.replaceAll('{goal}', ctx.spec.rawGoal);
    for (const [key, value] of Object.entries(slots)) {
      if (value) prompt = prompt.replaceAll(`{${key}}`, value);
    }

    return {
      taskId: task.taskId,
      capability: task.capability,
      qualityTier: task.qualityTier,
      userInput: prompt,
      systemPrompt:
        'You are a VedMoulya AI specialist. Produce the requested deliverable precisely. Do not fabricate information: if you cannot answer confidently, say so and request more evidence.',
      context: evidenceTask?.result?.content
        ? { knowledgeContext: evidenceTask.result.content.slice(0, 12_000) }
        : undefined,
      constraints: {
        maxOutputTokens: task.budget.maxTokens,
        maxLatencyMs: task.budget.timeoutMs,
      },
      ragQuery: task.evidenceRequirement
        ? {
            collection: task.evidenceRequirement.collection,
            query: task.evidenceRequirement.query,
            topK: task.evidenceRequirement.topK ?? 5,
          }
        : undefined,
      groundingRequired: task.evidenceRequirement?.groundingRequired,
      enableOptimization: true,
      userId: ctx.input.userId,
    };
  }

  /** Synthesize the current answer from all completed task outputs. */
  private synthesize(graph: LoopTaskGraph): string {
    return graph.tasks
      .filter((t) => t.status === 'completed' && t.result?.content)
      .sort((a, b) => a.order - b.order)
      .map((t) => `## ${t.title}\n${t.result?.content ?? ''}`)
      .join('\n\n');
  }

  /** Tag the last trace step with the refinement action + reason. */
  private tagLastStep(run: LoopRun, action: string, reason: string): void {
    const last = run.steps[run.steps.length - 1];
    if (last) {
      last.refinementAction = action;
      if (!last.critic && run.finalCritic) last.critic = run.finalCritic;
      last.message = `${last.message} — refinement: ${reason}`;
    }
    run.updatedAt = this.ports.clock.now();
    this.ports.onRunUpdated?.(run);
  }

  /**
   * Phase 9 — memory policy. NEVER write intermediate results to long-term
   * memory automatically. Only a successful final result is proposed as
   * durable memory, and it still requires explicit user approval before any
   * Memory Engine write (enforced by the application layer: proposedMemories
   * are surfaced to the UI, never auto-persisted).
   */
  private proposeMemories(
    run: LoopRun,
    critic: CriticAssessment | undefined,
  ): LoopRun['proposedMemories'] {
    if (run.terminationReason !== 'SUCCESS' || !critic || critic.verdict !== 'PASS') {
      return [];
    }
    const content = run.finalContent ? run.finalContent.slice(0, 2_000) : '';
    if (!content) return [];
    return [
      {
        type: 'goal_outcome',
        content: `Completed goal "${run.goal}" (run ${run.runId}). Outcome: ${content}`,
        source: 'loop-engine',
      },
    ];
  }
}
