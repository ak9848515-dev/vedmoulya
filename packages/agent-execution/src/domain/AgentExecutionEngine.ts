// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: the controlled loop
//
//   USER GOAL → PLAN (validated) → STEP → ACTIONS → OBSERVATION →
//   VERIFY → PASS → next step → VERIFY → OUTCOME
//                  └ FAIL → CLASSIFY → bounded RECOVERY → CONTINUE
//
// Invariants (enforced by construction):
//   - explicit state machine with traceable transitions (stateHistory);
//   - plan validation BEFORE execution — impossible steps never run;
//   - tool execution goes through the tool port security chain — a denial
//     is never bypassed and permission gates pause WAITING_FOR_APPROVAL;
//   - verification is deterministic-first; UNKNOWN is never success;
//   - recovery is bounded (attempts/revisions/tool calls/tokens/cost/time);
//   - GOAL ACHIEVED is distinct from STEP VERIFIED (final goal check);
//   - the engine executes NO AI directly — every call goes through ports;
//   - traces carry correlation ids (goalId/planId/stepId/actionId) and
//     never raw prompts, arguments or secrets.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type {
  AgentAiExecutionPort,
  AgentModelVerifierPort,
  AgentToolExecutionPort,
  AgentToolRegistryPort,
} from '../contracts/agent-execution-ports.js';
import type { AgentClockPort } from '../contracts/agent-execution-ports.js';
import type {
  AgentActionRecord,
  AgentActionSpec,
  AgentArtifactRef,
  AgentExecutionRun,
  AgentObservation,
  AgentPlanStep,
  AgentRunState,
  AgentStepResult,
  AgentStepStatus,
  AgentVerificationResult,
  PlanValidationIssue,
} from '../types/agent-execution-types.js';
import { AGENT_TERMINAL_STATES } from '../types/agent-execution-types.js';
import { approvalGateForStep, awaitingDecisionForStep } from './approval-policy.js';
import { validatePlanReadiness, validatePlanStructure } from './PlanValidator.js';
import { decideRecovery, type StepAttemptFailure } from './recovery.js';
import { sanitizeTraceText, safeSlice } from './sanitize.js';
import { verifyAgainstPolicy, type VerificationContext } from './verification.js';

export interface AgentEnginePorts {
  ai?: AgentAiExecutionPort;
  tools?: AgentToolExecutionPort;
  toolRegistry?: AgentToolRegistryPort;
  modelVerifier?: AgentModelVerifierPort;
  clock: AgentClockPort;
  /** Optional persistence hook — called after every meaningful transition. */
  onUpdate?: (run: AgentExecutionRun) => void;
}

interface AttemptOutcome {
  failed: boolean;
  reason?: string;
  toolDenied?: boolean;
  toolUnavailable?: boolean;
  budgetExceeded?: boolean;
  aiFailed?: boolean;
  toolFailed?: boolean;
  abstained?: boolean;
  failedToolName?: string;
}

const FEASIBILITY_ERROR_CODES = new Set(['CAPABILITY_NOT_ROUTABLE', 'TOOL_UNAVAILABLE']);

export class AgentExecutionEngine {
  private readonly ports: AgentEnginePorts;
  /** Wall-clock start of the current execution pass (ms). */
  private passStartedMs = 0;

