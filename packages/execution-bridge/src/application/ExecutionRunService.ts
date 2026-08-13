// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Execution Run Service
// EPIC-014 — the capability execution engine (PLAN → EXECUTE → VERIFY).
//
//   FactoryCapabilityPlan
//     → validate plan (resolver dispositions)
//     → resolve executable steps (only EXECUTABLE may run)
//     → check dependencies + budget + approval (pre-verify)
//     → execute through the frozen runtime port (bounded, retried)
//     → verify output (EXECUTION + OUTPUT + VALIDATION)
//     → persist checkpoint
//     → continue / human hand-off / resume / final result
//
// Every method is owner-scoped. Never: false COMPLETED, silent provider
// replacement, budget/approval bypass, endless retry, manual/external
// execution, IDOR.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type { FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';
import type {
  ExecutionRun,
  ExecutionState,
  StepDisposition,
  StepRun,
} from '../types/execution-types.js';
import type {
  ClockPort,
  ExecutionBudgetConfig,
  ExecutionRunStore,
  PreferenceLedgerPort,
  StepExecutionPort,
} from '../contracts/execution-ports.js';
import type { ArtifactReaderPort } from '../contracts/artifact-ports.js';
import type { ArtifactExpectation } from '../types/artifact-types.js';
import { PlanRunResolver } from '../domain/PlanRunResolver.js';
import type { StepResolution } from '../domain/PlanRunResolver.js';
import { StepVerifier } from '../domain/StepVerifier.js';
import { ApprovalRuntime } from '../domain/ApprovalRuntime.js';
import { RunIntelligenceView } from '../domain/RunIntelligence.js';
import { PreferenceLedger } from '../domain/PreferenceLedger.js';
import { RunBudgetGuard } from '../domain/RunBudgetGuard.js';
import { mapCapability } from '../domain/CapabilityMapper.js';

export interface PlanSource {
  getPlan(ownerId: string, planId: string): Promise<FactoryCapabilityPlan | undefined>;
}