  constructor(ports: AgentEnginePorts) {
    this.ports = ports;
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Validate + execute a run until it pauses (approval) or terminates.
   * Idempotent on terminal runs. Safe to call again after an approval.
   */
  async run(run: AgentExecutionRun): Promise<AgentExecutionRun> {
    if (AGENT_TERMINAL_STATES.includes(run.state)) {
      return run;
    }
    this.passStartedMs = this.ports.clock.timestampMs();

    // Validation happens ONCE, before any step executes.
    if (run.validationIssues.length === 0 && run.state === 'PLANNING') {
      const structural = validatePlanStructure(run.plan);
      run.validationIssues.push(...structural);
      const blocking = structural.filter((i) => i.severity === 'error');
      if (blocking.length === 0) {
        run.validationIssues.push(...(await validatePlanReadiness(run.plan, this.ports)));
      }
      this.transition(run, 'READY');
      if (blocking.length > 0) {
        this.blockRun(run, blocking.map((i) => i.message).join('; '));
        return run;
      }
    }

    await this.executePending(run);
    return run;
  }

  /** Resume a WAITING_FOR_APPROVAL run after a recorded decision. */
  async resume(run: AgentExecutionRun): Promise<AgentExecutionRun> {
    if (run.state !== 'WAITING_FOR_APPROVAL') {
      run.error = `cannot resume a run in state ${run.state}`;
      this.transition(run, 'FAILED_FINAL');
      this.ports.onUpdate?.(run);
      return run;
    }
    this.passStartedMs = this.ports.clock.timestampMs();
    await this.executePending(run);
    return run;
  }

  // ── Validation helpers ───────────────────────────────────────────

  private feasibilityIssuesForStep(run: AgentExecutionRun, stepId: string): PlanValidationIssue[] {
    return run.validationIssues.filter(
      (issue) =>
        issue.severity === 'error' &&
        issue.stepId === stepId &&
        FEASIBILITY_ERROR_CODES.has(issue.code),
    );
  }

  // ── Main execution loop ──────────────────────────────────────────

  private async executePending(run: AgentExecutionRun): Promise<void> {
    this.transition(run, 'EXECUTING');
    let hadBlocked = false;

    for (;;) {
      if (run.state === 'CANCELLED') return;
      const step = this.pickNextStep(run);
      if (!step) break;

      const sr = this.resultFor(run, step);
      run.currentStepId = step.stepId;
      this.ports.onUpdate?.(run);

      // Feasibility: impossible steps are blocked before any action runs.
      const feasibility = this.feasibilityIssuesForStep(run, step.stepId);
      if (feasibility.length > 0) {
        sr.status = 'blocked';
        // Self-identifying error: the issue code is part of the step error so
        // blocked-step reasons are traceable without re-deriving validation.
        sr.error = feasibility.map((i) => `${i.code}: ${i.message}`).join('; ');
        sr.endedAt = this.ports.clock.now();
        hadBlocked = true;
        this.ports.onUpdate?.(run);
        continue;
      }

      // Approval gate: a model request is NOT authorization.
      if (!this.hasApproved(run, step.stepId) && awaitingDecisionForStep(run, step.stepId)) {
        const gate = approvalGateForStep(step, run.autonomyLevel, this.ports.toolRegistry);
        if (gate) {
          sr.status = 'waiting_approval';
          sr.startedAt = this.ports.clock.now();
          run.approvals.push({
            approvalId: `approval-${generateId()}`,
            runId: run.runId,
            stepId: step.stepId,
            stepTitle: step.objective,
            reason: gate.reason,
            riskClass: gate.riskClass,
            requestedAt: this.ports.clock.now(),
          });
          this.transition(run, 'WAITING_FOR_APPROVAL');
          this.ports.onUpdate?.(run);
          return; // pause — a human decision is required
        }
      }

      sr.status = 'running';
      sr.startedAt = this.ports.clock.now();
      this.ports.onUpdate?.(run);
      await this.executeStep(run, step, sr);

      const stepStatus = this.stepStatusOf(sr);
      if (stepStatus === 'failed') {
        await this.finishRun(run, false);
        return;
      }
      if (stepStatus === 'blocked') {
        hadBlocked = true;
      }
      this.ports.onUpdate?.(run);
    }

    // Steps whose dependencies can never complete are blocked explicitly.
    this.blockStuckSteps(run);
    await this.finishRun(run, hadBlocked);
  }

  // ── Step execution ───────────────────────────────────────────────

  private async executeStep(
    run: AgentExecutionRun,
    step: AgentPlanStep,
    sr: AgentStepResult,
  ): Promise<void> {
    const budget = run.budget;
    const maxAttempts = step.recoveryPolicy?.maxAttempts ?? budget.maxAttemptsPerStep;
    const maxRevisions = step.recoveryPolicy?.maxRevisions ?? budget.maxRevisionsPerStep;
    const acceptUnknown = step.recoveryPolicy?.acceptUnknown === true;
    const alternateTools = step.recoveryPolicy?.alternateTools ?? [];

    let attempt = 0;
    let revision = 0;
    let fallbackExpected = false;
    let currentToolOverride: string | undefined;

    while (attempt < maxAttempts && revision <= maxRevisions) {
      attempt += 1;
      sr.attempts = attempt;
      run.usage.attempts += 1;
      this.transition(run, 'EXECUTING');

      // Wall-clock bound — checked BEFORE the next call.
      const elapsedMs = this.ports.clock.timestampMs() - this.passStartedMs;
      if (elapsedMs > budget.maxLatencyMs) {
        this.failAttempt(
          run,
          step,
          sr,
          {
            failed: true,
            budgetExceeded: true,
            reason: `wall-clock budget exceeded (${String(elapsedMs)}ms)`,
          },
          attempt,
          revision,
        );
        return;
      }

      const attemptObservations: AgentObservation[] = [];
      const attemptActions: AgentActionRecord[] = [];
      const attemptArtifacts: AgentArtifactRef[] = [];
      const outputs: string[] = [];
      let outcome: AttemptOutcome = { failed: false };

      for (const action of this.effectiveActions(step, currentToolOverride)) {
        if (action.kind === 'ai') {
          outcome = await this.executeAiAction(run, step, sr, action, {
            attempt,
            revision,
            fallbackExpected,
            observations: attemptObservations,
            actions: attemptActions,
            outputs,
            artifacts: attemptArtifacts,
          });
        } else {
          outcome = await this.executeToolAction(run, step, sr, action, {
            attempt,
            revision,
            fallbackExpected,
            observations: attemptObservations,
            actions: attemptActions,
            outputs,
            artifacts: attemptArtifacts,
          });
        }
        if (outcome.failed) break;
      }

      // Persist this attempt's executions (trace correlation, bounded by the
      // attempt budget — later attempts append, never overwrite).
      sr.actions.push(...attemptActions);
      sr.observations.push(...attemptObservations);

      if (!outcome.failed) {
        // OBSERVE → VERIFY.
        this.transition(run, 'VERIFYING');
        const context: VerificationContext = {
          output: safeSlice(outputs.join('\n\n'), 16_000),
          artifacts: attemptArtifacts,
          observations: attemptObservations,
        };
        const verification = await verifyAgainstPolicy(step.verificationPolicy, context, {
          tools: this.ports.tools,
          modelVerifier: this.ports.modelVerifier,
          // Plan-declared {outputOf:step-N} references in a command-verification
          // call resolve against the REAL completed step outputs (e.g. the
          // model-produced content that was just written).
          resolveArguments: (args) => this.resolveOutputRefs(run, args),
        });
        sr.verification = verification;
        sr.verdict = verification.verdict;

        if (verification.verdict === 'VERIFIED') {
          sr.status = 'completed';
          sr.verified = true;
          sr.output = context.output;
          sr.endedAt = this.ports.clock.now();
          this.ports.onUpdate?.(run);
          return;
        }
        if (verification.verdict === 'UNKNOWN' && acceptUnknown) {
          // Deliberate, explicit acceptance — never silent (policy flag).
          sr.status = 'completed';
          sr.verified = false;
          sr.output = context.output;
          sr.endedAt = this.ports.clock.now();
          sr.error = 'step completed with an UNKNOWN verification verdict (explicitly accepted)';
          this.ports.onUpdate?.(run);
          return;
        }
        outcome = {
          failed: true,
          reason: `verification ${verification.verdict}: ${verification.reasons.join('; ')}`,
        };
      }

      // RECOVER — bounded by construction.
      this.transition(run, 'RECOVERING');
      const failure: StepAttemptFailure = {
        verdict: sr.verdict,
        toolDenied: outcome.toolDenied,
        toolUnavailable: outcome.toolUnavailable,
        aiFailed: outcome.aiFailed,
        toolFailed: outcome.toolFailed,
        abstained: outcome.abstained,
        budgetExceeded: outcome.budgetExceeded,
        hasAi: step.actions.some((a) => a.kind === 'ai'),
        hasTools: step.actions.some((a) => a.kind === 'tool'),
        failedToolName: outcome.failedToolName ?? currentToolOverride ?? undefined,
        attempts: attempt,
        revisions: revision,
        aiFallbackUsed: fallbackExpected,
        policy: step.recoveryPolicy,
        maxAttempts,
        maxRevisions,
      };
      const decision = decideRecovery(failure);
      sr.recoveries.push({
        recoveryId: `recovery-${generateId()}`,
        stepId: step.stepId,
        attempt,
        failureClass: decision.failureClass,
        strategy: decision.strategy,
        reason: decision.reason,
        recoveredAt: this.ports.clock.now(),
      });
      this.ports.onUpdate?.(run);

      if (decision.strategy === 'retry') {
        continue;
      }
      if (decision.strategy === 'alternate_model') {
        fallbackExpected = true;
        continue;
      }
      if (decision.strategy === 'alternate_tool') {
        const alt = alternateTools.find(
          (t) => t !== (currentToolOverride ?? outcome.failedToolName),
        );
        currentToolOverride = alt;
        if (!alt) {
          sr.status = 'failed';
          sr.error = outcome.reason ?? 'no alternate tool available';
          sr.endedAt = this.ports.clock.now();
          return;
        }
        continue;
      }
      if (decision.strategy === 'revise_step') {
        revision += 1;
        sr.revisions = revision;
        run.usage.revisions += 1;
        fallbackExpected = false;
        continue;
      }
      if (decision.strategy === 'block_step') {
        sr.status = 'blocked';
        sr.verified = false;
        sr.error = decision.reason;
        sr.endedAt = this.ports.clock.now();
        this.ports.onUpdate?.(run);
        return;
      }
      // fail_step (or unknown strategy) — explicit FAILED, never silent.
      sr.status = 'failed';
      sr.verified = false;
      sr.error = decision.reason;
      sr.endedAt = this.ports.clock.now();
      this.ports.onUpdate?.(run);
      return;
    }

    // Attempt/revision budget exhausted without a terminal decision.
    sr.status = 'failed';
    sr.verified = false;
    sr.error = `step recovery budget exhausted after ${String(maxAttempts)} attempt(s) and ${String(
      maxRevisions,
    )} revision(s)`;
    sr.endedAt = this.ports.clock.now();
    this.ports.onUpdate?.(run);
  }

  // ── Action executors ─────────────────────────────────────────────

  private async executeAiAction(
    run: AgentExecutionRun,
    step: AgentPlanStep,
    sr: AgentStepResult,
    action: Extract<AgentActionSpec, { kind: 'ai' }>,
    attemptState: AttemptState,
  ): Promise<AttemptOutcome> {
    const ai = this.ports.ai;
    if (!ai) {
      return {
        failed: true,
        aiFailed: true,
        reason: `AI action "${action.actionId}" requires an AI execution port which is not configured`,
      };
    }
    const startedAt = this.ports.clock.now();
    const startMs = this.ports.clock.timestampMs();
    try {
      const instruction = this.buildAiInstruction(run, step, action, attemptState.revision);
      const result = await ai.execute({
        actionId: action.actionId,
        stepId: step.stepId,
        goalId: run.goalId,
        planId: run.planId,
        userId: run.userId,
        // Mission identity rides every AI execution of a Mission run, so each
        // provider_execution span (retry or fallback included) is attributed to
        // the same real Mission. Absent for a generic run.
        ...(run.missionContext !== undefined ? { missionContext: run.missionContext } : {}),
        capability: action.capability,
        requiredCapabilities:
          action.requiredCapabilities !== undefined && action.requiredCapabilities.length > 0
            ? action.requiredCapabilities
            : [action.capability],
        qualityTier: action.qualityTier ?? 'standard',
        instruction,
        attempt: attemptState.attempt,
        revision: attemptState.revision,
        fallbackExpected: attemptState.fallbackExpected,
        expectedOutcome: action.expectedOutcome ?? step.expectedOutcome,
        previousObservations: attemptState.observations
          .map((o) => `${o.status}: ${o.resultSummary}`)
          .slice(-5),
      });
      this.recordUsage(run, result.costUsd ?? 0, result.tokens?.total ?? 0, result.latencyMs ?? 0);
      sr.costUsd += result.costUsd ?? 0;
      sr.tokensUsed += result.tokens?.total ?? 0;
      sr.latencyMs += result.latencyMs ?? 0;
      const endedAt = this.ports.clock.now();
      const latencyMs = Math.max(this.ports.clock.timestampMs() - startMs, result.latencyMs ?? 0);

      const observation: AgentObservation = {
        observationId: `obs-${generateId()}`,
        actionId: action.actionId,
        stepId: step.stepId,
        runId: run.runId,
        attempt: attemptState.attempt,
        status: result.abstained
          ? 'blocked'
          : result.error !== undefined || result.content === undefined
            ? 'failed'
            : 'succeeded',
        resultSummary: sanitizeTraceText(result.content ?? result.error ?? 'no content produced', {
          maxLength: 1_200,
        }),
        error: result.error !== undefined ? sanitizeTraceText(result.error) : undefined,
        artifacts: [],
        provider: result.provider,
        model: result.model,
        capability: action.capability,
        observedAt: endedAt,
      };
      attemptState.observations.push(observation);
      attemptState.actions.push({
        actionId: action.actionId,
        stepId: step.stepId,
        runId: run.runId,
        kind: 'ai',
        attempt: attemptState.attempt,
        revision: attemptState.revision,
        fallbackUsed: attemptState.fallbackExpected,
        capability: action.capability,
        provider: result.provider,
        model: result.model,
        status: observation.status === 'succeeded' ? 'succeeded' : 'failed',
        tokensUsed: result.tokens?.total ?? 0,
        costUsd: result.costUsd ?? 0,
        latencyMs,
        error: result.error !== undefined ? sanitizeTraceText(result.error) : undefined,
        observationId: observation.observationId,
        startedAt,
        endedAt,
      });
      if (observation.status === 'succeeded' && result.content !== undefined) {
        attemptState.outputs.push(result.content);
      }

      if (result.abstained) {
        return { failed: true, abstained: true, reason: 'runtime abstained (evidence-first)' };
      }
      if (
        result.error !== undefined ||
        result.content === undefined ||
        result.content.length === 0
      ) {
        return {
          failed: true,
          aiFailed: true,
          reason: result.error ?? 'AI action produced no content',
        };
      }
      if (this.budgetExceeded(run)) {
        return { failed: true, budgetExceeded: true, reason: 'cumulative run budget exceeded' };
      }
      return { failed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const latencyMs = Math.max(this.ports.clock.timestampMs() - startMs, 0);
      const endedAt = this.ports.clock.now();
      attemptState.actions.push({
        actionId: action.actionId,
        stepId: step.stepId,
        runId: run.runId,
        kind: 'ai',
        attempt: attemptState.attempt,
        revision: attemptState.revision,
        fallbackUsed: attemptState.fallbackExpected,
        capability: action.capability,
        status: 'failed',
        tokensUsed: 0,
        costUsd: 0,
        latencyMs,
        error: sanitizeTraceText(message),
        startedAt,
        endedAt,
      });
      attemptState.observations.push({
        observationId: `obs-${generateId()}`,
        actionId: action.actionId,
        stepId: step.stepId,
        runId: run.runId,
        attempt: attemptState.attempt,
        status: 'failed',
        resultSummary: sanitizeTraceText(message, { maxLength: 1_200 }),
        error: sanitizeTraceText(message),
        artifacts: [],
        provider: undefined,
        model: undefined,
        capability: action.capability,
        observedAt: endedAt,
      });
      return { failed: true, aiFailed: true, reason: message };
    }
  }

  private async executeToolAction(
    run: AgentExecutionRun,
    step: AgentPlanStep,
    sr: AgentStepResult,
    action: Extract<AgentActionSpec, { kind: 'tool' }>,
    attemptState: AttemptState,
  ): Promise<AttemptOutcome> {
    const tools = this.ports.tools;
    const registry = this.ports.toolRegistry;
    if (!tools) {
      return {
        failed: true,
        toolUnavailable: true,
        failedToolName: action.toolName,
        reason: `tool execution port is not configured for "${action.toolName}"`,
      };
    }

    // 1. Allowlist — the step declares exactly which tools may run.
    if (!step.allowedTools.includes(action.toolName)) {
      return {
        failed: true,
        toolUnavailable: true,
        failedToolName: action.toolName,
        reason: `tool "${action.toolName}" is not in the step allowlist — refused`,
      };
    }

    // 2. Platform availability (authoritative registry).
    if (registry) {
      const allowed = registry.listAllowed();
      if (!allowed.includes(action.toolName) && registry.describe(action.toolName) === undefined) {
        return {
          failed: true,
          toolUnavailable: true,
          failedToolName: action.toolName,
          reason: `tool "${action.toolName}" is not available on this platform`,
        };
      }
    }

    // 3. Tool-call budget — bounded BEFORE the call.
    if (run.usage.toolCalls >= run.budget.maxToolCalls) {
      return { failed: true, budgetExceeded: true, reason: 'tool-call budget exhausted' };
    }

    const startedAt = this.ports.clock.now();
    const startMs = this.ports.clock.timestampMs();
    let result;
    try {
      // Plan-declared {outputOf:step-N} references (and any nested occurrence)
      // are substituted with the REAL completed output of that step BEFORE the
      // governed tool call. The tool NAME and the path arguments stay the
      // plan's literals — only a declared content reference can be filled, and
      // the call still passes the full security chain (allowlist, path jail,
      // schema, timeout, rate limit, audit).
      const resolvedArguments = this.resolveOutputRefs(run, action.arguments ?? {});
      result = await tools.execute({
        toolName: action.toolName,
        arguments: resolvedArguments,
        userId: run.userId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const endedAt = this.ports.clock.now();
      attemptState.actions.push({
        actionId: action.actionId,
        stepId: step.stepId,
        runId: run.runId,
        kind: 'tool',
        attempt: attemptState.attempt,
        revision: attemptState.revision,
        fallbackUsed: false,
        toolName: action.toolName,
        status: 'failed',
        tokensUsed: 0,
        costUsd: 0,
        latencyMs: Math.max(this.ports.clock.timestampMs() - startMs, 0),
        error: sanitizeTraceText(message),
        startedAt,
        endedAt,
      });
      attemptState.observations.push({
        observationId: `obs-${generateId()}`,
        actionId: action.actionId,
        stepId: step.stepId,
        runId: run.runId,
        attempt: attemptState.attempt,
        status: 'failed',
        resultSummary: sanitizeTraceText(message, { maxLength: 1_200 }),
        error: sanitizeTraceText(message),
        artifacts: [],
        toolName: action.toolName,
        observedAt: endedAt,
      });
      return { failed: true, toolFailed: true, failedToolName: action.toolName, reason: message };
    }

    run.usage.toolCalls += 1;
    sr.toolCalls += 1;
    const endedAt = this.ports.clock.now();
    const latencyMs = Math.max(this.ports.clock.timestampMs() - startMs, result.latencyMs ?? 0);
    sr.latencyMs += latencyMs;
    const artifacts = (result.artifacts ?? []).map((a) => ({ name: a.name, type: a.type }));

    const status = result.denied ? 'denied' : result.ok ? 'succeeded' : 'failed';
    attemptState.observations.push({
      observationId: `obs-${generateId()}`,
      actionId: action.actionId,
      stepId: step.stepId,
      runId: run.runId,
      attempt: attemptState.attempt,
      status,
      resultSummary: sanitizeTraceText(result.outcome, { maxLength: 1_200 }),
      error: result.error !== undefined ? sanitizeTraceText(result.error) : undefined,
      artifacts,
      toolName: action.toolName,
      observedAt: endedAt,
    });
    attemptState.actions.push({
      actionId: action.actionId,
      stepId: step.stepId,
      runId: run.runId,
      kind: 'tool',
      attempt: attemptState.attempt,
      revision: attemptState.revision,
      fallbackUsed: false,
      toolName: action.toolName,
      status: status === 'succeeded' ? 'succeeded' : status === 'denied' ? 'denied' : 'failed',
      tokensUsed: 0,
      costUsd: 0,
      latencyMs,
      error: result.error !== undefined ? sanitizeTraceText(result.error) : undefined,
      observationId: attemptState.observations[attemptState.observations.length - 1]?.observationId,
      startedAt,
      endedAt,
    });
    attemptState.artifacts.push(...artifacts);
    if (result.ok) {
      const output = this.toolOutputText(result);
      attemptState.outputs.push(output);
      // Publish the output as the observation summary too, so it is the SAME
      // real value a later {outputOf:step-N} reference consumes: an exact
      // read-back must compare against what the tool actually read/wrote, not
      // against the bare outcome enum. Keep the machine-readable outcome line
      // so existing "the tool succeeded" rule checks keep matching.
      const summary = sanitizeTraceText(output, { maxLength: 1_200 });
      const latest = attemptState.observations[attemptState.observations.length - 1];
      if (latest !== undefined && latest.actionId === action.actionId) {
        latest.resultSummary = summary;
      }
    }

    if (result.denied) {
      return {
        failed: true,
        toolDenied: true,
        failedToolName: action.toolName,
        reason: `tool "${action.toolName}" was denied by the security policy`,
      };
    }
    if (!result.ok) {
      return {
        failed: true,
        toolFailed: true,
        failedToolName: action.toolName,
        reason: result.error ?? `tool "${action.toolName}" failed`,
      };
    }
    return { failed: false };
  }

  // ── Small helpers ────────────────────────────────────────────────

  private effectiveActions(step: AgentPlanStep, toolOverride?: string): AgentActionSpec[] {
    if (!toolOverride) return step.actions;
    return step.actions.map((action) =>
      action.kind === 'tool' ? { ...action, toolName: toolOverride } : action,
    );
  }

  private buildAiInstruction(
    run: AgentExecutionRun,
    step: AgentPlanStep,
    action: Extract<AgentActionSpec, { kind: 'ai' }>,
    revision: number,
  ): string {
    const byStepOutput = new Map<string, string>();
    for (const result of run.stepResults) {
      if (result.status === 'completed' && result.output !== undefined) {
        byStepOutput.set(result.stepId, result.output);
      }
    }
    let instruction = action.instruction.replaceAll('{goal}', run.goal);
    for (const [stepId, output] of byStepOutput) {
      instruction = instruction.replaceAll(`{outputOf:${stepId}}`, output);
    }
    const previous = this.previousCompletedOutput(run, step);
    if (previous !== undefined) {
      instruction = instruction.replaceAll('{previousOutput}', previous);
    }
    if (revision > 0) {
      instruction = `${instruction}\n\n[Revision ${String(revision)} — change your approach based on the previous verification failure. Do not repeat the same output.]`;
    }
    return instruction;
  }

  /**
   * The step output a governed tool action contributes: the real tool payload
   * when the adapter surfaced one (e.g. workspace_read content), otherwise the
   * machine-readable outcome exactly as before. Bounded so a large payload can
   * never bloat the run trace.
   */
  private toolOutputText(result: { data?: unknown; outcome: string }): string {
    if (result.data === undefined) return result.outcome;
    // Keep the machine-readable outcome alongside the payload: existing
    // rule checks that assert the tool "succeeded" keep working unchanged,
    // while a later governed step can still read the real data.
    const payload =
      typeof result.data === 'string' ? result.data : (this.safeJson(result.data) ?? '');
    return payload.length > 0 ? `${result.outcome}\n${payload}` : result.outcome;
  }

  private safeJson(value: unknown): string | undefined {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }

  /**
   * Substitute plan-declared `{outputOf:step-N}` references inside a governed
   * tool action's arguments with the REAL completed output of that step. Only
   * declared references are touched: the plan builder writes the tool name and
   * every literal argument, so a substituted value can never choose a tool or
   * escape the path jail — the call still runs the full security chain.
   */
  private resolveOutputRefs(
    run: AgentExecutionRun,
    args: Record<string, unknown>,
    seen: Set<string> = new Set(),
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      // Prototype-safe: never allow a plan-declared key to touch Object.prototype.
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      // eslint-disable-next-line security/detect-object-injection -- key comes from Object.entries (own enumerable string keys) and prototype keys are skipped above.
      resolved[key] = this.resolveValueRefs(run, value, seen);
    }
    return resolved;
  }

  private resolveValueRefs(
    run: AgentExecutionRun,
    value: unknown,
    seen: Set<string> = new Set(),
  ): unknown {
    if (typeof value === 'string') return this.substituteOutputRefs(run, value, seen);
    if (Array.isArray(value)) return value.map((entry) => this.resolveValueRefs(run, entry, seen));
    if (value !== null && typeof value === 'object') {
      return this.resolveOutputRefs(run, value as Record<string, unknown>, seen);
    }
    return value;
  }

  private substituteOutputRefs(
    run: AgentExecutionRun,
    text: string,
    seen: Set<string> = new Set(),
  ): string {
    let resolved = text;
    for (const step of run.plan.steps) {
      if (seen.has(step.stepId)) continue;
      const output = this.consumableStepOutput(run, step, seen);
      if (output !== undefined) {
        resolved = resolved.replaceAll(`{outputOf:${step.stepId}}`, output);
      }
    }
    return resolved;
  }

  /**
   * The REAL value a later step consumes for `{outputOf:<stepId>}`.
   *
   * A step result's `output` is its VERIFICATION context — the concatenated
   * action outputs. For a TOOL step that text reads
   * "success\n{...tool payload...}" (the machine-readable outcome plus the
   * real data the tool produced), which is trace text, NOT the artifact.
   *
   * Therefore the consumed value is payload-aware:
   * - a WRITE-like step (workspace_write content/body/text/input) resolves to
   *   the content it WROTE (recursively resolved, cycle-guarded), so an exact
   *   read-back compares the real file against the authored bytes — not
   *   against tool metadata (outcome + result json);
   * - a READ-like tool step whose adapter surfaced `data` resolves to the real
   *   payload alone (outcome line stripped), so a downstream write carries
   *   the file body, not "success\n<body>";
   * - an AI step resolves to the FULL model content (the step result's bounded
   *   output), never the 1 200-char observation summary, so an authored
   *   deliverable is never silently truncated;
   * - anything else falls back to the last succeeded observation summary.
   * Rule checks keep matching the full trace (outcome line preserved there).
   */
  private consumableStepOutput(
    run: AgentExecutionRun,
    step: AgentPlanStep,
    seen: Set<string> = new Set(),
  ): string | undefined {
    const result = this.resultFor(run, step);
    if (result.status !== 'completed') return undefined;

    const written = this.writtenStepContent(run, step, seen);
    if (written !== undefined) return written;

    for (const observation of [...result.observations].reverse()) {
      const action = step.actions.find((spec) => spec.actionId === observation.actionId);
      if (action === undefined || observation.status !== 'succeeded') continue;
      if (action.kind !== 'tool') {
        // AI content VERBATIM — the step result's bounded output, NOT the
        // observation summary. That summary is a TRACE excerpt capped at
        // 1 200 chars, so consuming it silently wrote a TRUNCATED deliverable
        // (a longer authored report was cut at 1 200 chars + '…').
        return result.output;
      }
      // Tool step with a real payload: consume the payload alone, not the
      // "outcome\npayload" trace line kept for rule checks. The execution path
      // publishes `toolOutputText` as the summary, so the payload is the text
      // after the first newline; a bare outcome has no newline and is kept.
      const newline = observation.resultSummary.indexOf('\n');
      if (newline >= 0) return observation.resultSummary.slice(newline + 1);
      // The observation summary is the real consumed value: for a tool action
      // the execution path publishes that tool's `toolOutputText`
      // (outcome + real payload).
      return observation.resultSummary;
    }
    return result.output;
  }

  /**
   * The content a WRITE-like tool step wrote: the resolved `content`-family
   * argument of its last succeeded tool action. Cycle-guarded so a chain of
   * write→write references terminates (a self-reference resolves to whatever
   * literal text remains).
   */
  private writtenStepContent(
    run: AgentExecutionRun,
    step: AgentPlanStep,
    seen: Set<string>,
  ): string | undefined {
    if (seen.has(step.stepId)) return undefined;
    const result = this.resultFor(run, step);
    for (const observation of [...result.observations].reverse()) {
      if (observation.status !== 'succeeded') continue;
      const action = step.actions.find((spec) => spec.actionId === observation.actionId);
      if (action === undefined || action.kind !== 'tool') continue;
      const candidate = this.writeContentArgument(action.arguments);
      if (candidate === undefined) continue;
      if (typeof candidate !== 'string') {
        return typeof candidate === 'number' || typeof candidate === 'boolean'
          ? String(candidate)
          : this.safeJson(candidate);
      }
      // Resolve nested references (e.g. a write of {outputOf:step-0}) without
      // recursing back into this step.
      seen.add(step.stepId);
      try {
        return this.substituteOutputRefs(run, candidate, seen);
      } finally {
        seen.delete(step.stepId);
      }
    }
    return undefined;
  }

  /** The `content`-family argument of a WRITE-like tool call, if present. */
  private writeContentArgument(args: Record<string, unknown> | undefined): unknown {
    if (!args) return undefined;
    // Fixed allowlist — never a caller-controlled key into the arguments object.
    const CONTENT_KEYS = ['content', 'body', 'text', 'input', 'data'] as const;
    for (const key of CONTENT_KEYS) {
      const value: unknown = Object.getOwnPropertyDescriptor(args, key)?.value;
      if (value !== undefined) return value;
    }
    return undefined;
  }

  private previousCompletedOutput(run: AgentExecutionRun, step: AgentPlanStep): string | undefined {
    const index = run.plan.steps.findIndex((s) => s.stepId === step.stepId);
    if (index <= 0) return undefined;
    // Walk backwards through the earlier steps (slice avoids a computed
    // index member access; reverse() only mutates the sliced copy).
    for (const previous of run.plan.steps.slice(0, index).reverse()) {
      const result = this.resultFor(run, previous);
      if (result.status === 'completed' && result.output !== undefined) {
        return result.output;
      }
    }
    return undefined;
  }

  private pickNextStep(run: AgentExecutionRun): AgentPlanStep | undefined {
    for (const step of run.plan.steps) {
      const sr = this.resultFor(run, step);
      // pending steps run normally; waiting_approval steps re-enter execution
      // after an explicit human decision has been recorded on the run.
      if (sr.status !== 'pending' && sr.status !== 'waiting_approval') continue;
      const depsReady = step.dependencies.every(
        (depId) =>
          this.resultFor(run, run.plan.steps.find((s) => s.stepId === depId) as AgentPlanStep)
            .status === 'completed',
      );
      if (depsReady) return step;
    }
    return undefined;
  }

  private blockStuckSteps(run: AgentExecutionRun): void {
    for (const step of run.plan.steps) {
      const sr = this.resultFor(run, step);
      if (sr.status !== 'pending') continue;
      const missing = step.dependencies.filter((depId) => {
        const dep = run.plan.steps.find((s) => s.stepId === depId);
        return dep === undefined || this.resultFor(run, dep).status !== 'completed';
      });
      sr.status = 'blocked';
      sr.verified = false;
      sr.error =
        missing.length > 0
          ? `blocked: dependency ${missing.map((d) => `"${d}"`).join(', ')} never completed`
          : 'blocked: never scheduled';
      sr.endedAt = this.ports.clock.now();
    }
  }

  /** Widen the step status after mutation (avoids stale literal narrowing). */
  private stepStatusOf(sr: AgentStepResult): AgentStepStatus {
    return sr.status;
  }

  private resultFor(run: AgentExecutionRun, step: AgentPlanStep): AgentStepResult {
    let sr = run.stepResults.find((r) => r.stepId === step.stepId);
    if (!sr) {
      sr = {
        stepId: step.stepId,
        objective: step.objective,
        status: 'pending',
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
      };
      run.stepResults.push(sr);
    }
    return sr;
  }

  private hasApproved(run: AgentExecutionRun, stepId: string): boolean {
    return run.approvalDecisions.some((d) => d.stepId === stepId && d.decision === 'approved');
  }

  private recordUsage(
    run: AgentExecutionRun,
    costUsd: number,
    tokens: number,
    latencyMs: number,
  ): void {
    run.usage.costUsd += costUsd;
    run.usage.tokensUsed += tokens;
    run.usage.latencyMs += latencyMs;
  }

  private budgetExceeded(run: AgentExecutionRun): boolean {
    const usage = run.usage;
    return (
      usage.costUsd > run.budget.maxCostUsd ||
      usage.tokensUsed > run.budget.maxTokens ||
      usage.latencyMs > run.budget.maxLatencyMs
    );
  }

  private transition(run: AgentExecutionRun, state: AgentRunState): void {
    if (run.state === state) return;
    run.state = state;
    run.stateHistory.push(state);
    run.updatedAt = this.ports.clock.now();
  }

  private blockRun(run: AgentExecutionRun, reason: string): void {
    run.error = reason;
    run.outcome = 'BLOCKED';
    run.outcomeReasons.push(reason);
    run.finishedAt = this.ports.clock.now();
    this.transition(run, 'BLOCKED');
    this.ports.onUpdate?.(run);
  }

  private failAttempt(
    run: AgentExecutionRun,
    step: AgentPlanStep,
    sr: AgentStepResult,
    outcome: AttemptOutcome,
    attempt: number,
    revision: number,
  ): void {
    sr.recoveries.push({
      recoveryId: `recovery-${generateId()}`,
      stepId: step.stepId,
      attempt,
      failureClass: outcome.budgetExceeded ? 'BUDGET_EXCEEDED' : 'UNKNOWN_FAILURE',
      strategy: 'block_step',
      reason: outcome.reason ?? 'attempt failed',
      recoveredAt: this.ports.clock.now(),
    });
    sr.status = 'blocked';
    sr.verified = false;
    sr.error = outcome.reason ?? 'blocked';
    sr.revisions = revision;
    sr.endedAt = this.ports.clock.now();
    this.ports.onUpdate?.(run);
  }

  private async finishRun(run: AgentExecutionRun, hadBlocked: boolean): Promise<void> {
    const steps = run.stepResults;
    const blockedSteps = steps.filter((s) => s.status === 'blocked');
    const failedSteps = steps.filter((s) => s.status === 'failed');

    if (hadBlocked || blockedSteps.length > 0) {
      run.outcome = 'BLOCKED';
      run.outcomeReasons.push(...blockedSteps.map((s) => s.error ?? `step "${s.stepId}" blocked`));
      run.finishedAt = this.ports.clock.now();
      this.transition(run, 'BLOCKED');
      this.ports.onUpdate?.(run);
      return;
    }
    if (failedSteps.length > 0) {
      run.outcome = 'FAILED';
      run.outcomeReasons.push(...failedSteps.map((s) => s.error ?? `step "${s.stepId}" failed`));
      run.finishedAt = this.ports.clock.now();
      this.transition(run, 'FAILED_FINAL');
      this.ports.onUpdate?.(run);
      return;
    }

    // Every step executed without a hard failure — now judge the GOAL.
    const finalVerification = await this.evaluateFinalVerification(run);
    const unverifiedCount = steps.filter((s) => s.status === 'completed' && !s.verified).length;

    if (finalVerification?.verdict === 'VERIFIED') {
      run.outcome = 'ACHIEVED';
      run.outcomeReasons.push('all steps completed and the final goal verification VERIFIED');
    } else if (finalVerification !== undefined && finalVerification.verdict === 'FAILED') {
      run.outcome = 'FAILED';
      run.outcomeReasons.push(
        `steps completed but the final goal verification FAILED: ${finalVerification.reasons.join('; ')}`,
      );
      run.finishedAt = this.ports.clock.now();
      this.transition(run, 'FAILED_FINAL');
      this.ports.onUpdate?.(run);
      return;
    } else if (finalVerification !== undefined) {
      run.outcome = 'PARTIALLY_ACHIEVED';
      run.outcomeReasons.push(
        `final goal verification ${finalVerification.verdict} (${finalVerification.reasons.join('; ')})`,
      );
    } else if (unverifiedCount > 0) {
      run.outcome = 'PARTIALLY_ACHIEVED';
      run.outcomeReasons.push(
        `${String(unverifiedCount)} step(s) completed but not VERIFIED — success cannot be claimed`,
      );
    } else {
      run.outcome = 'ACHIEVED';
      run.outcomeReasons.push('all plan steps completed and verified');
    }

    if (run.outcome === 'PARTIALLY_ACHIEVED' && run.plan.completionCriteria) {
      run.outcomeReasons.push(`completion criteria: ${run.plan.completionCriteria.join('; ')}`);
    }
    run.finishedAt = this.ports.clock.now();
    this.transition(run, 'COMPLETED');
    this.ports.onUpdate?.(run);
  }

  private async evaluateFinalVerification(
    run: AgentExecutionRun,
  ): Promise<AgentVerificationResult | undefined> {
    const policy = run.plan.finalVerification;
    if (!policy) return undefined;
    const outputs = run.stepResults
      .filter((s) => s.status === 'completed' && s.output !== undefined)
      .map((s) => s.output ?? '');
    const artifacts: AgentArtifactRef[] = [];
    const observations: AgentObservation[] = [];
    for (const step of run.stepResults) {
      artifacts.push(...step.observations.flatMap((o) => o.artifacts));
      observations.push(...step.observations);
    }
    return verifyAgainstPolicy(
      policy,
      { output: safeSlice(outputs.join('\n\n'), 16_000), artifacts, observations },
      {
        tools: this.ports.tools,
        modelVerifier: this.ports.modelVerifier,
        resolveArguments: (args) => this.resolveOutputRefs(run, args),
      },
    );
  }
}

interface AttemptState {
  attempt: number;
  revision: number;
  fallbackExpected: boolean;
  observations: AgentObservation[];
  actions: AgentActionRecord[];
  outputs: string[];
  artifacts: AgentArtifactRef[];
}