export interface ExecutionRunServiceOptions {
  planSource: PlanSource;
  port: StepExecutionPort;
  store: ExecutionRunStore;
  ledger: PreferenceLedgerPort;
  budget: ExecutionBudgetConfig;
  clock: ClockPort;
  traceId?: () => string;
  /** Bounded retries per executable step (never endless). */
  maxRetries?: number;
  /**
   * SPRINT-024 — optional REAL runtime artifact verification. When BOTH are
   * supplied, every successfully executed step's post-verification ALSO
   * inspects the real artifact through the root-confined reader — the step
   * completes only when the execution contract AND the real artifact verify.
   * Absent either option, the run behaves exactly as before (text-only).
   */
  artifactReader?: ArtifactReaderPort;
  artifactExpectations?: (run: ExecutionRun, step: StepRun) => ArtifactExpectation[];
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ExecutionRunService {
  private readonly resolver = new PlanRunResolver();
  private readonly verifier = new StepVerifier();
  private readonly approvals = new ApprovalRuntime();
  private readonly intelligenceView = new RunIntelligenceView();
  private readonly planSource: PlanSource;
  private readonly port: StepExecutionPort;
  private readonly store: ExecutionRunStore;
  private readonly ledger: PreferenceLedger;
  private readonly budgetConfig: ExecutionBudgetConfig;
  private readonly clock: ClockPort;
  private readonly traceId: () => string;
  private readonly maxRetries: number;
  private readonly artifactReader?: ArtifactReaderPort;
  private readonly artifactExpectations?: (
    run: ExecutionRun,
    step: StepRun,
  ) => ArtifactExpectation[];

  constructor(options: ExecutionRunServiceOptions) {
    this.planSource = options.planSource;
    this.port = options.port;
    this.store = options.store;
    this.ledger = new PreferenceLedger(options.ledger, () => this.clock.now());
    this.budgetConfig = options.budget;
    this.clock = options.clock;
    this.traceId = options.traceId ?? ((): string => `exec-${generateId()}`);
    this.maxRetries = options.maxRetries ?? 1;
    this.artifactReader = options.artifactReader;
    this.artifactExpectations = options.artifactExpectations;
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /** Create a run from a REAL plan and advance as far as possible. */
  async start(ownerId: string, planId: string): Promise<ServiceResult<ExecutionRun>> {
    const plan = await this.planSource.getPlan(ownerId, planId);
    if (!plan) {
      return { success: false, error: `Plan not found: ${planId}` };
    }

    const resolutions = this.resolver.resolve(plan);
    const now = this.clock.now();

    const run: ExecutionRun = {
      executionId: `exec-${generateId()}`,
      planId: plan.id,
      ownerId,
      traceId: this.traceId(),
      goal: plan.requestedOutcome,
      status: 'READY',
      steps: resolutions.map((resolution) => this.stepFromResolution(resolution, now)),
      checkpoints: [],
      handoffs: [],
      budget: {
        maxIterations: this.budgetConfig.maxIterations,
        maxTokens: this.budgetConfig.maxTokens,
        maxCostUsd: this.budgetConfig.maxCostUsd,
        maxLatencyMs: this.budgetConfig.maxLatencyMs,
        spentTokens: 0,
        spentCostUsd: 0,
        spentLatencyMs: 0,
        iterations: 0,
        exceeded: false,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.store.save(run);
    return this.advance(run);
  }

  // ── Approval (Phase 3) ───────────────────────────────────────────

  async approve(
    ownerId: string,
    executionId: string,
    stepId: string,
    note?: string,
  ): Promise<ServiceResult<ExecutionRun>> {
    return this.decideApproval(ownerId, executionId, stepId, 'approved', note);
  }

  async reject(
    ownerId: string,
    executionId: string,
    stepId: string,
    note?: string,
  ): Promise<ServiceResult<ExecutionRun>> {
    return this.decideApproval(ownerId, executionId, stepId, 'rejected', note);
  }

  // ── Hand-off (Phase 3) ───────────────────────────────────────────

  /**
   * The user performed the manual/configure step — record it honestly
   * and resume from the checkpoint.
   */
  async completeHandoff(
    ownerId: string,
    executionId: string,
    stepId: string,
    note?: string,
  ): Promise<ServiceResult<ExecutionRun>> {
    const run = this.store.get(executionId);
    if (!run) return { success: false, error: `Execution not found: ${executionId}` };
    if (run.ownerId !== ownerId)
      return { success: false, error: 'Not your execution (IDOR refused).' };

    const step = run.steps.find((s) => s.stepId === stepId);
    if (!step) return { success: false, error: `Step not found: ${stepId}` };
    const handoff = run.handoffs.find((h) => h.stepId === stepId);
    if (!handoff) return { success: false, error: `No hand-off recorded for step: ${stepId}` };
    // Re-entry guard: a completed hand-off can never be completed twice —
    // otherwise a CONFIGURE hand-off could revert an executed step to 'ready'
    // and re-execute it (duplicate provider cost).
    if (handoff.completed) {
      return { success: false, error: `Hand-off for '${step.title}' is already completed.` };
    }
    // Belt-and-braces: never re-run a step that already executed.
    if (step.state === 'completed' || step.state === 'running') {
      return { success: false, error: `Step '${step.title}' already executed — no second run.` };
    }
    if (handoff.kind === 'UNAVAILABLE') {
      return {
        success: false,
        error: `Step ${step.title} is unavailable — it cannot be completed by hand-off.`,
      };
    }

    handoff.completed = true;
    handoff.completedAt = this.clock.now();
    if (handoff.kind === 'CONFIGURE') {
      // The user configured the provider — resume EXECUTES this step now
      // (pre-verification re-checks availability before any call).
      step.disposition = 'EXECUTABLE';
      step.state = 'ready';
    } else {
      step.state = 'completed';
      step.output = note ? `Completed manually: ${note}` : 'Completed manually by the user.';
      step.endedAt = this.clock.now();
    }
    step.updatedAt = this.clock.now();
    run.status = 'RUNNING';
    run.updatedAt = this.clock.now();
    this.persistCheckpoint(run);
    this.store.save(run);
    return this.advance(run);
  }

  // ── Control ──────────────────────────────────────────────────────

  cancel(ownerId: string, executionId: string): ServiceResult<ExecutionRun> {
    const run = this.store.get(executionId);
    if (!run) return { success: false, error: `Execution not found: ${executionId}` };
    if (run.ownerId !== ownerId)
      return { success: false, error: 'Not your execution (IDOR refused).' };
    run.status = 'CANCELLED';
    run.updatedAt = this.clock.now();
    run.finishedAt = this.clock.now();
    this.store.save(run);
    return { success: true, data: run };
  }

  // ── Reads (owner-scoped) ─────────────────────────────────────────

  get(ownerId: string, executionId: string): ServiceResult<ExecutionRun> {
    const run = this.store.get(executionId);
    if (!run) return { success: false, error: `Execution not found: ${executionId}` };
    if (run.ownerId !== ownerId)
      return { success: false, error: 'Not your execution (IDOR refused).' };
    return { success: true, data: run };
  }

  list(ownerId: string): ServiceResult<ExecutionRun[]> {
    return { success: true, data: this.store.list(ownerId) };
  }

  /** Phase 5 — preference events, owner-scoped (only the caller's runs). */
  preferenceLedger(ownerId: string, executionId?: string): ServiceResult<unknown[]> {
    const owned = new Set(this.store.list(ownerId).map((r) => r.executionId));
    const events = this.ledger.list(executionId);
    return { success: true, data: events.filter((e) => owned.has(e.executionId)) };
  }

  intelligence(run: ExecutionRun): ReturnType<RunIntelligenceView['derive']> {
    return this.intelligenceView.derive(run);
  }

  // ── Internal ─────────────────────────────────────────────────────

  private stepFromResolution(resolution: StepResolution, now: string): StepRun {
    const state = (disposition: StepDisposition): StepRun['state'] => {
      switch (disposition) {
        case 'EXECUTABLE':
          return 'ready';
        case 'CONFIGURE':
          return 'configure_required';
        case 'WAITING_FOR_APPROVAL':
          return 'waiting_approval';
        case 'MANUAL_REQUIRED':
          return 'manual_required';
        default:
          return 'skipped';
      }
    };
    return {
      stepId: resolution.stepId,
      title: resolution.title,
      capability: resolution.capability,
      disposition: resolution.disposition,
      state: state(resolution.disposition),
      provider: resolution.provider,
      model: resolution.model,
      artifacts: [],
      attempts: 0,
      retried: false,
      costUsd: 0,
      tokensUsed: 0,
      latencyMs: 0,
      updatedAt: now,
    };
  }

  /**
   * Drive the run forward until it finishes, hits a gate (approval /
   * manual / configure), is blocked (budget/dependency) or fails.
   */
  private async advance(run: ExecutionRun): Promise<ServiceResult<ExecutionRun>> {
    const plan = await this.planSource.getPlan(run.ownerId, run.planId);
    if (!plan) {
      run.status = 'BLOCKED';
      run.updatedAt = this.clock.now();
      run.finishedAt = this.clock.now();
      this.store.save(run);
      return { success: false, error: `Plan not found: ${run.planId}` };
    }

    // Rebuild the guard from the run's persisted accounting so hard limits
    // (iterations / tokens / cost / latency) are preserved across resume
    // passes — a resumed run can never exceed its run-level budget.
    const budgetGuard = new RunBudgetGuard(run.budget, () => this.clock.timestampMs(), {
      iterations: run.budget.iterations,
      providerCalls: run.budget.iterations,
      tokensTotal: run.budget.spentTokens,
      costUsd: run.budget.spentCostUsd,
      latencyMs: run.budget.spentLatencyMs,
    });

    run.status = 'RUNNING';
    run.updatedAt = this.clock.now();
    this.store.save(run);

    for (let i = 0; i < run.steps.length; i++) {
      // eslint-disable-next-line security/detect-object-injection -- Array index access (run.steps is a plain array; i is the loop counter, never user-controlled).
      const step = run.steps[i];
      if (!step || step.state === 'completed' || step.state === 'skipped') continue;

      if (step.disposition === 'EXECUTABLE') {
        if (!this.dependenciesMet(run, i)) {
          step.state = 'blocked';
          step.failureReason =
            'A required earlier step was not completed — downstream execution is blocked.';
          step.updatedAt = this.clock.now();
          run.status = 'BLOCKED';
          run.updatedAt = this.clock.now();
          run.finishedAt = this.clock.now();
          this.store.save(run);
          return { success: true, data: run };
        }
        const executed = await this.executeStep(run, plan, step, budgetGuard);
        if (!executed) {
          this.store.save(run);
          return { success: true, data: run };
        }
        this.persistCheckpoint(run);
        this.store.save(run);
        continue;
      }

      if (step.disposition === 'UNAVAILABLE') {
        step.state = 'skipped';
        step.updatedAt = this.clock.now();
        continue;
      }

      // Gate: approval / manual / configure — stop here, honest hand-off.
      // Hand-offs are recorded ONCE per step (a resumed run already has one).
      if (!run.handoffs.some((h) => h.stepId === step.stepId)) {
        switch (step.disposition) {
          case 'WAITING_FOR_APPROVAL':
            step.state = 'waiting_approval';
            this.recordApprovalHandoff(run, step, plan);
            break;
          case 'CONFIGURE':
            step.state = 'configure_required';
            this.recordConfigureHandoff(run, step);
            break;
          case 'MANUAL_REQUIRED':
            step.state = 'manual_required';
            this.recordManualHandoff(run, step, plan);
            break;
          default:
            break; // EXECUTABLE / UNAVAILABLE — handled above by the caller
        }
      }
      step.updatedAt = this.clock.now();
      run.status = this.gateStatus(step.disposition);
      run.updatedAt = this.clock.now();
      this.store.save(run);
      return { success: true, data: run };
    }

    // All steps handled → final status (never a false COMPLETED).
    run.status = this.finalStatus(run);
    run.updatedAt = this.clock.now();
    run.finishedAt = this.clock.now();
    this.store.save(run);
    return { success: true, data: run };
  }

  /**
   * Execute ONE executable step through the port — bounded, retried,
   * verified. Returns true to continue the run; false to stop.
   */
  private async executeStep(
    run: ExecutionRun,
    plan: FactoryCapabilityPlan,
    step: StepRun,
    budgetGuard: RunBudgetGuard,
  ): Promise<boolean> {
    const planStep = plan.steps.find((p) => p.id === step.stepId);
    const mapping = mapCapability(step.capability as Parameters<typeof mapCapability>[0]);
    if (!planStep || !mapping.runtime) {
      step.state = 'blocked';
      step.failureReason = mapping.note;
      run.status = 'BLOCKED';
      run.finishedAt = this.clock.now();
      return false;
    }

    const expectedTokens = 2000;
    const expectedCostUsd =
      run.budget.maxCostUsd > 0 ? Math.min(0.01, run.budget.maxCostUsd) : undefined;

    // Budget pre-check (fail-closed).
    const budgetCheck = budgetGuard.canExecute(expectedTokens, expectedCostUsd);
    if (!budgetCheck.ok) {
      return this.block(
        run,
        step,
        run.budget.failureReason ?? budgetCheck.reason ?? 'budget limit',
        budgetGuard,
        true,
      );
    }

    // Pre-verification (Phase 2). Dependencies count as satisfied when a
    // prior step completed OR was honestly skipped (unavailable) — matching
    // dependenciesMet() so the two checks can never disagree.
    const completed = new Set(
      run.steps
        .filter((s) => s.state === 'completed' || s.state === 'skipped')
        .map((s) => s.stepId),
    );
    const pre = this.verifier.pre({
      stepId: step.stepId,
      title: step.title,
      capability: step.capability,
      runtimeCapability: mapping.runtime,
      port: this.port,
      expectedTokens,
      expectedCostUsd,
      budget: run.budget,
      dependencies: this.dependencyIds(run, step.stepId),
      completedSteps: completed,
      provider: step.provider,
      model: step.model,
      evidenceCount: planStep.candidates.filter((c) => c.evidence.length > 0).length,
    });
    step.verification = pre;
    if (!pre.pre.passed) {
      return this.block(
        run,
        step,
        pre.pre.checks
          .filter((c) => !c.passed)
          .map((c) => c.detail)
          .join('; '),
        budgetGuard,
      );
    }

    step.state = 'running';
    step.startedAt = this.clock.now();
    step.updatedAt = this.clock.now();
    run.updatedAt = this.clock.now();
    this.store.save(run);

    const instruction = `${planStep.title}: ${planStep.purpose}`;
    let attempts = 0;
    let lastError = '';

    while (attempts <= this.maxRetries) {
      attempts += 1;
      step.attempts = attempts;
      const guard = budgetGuard.canExecute(expectedTokens, expectedCostUsd);
      if (!guard.ok) {
        return this.block(run, step, guard.reason ?? 'budget limit', budgetGuard, true);
      }
      budgetGuard.beginIteration();

      let result;
      try {
        result = await this.port.execute({
          stepId: step.stepId,
          capability: step.capability,
          runtimeCapability: mapping.runtime,
          instruction,
          userId: run.ownerId,
          expectedOutputTokens: expectedTokens,
          expectedCostUsd,
        });
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }

      if (result.ok && result.content && !result.abstained) {
        // Post-verification (Phase 2): EXECUTION + OUTPUT + VALIDATION.
        let post = this.verifier.post(step, result);
        // SPRINT-024 — REAL artifact verification (opt-in): when a reader and
        // expectations are bound, the step completes ONLY when the execution
        // contract AND the real artifact both verify — a provider saying
        // "file created" is never success on its own.
        if (post.post?.passed && this.artifactReader && this.artifactExpectations) {
          const expectations = this.artifactExpectations(run, step);
          if (expectations.length > 0) {
            const artifact = await this.verifier.verifyArtifacts(this.artifactReader, expectations);
            post = this.verifier.attachArtifacts(post, artifact);
            // Persist the COMBINED verification so the recorded evidence
            // reflects the real artifact — a failing artifact check must be
            // visible on the step, not just in a transient local variable.
            step.verification = post;
          }
        }
        if (post.post?.passed) {
          const tokens = result.tokens?.total ?? 0;
          const costUsd = result.costUsd ?? 0;
          const latencyMs = result.latencyMs ?? 0;
          budgetGuard.record({ tokens, costUsd, latencyMs });
          step.state = 'completed';
          step.output = result.content;
          step.provider = result.provider ?? step.provider;
          step.model = result.model ?? step.model;
          step.tokensUsed = tokens;
          step.costUsd = costUsd;
          step.latencyMs = latencyMs;
          step.retried = attempts > 1;
          step.endedAt = this.clock.now();
          step.updatedAt = this.clock.now();
          run.budget = budgetGuard.snapshot();
          run.updatedAt = this.clock.now();
          this.ledger.record({
            executionId: run.executionId,
            stepId: step.stepId,
            source: 'inferred_observation',
            fact: `Provider ${step.provider ?? 'unknown'} completed '${step.title}' (${String(tokens)} tokens, $${costUsd.toFixed(4)}).`,
            provider: step.provider,
            model: step.model,
            capability: step.capability,
            reason: 'step verified and completed',
            confidence: 0.7,
          });
          return true;
        }
        lastError = `validation failed: ${
          post.post?.checks
            .filter((c) => !c.passed)
            .map((c) => c.detail)
            .join('; ') ?? 'unknown'
        }`;
      } else {
        lastError =
          result.error ??
          (result.abstained ? 'runtime abstained (evidence-first)' : 'no output produced');
      }

      if (attempts <= this.maxRetries) {
        step.retried = true;
        step.updatedAt = this.clock.now();
        await this.clock.sleep(5 * attempts);
      }
    }

    // Bounded retries exhausted → the step failed (never endless retry).
    step.state = 'failed';
    step.failureReason = lastError;
    step.endedAt = this.clock.now();
    step.updatedAt = this.clock.now();
    run.status = 'FAILED';
    run.updatedAt = this.clock.now();
    run.finishedAt = this.clock.now();
    this.ledger.record({
      executionId: run.executionId,
      stepId: step.stepId,
      source: 'inferred_observation',
      fact: `Provider ${step.provider ?? 'unknown'} FAILED for '${step.title}' after ${String(attempts)} attempt(s).`,
      provider: step.provider,
      model: step.model,
      capability: step.capability,
      reason: lastError,
      confidence: 0.8,
    });
    return false;
  }

  private block(
    run: ExecutionRun,
    step: StepRun,
    reason: string,
    budgetGuard: RunBudgetGuard,
    budgetExceeded = false,
  ): false {
    step.state = 'blocked';
    step.failureReason = reason;
    step.endedAt = this.clock.now();
    step.updatedAt = this.clock.now();
    run.budget = budgetGuard.snapshot();
    if (budgetExceeded) {
      run.budget.exceeded = true;
      run.budget.failureReason = reason;
    }
    run.status = 'BLOCKED';
    run.updatedAt = this.clock.now();
    run.finishedAt = this.clock.now();
    this.ledger.record({
      executionId: run.executionId,
      stepId: step.stepId,
      source: 'inferred_observation',
      fact: `Execution blocked at '${step.title}': ${reason}`,
      provider: step.provider,
      capability: step.capability,
      reason,
      confidence: 0.9,
    });
    return false;
  }

  private decideApproval(
    ownerId: string,
    executionId: string,
    stepId: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ): Promise<ServiceResult<ExecutionRun>> {
    const run = this.store.get(executionId);
    if (!run)
      return Promise.resolve({ success: false, error: `Execution not found: ${executionId}` });
    if (run.ownerId !== ownerId) {
      return Promise.resolve({ success: false, error: 'Not your execution (IDOR refused).' });
    }
    const step = run.steps.find((s) => s.stepId === stepId);
    if (!step) return Promise.resolve({ success: false, error: `Step not found: ${stepId}` });
    if (step.state !== 'waiting_approval') {
      return Promise.resolve({
        success: false,
        error: `Step ${step.title} is not awaiting approval.`,
      });
    }

    if (decision === 'approved') {
      // Approval grants execution: the step now runs through the EXECUTABLE
      // path (pre-verification still guards availability/budget before any call).
      // The hand-off is closed so the UI never shows stale approval actions
      // on the executed step.
      const approvalHandoff = run.handoffs.find((h) => h.stepId === stepId);
      if (approvalHandoff) approvalHandoff.completed = true;
      step.disposition = 'EXECUTABLE';
      step.state = 'ready';
      step.updatedAt = this.clock.now();
      run.status = 'RUNNING';
      run.updatedAt = this.clock.now();
      this.ledger.record({
        executionId: run.executionId,
        stepId: step.stepId,
        source: 'explicit_user_approval',
        fact: `User approved executing '${step.title}'${step.provider ? ` via ${step.provider}` : ''}.`,
        provider: step.provider,
        model: step.model,
        capability: step.capability,
        reason: note ?? 'user approved the irreversible action',
        confidence: 1,
      });
      this.store.save(run);
      return this.advance(run);
    }

    step.state = 'blocked';
    step.failureReason = 'Approval rejected by the user.';
    step.updatedAt = this.clock.now();
    run.status = 'BLOCKED';
    run.updatedAt = this.clock.now();
    run.finishedAt = this.clock.now();
    this.ledger.record({
      executionId: run.executionId,
      stepId: step.stepId,
      source: 'explicit_user_rejection',
      fact: `User REJECTED '${step.title}'${step.provider ? ` (${step.provider})` : ''}.`,
      provider: step.provider,
      model: step.model,
      capability: step.capability,
      reason: note ?? 'user rejected the approval',
      confidence: 1,
    });
    this.store.save(run);
    return Promise.resolve({ success: true, data: run });
  }

  // ── Hand-off records (WHAT / WHY / ACTION / AFTER) ───────────────

  private recordApprovalHandoff(
    run: ExecutionRun,
    step: StepRun,
    plan: FactoryCapabilityPlan,
  ): void {
    const planStep = plan.steps.find((p) => p.id === step.stepId);
    const detail = planStep
      ? this.approvals.describe(
          planStep,
          step.provider,
          step.model,
          run.budget.maxCostUsd > 0 ? Math.min(0.01, run.budget.maxCostUsd) : undefined,
        )
      : [];
    run.handoffs.push({
      stepId: step.stepId,
      kind: 'MANUAL',
      what: `“${step.title}” is waiting for your approval before it executes.`,
      why: detail.join(' ') || 'This step performs an irreversible action.',
      action: 'Review the details and approve or reject.',
      after: 'Approving resumes execution from this step; rejecting blocks the run.',
      completed: false,
    });
  }

  private recordConfigureHandoff(run: ExecutionRun, step: StepRun): void {
    run.handoffs.push({
      stepId: step.stepId,
      kind: 'CONFIGURE',
      what: `“${step.title}” needs a configured provider before it can be automated.`,
      why: `The plan selected ${step.provider ?? 'a candidate'} but it is not configured.`,
      action: `Configure ${step.provider ?? 'the provider'} in the existing Providers screen.`,
      after: 'Marking it done resumes execution from this step.',
      deepLink: '/providers',
      completed: false,
    });
  }

  private recordManualHandoff(run: ExecutionRun, step: StepRun, plan: FactoryCapabilityPlan): void {
    const planStep = plan.steps.find((p) => p.id === step.stepId);
    const external = planStep?.candidates.find((c) => c.integrationType === 'EXTERNAL_APPLICATION');
    run.handoffs.push({
      stepId: step.stepId,
      kind: external ? 'EXTERNAL' : 'MANUAL',
      what: external
        ? `“${step.title}” requires the external application ${external.name} — VedMoulya cannot execute it.`
        : `“${step.title}” requires a human — no tool can automate it yet.`,
      why: external
        ? 'No executable API is evidenced for this application; automation is never assumed.'
        : 'The plan found no automatable candidate for this step.',
      action: external
        ? `Complete this step inside ${external.name}, then mark it done.`
        : 'Complete this step manually, then mark it done.',
      after: 'Marking it done resumes execution from this step.',
      completed: false,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private gateStatus(disposition: StepDisposition): ExecutionState {
    switch (disposition) {
      case 'WAITING_FOR_APPROVAL':
        return 'WAITING_FOR_APPROVAL';
      case 'CONFIGURE':
        return 'CONFIGURE_REQUIRED';
      case 'MANUAL_REQUIRED':
        return 'MANUAL_REQUIRED';
      default:
        return 'READY';
    }
  }

  private finalStatus(run: ExecutionRun): ExecutionState {
    if (run.steps.every((s) => s.state === 'completed')) return 'COMPLETED';
    if (run.steps.some((s) => s.state === 'failed')) return 'FAILED';
    if (run.steps.some((s) => s.state === 'blocked')) return 'BLOCKED';
    return 'PARTIAL';
  }

  private persistCheckpoint(run: ExecutionRun): void {
    run.checkpoints.push({
      checkpointId: `cp-${generateId()}`,
      executionId: run.executionId,
      completedStepIds: run.steps.filter((s) => s.state === 'completed').map((s) => s.stepId),
      createdAt: this.clock.now(),
    });
  }

  private dependenciesMet(run: ExecutionRun, index: number): boolean {
    return run.steps.slice(0, index).every((s) => s.state === 'completed' || s.state === 'skipped');
  }

  private dependencyIds(run: ExecutionRun, stepId: string): string[] {
    const index = run.steps.findIndex((s) => s.stepId === stepId);
    return index > 0 ? run.steps.slice(0, index).map((s) => s.stepId) : [];
  }
}
