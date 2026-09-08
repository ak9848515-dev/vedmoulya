// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: Adaptive Engine
//
// The model-driven OBSERVE → DECIDE → ACT coordination engine:
//
//   EXECUTING → DECIDING → PROPOSED_ACTION → VALIDATING → GOVERNANCE →
//   EXECUTING → OBSERVING → ... → VERIFIED / COMPLETED / FAILED_FINAL /
//   BLOCKED / WAITING_FOR_APPROVAL
//
// Loop shape (one decision per iteration):
//   - The engine walks the plan's declared steps in dependency order.
//   - At every decision point it consults the decision model (bounded
//     context). With no model wired it behaves deterministically: each
//     step executes its declared actions and is verified with the frozen
//     verifyAgainstPolicy.
//   - A validated decision may propose the next action (TOOL_CALL /
//     AI_ACTION), request a VERIFY, REVISE_STEP (bounded), REPLAN
//     (bounded), COMPLETE (only with verification evidence), FAIL,
//     REQUEST_APPROVAL, ABSTAIN, or CONTINUE with the declared plan.
//
// Authority rules (the model NEVER becomes the security boundary):
//   - AI actions execute only through the frozen AgentAiExecutionPort
//     (production: AIOrchestrationAgentPort → AIOrchestrationService →
//     routing / health / evidence / capability gates / retry / CostLedger).
//   - Tool calls execute only through the frozen AgentToolExecutionPort
//     (production: ToolRegistryAgentPort → ToolRuntime security chain).
//     A denial is never retried and never bypassed.
//   - Capabilities come only from the frozen CapabilityType taxonomy and
//     the plan's declared whitelist — no silent expansion.
//   - Verification reuses the frozen verifyAgainstPolicy. UNKNOWN is never
//     success; a model saying "complete" is NOT evidence of completion.
//   - Recovery reuses the frozen decideRecovery strategy; budgets are hard
//     ceilings and repetition is detected deterministically (loop-guard).
//   - Replan goes through the frozen planning boundary and may never widen
//     permissions, autonomy, budgets, capabilities or tools.
//   - Approvals pause in WAITING_FOR_APPROVAL and resume only after an
//     explicit human decision — the model cannot approve itself.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import { sanitizeTraceText, verifyAgainstPolicy, decideRecovery } from '@vedmoulya/agent-execution';
import type {
  AgentAiExecutionPort,
  AgentClockPort,
  AgentModelVerifierPort,
  AgentPlan,
  AgentPlanStep,
  AgentToolExecutionPort,
  AgentToolRegistryPort,
  VerificationPolicy,
} from '@vedmoulya/agent-execution';
import { DEFAULT_AGENT_RUN_BUDGET } from '@vedmoulya/agent-execution';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  AdaptiveApprovalStore,
  AgentDecisionModelPort,
  AdaptivePlannerPort,
} from '../contracts/adaptive-loop-ports.js';
import type {
  ActionProposal,
  AdaptiveDecision,
  AdaptiveRun,
  AdaptiveTerminationReason,
  VerificationSummary,
} from '../types/adaptive-loop-types.js';
import {
  ADAPTIVE_TERMINAL_STATES,
  DEFAULT_ADAPTIVE_LOOP_BUDGETS,
} from '../types/adaptive-loop-types.js';
import type { AdaptiveLoopInput } from '../types/adaptive-loop-types.js';
import { parseDecisionProposal } from './decision.js';
import { allowedCapabilitiesForStep, validateDecision } from './decision-validation.js';
import type { DecisionValidationContext } from './decision-validation.js';
import { buildDecisionContext, pickNextPendingStep } from './adaptive-context.js';
import {
  checkLoopBudgets,
  detectLoop,
  fingerprintDecision,
  freshUsage,
  hashArguments,
} from './loop-guard.js';
import { normalizeObservation } from './observation.js';

const HIGH_RISK_PERMISSION_CLASSES = ['DELETE', 'SECRETS', 'DEPLOYMENT'] as const;

/** Outcome of one executed action — used by the bounded failure handler. */
type ActionOutcome = 'ok' | 'failed' | 'blocked' | 'denied' | 'budget';

export interface AdaptiveEngineDeps {
  ai?: AgentAiExecutionPort;
  tools?: AgentToolExecutionPort;
  toolRegistry?: AgentToolRegistryPort;
  modelVerifier?: AgentModelVerifierPort;
  /** Optional model consultation. Absent ⇒ deterministic CONTINUE mode. */
  decisionModel?: AgentDecisionModelPort;
  /** Optional bounded replan through the frozen planning boundary. */
  planner?: AdaptivePlannerPort;
  approvals: AdaptiveApprovalStore;
  clock: AgentClockPort;
  /** Optional persistence hook after every meaningful transition. */
  onUpdate?: (run: AdaptiveRun) => void;
}

export class AdaptiveEngine {
  private readonly deps: AdaptiveEngineDeps;
  /** Declared-action cursor per step (resumable across approval pauses). */
  private readonly actionCursor = new Map<string, number>();
  /** Wall-clock start of the current execution pass (ms). */
  private passStartedMs = 0;

  constructor(deps: AdaptiveEngineDeps) {
    this.deps = deps;
  }

  /** Create a fresh run. The plan must already be READY (planning boundary). */
  createRun(input: AdaptiveLoopInput): AdaptiveRun {
    const runId = `adaptive-${generateId()}`;
    const now = this.deps.clock.now();
    const stepStatus: AdaptiveRun['stepStatus'] = {};
    for (const step of input.plan.steps) stepStatus[step.stepId] = 'pending';
    return {
      runId,
      goalId: input.goalId ?? `goal-${generateId()}`,
      planId: input.planId ?? input.plan.planId,
      userId: input.userId,
      goal: input.goal,
      plan: input.plan,
      state: 'EXECUTING',
      stateHistory: ['EXECUTING'],
      observations: [],
      decisionRecords: [],
      executedActions: [],
      stepStatus,
      verificationResults: [],
      usage: freshUsage(),
      budget: { ...DEFAULT_AGENT_RUN_BUDGET, ...(input.budget ?? {}) },
      loopBudgets: { ...DEFAULT_ADAPTIVE_LOOP_BUDGETS, ...(input.loopBudgets ?? {}) },
      autonomyLevel: input.autonomyLevel ?? 'SUPERVISED',
      allowedTools: input.allowedTools ?? [],
      grantedPermissionClasses: input.grantedPermissionClasses ?? ['READ'],
      revisedInstructions: {},
      stepAttempts: {},
      currentStepId: input.startStepId,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Run until terminal or WAITING_FOR_APPROVAL (resumable). */
  async run(run: AdaptiveRun): Promise<AdaptiveRun> {
    if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return run;
    this.passStartedMs = this.deps.clock.timestampMs();
    if (run.state === 'WAITING_FOR_APPROVAL') return this.resumeAfterApproval(run);
    await this.executeLoop(run);
    return run;
  }

  /** Resume a WAITING_FOR_APPROVAL run after an explicit human decision. */
  async resume(run: AdaptiveRun): Promise<AdaptiveRun> {
    if (run.state !== 'WAITING_FOR_APPROVAL') {
      this.terminate(
        run,
        'FAILED_FINAL',
        'INVALID_DECISION',
        `cannot resume a run in state ${run.state}`,
      );
      return run;
    }
    return this.resumeAfterApproval(run);
  }

  // ── The adaptive loop ───────────────────────────────────────────

  private async executeLoop(run: AdaptiveRun): Promise<void> {
    for (;;) {
      if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return;

      const guard = checkLoopBudgets(
        { usage: run.usage, budgets: run.loopBudgets, startedAtMs: this.passStartedMs },
        this.deps.clock,
      );
      if (!guard.ok) {
        this.terminate(run, 'FAILED_FINAL', guard.reason, guard.detail);
        return;
      }

      // Fail unreachable steps explicitly (dependency that never completed).
      const stuck = this.stuckSteps(run);
      if (stuck.length > 0) {
        for (const stepId of stuck) run.stepStatus[stepId] = 'blocked';
        this.terminate(
          run,
          'BLOCKED',
          'VERIFICATION_BLOCKED',
          `unreachable step(s): ${stuck.join(', ')}`,
        );
        return;
      }

      const next = pickNextPendingStep(run);
      if (next === undefined) {
        await this.finishRun(run);
        return;
      }
      const step = run.plan.steps.find((s) => s.stepId === next.stepId);
      if (step === undefined) {
        this.terminate(run, 'BLOCKED', 'INVALID_DECISION', `step ${next.stepId} not found in plan`);
        return;
      }
      run.currentStepId = step.stepId;
      run.stepStatus[step.stepId] = 'executing';
      this.deps.onUpdate?.(run);

      // ── DECIDING ───────────────────────────────────────────────
      const decision = await this.consult(run, step);
      if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return;
      if (run.state === 'WAITING_FOR_APPROVAL') return;

      // ── VALIDATING ─────────────────────────────────────────────
      const validation = this.validate(run, step, decision);
      if (!validation.ok) {
        this.recordDecision(run, step, decision, 'BLOCKED', validation.rejectionReasons);
        this.terminate(
          run,
          'BLOCKED',
          this.reasonForRejection(decision, validation.rejectionReasons),
          validation.rejectionReasons.join('; '),
        );
        return;
      }

      // ── GOVERNANCE → ACTION (or a governed state transition) ──
      // dispatch() itself pauses at approval gates (returns 'terminal');
      // nothing after this line may run while WAITING_FOR_APPROVAL.
      const handled = await this.dispatch(run, step, decision, validation);
      if (handled === 'terminal') return;
    }
  }

  // ── Decision consultation ───────────────────────────────────────

  private async consult(run: AdaptiveRun, step: AgentPlanStep): Promise<AdaptiveDecision> {
    if (this.deps.decisionModel === undefined) {
      return this.decision(
        'CONTINUE',
        step.stepId,
        'deterministic mode — execute the declared plan',
      );
    }
    // Guard BEFORE counting a consult: the model is never asked when any
    // budget is already exhausted (PHASE 10 — "do not ask the model for
    // another action").
    const guard = checkLoopBudgets(
      { usage: run.usage, budgets: run.loopBudgets, startedAtMs: this.passStartedMs },
      this.deps.clock,
    );
    if (!guard.ok) {
      this.terminate(run, 'FAILED_FINAL', guard.reason, guard.detail);
      return this.decision('ABSTAIN', step.stepId, guard.detail);
    }
    run.usage.decisionIterations += 1;
    const context = buildDecisionContext({
      run,
      currentStep: {
        stepId: step.stepId,
        objective: step.objective,
        capability: step.capability,
        requiredCapabilities: step.requiredCapabilities,
      },
      allowedCapabilities: allowedCapabilitiesForStep(run.plan, step),
      toolRegistry: this.deps.toolRegistry,
      verificationSummaries: run.verificationResults,
    });
    this.transition(run, 'DECIDING');

    let result;
    try {
      result = await this.deps.decisionModel.decide(context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.recordDecision(run, step, this.decision('ABSTAIN', step.stepId, message), 'REJECTED', [
        sanitizeTraceText(message, { maxLength: 200 }),
      ]);
      return this.decision('ABSTAIN', step.stepId, 'decision model failure — abstaining honestly');
    }

    run.usage.tokensUsed += result.tokens?.total ?? 0;
    run.usage.costUsd += result.costUsd ?? 0;
    run.usage.latencyMs += result.latencyMs ?? 0;

    if (result.abstained === true || result.error !== undefined) {
      const reason =
        result.error !== undefined
          ? sanitizeTraceText(result.error, { maxLength: 200 })
          : 'runtime abstained (evidence-first)';
      this.recordDecision(run, step, this.decision('ABSTAIN', step.stepId, reason), 'REJECTED', [
        reason,
      ]);
      return this.decision('ABSTAIN', step.stepId, reason);
    }

    const raw = result.content ?? '';
    if (raw.trim().length === 0) {
      this.recordDecision(
        run,
        step,
        this.decision('ABSTAIN', step.stepId, 'empty decision output'),
        'REJECTED',
        ['the decision model returned empty output'],
      );
      return this.decision('ABSTAIN', step.stepId, 'empty output');
    }

    // Model output is UNTRUSTED — parse defensively before use.
    const parsed = parseDecisionProposal(raw);
    if (!parsed.ok) {
      this.recordDecision(
        run,
        step,
        this.decision('ABSTAIN', step.stepId, 'malformed'),
        'REJECTED',
        parsed.errors,
      );
      return this.decision('ABSTAIN', step.stepId, parsed.errors.slice(0, 2).join('; '));
    }
    return parsed.decision;
  }

  private validate(
    run: AdaptiveRun,
    step: AgentPlanStep,
    decision: AdaptiveDecision,
  ): {
    ok: boolean;
    rejectionReasons: string[];
    permissionClass?: string;
    requiresApproval: boolean;
  } {
    const ctx: DecisionValidationContext = {
      plan: run.plan,
      currentStep: step,
      allowedCapabilities: allowedCapabilitiesForStep(run.plan, step),
      allowedTools: run.allowedTools,
      grantedPermissionClasses: run.grantedPermissionClasses,
      toolRegistry: this.deps.toolRegistry,
      autonomyLevel: run.autonomyLevel,
      revisionsRemaining: Math.max(run.loopBudgets.maxRevisions - run.usage.revisions, 0),
      replansRemaining: Math.max(run.loopBudgets.maxReplans - run.usage.replans, 0),
    };
    const result = validateDecision(decision, ctx);
    return {
      ok: result.ok,
      rejectionReasons: result.rejectionReasons,
      permissionClass: result.permissionClass,
      requiresApproval: result.requiresApproval,
    };
  }

  private reasonForRejection(
    decision: AdaptiveDecision,
    rejectionReasons: string[],
  ): AdaptiveTerminationReason {
    const joined = rejectionReasons.join(' ');
    const explicit: AdaptiveTerminationReason[] = [
      'CAPABILITY_ESCALATION',
      'PERMISSION_ESCALATION',
      'BUDGET_ESCALATION',
      'AUTONOMY_ESCALATION',
      'REVISION_BUDGET_EXCEEDED',
      'REPLAN_BUDGET_EXCEEDED',
      'UNAUTHORIZED_TOOL',
      'TOOL_UNAVAILABLE',
      'PERMISSION_DENIED',
      'VERIFICATION_BLOCKED',
    ];
    for (const reason of explicit) {
      if (joined.includes(reason)) return reason;
    }
    switch (decision.kind) {
      case 'REVISE_STEP':
        return 'REVISION_BUDGET_EXCEEDED';
      case 'REPLAN':
        return 'REPLAN_BUDGET_EXCEEDED';
      case 'TOOL_CALL':
        return 'TOOL_UNAVAILABLE';
      default:
        return 'INVALID_DECISION';
    }
  }

  // ── Dispatch: the validated decision becomes one governed step ──

  private async dispatch(
    run: AdaptiveRun,
    step: AgentPlanStep,
    decision: AdaptiveDecision,
    validation: { ok: boolean; permissionClass?: string; requiresApproval: boolean },
  ): Promise<'continue' | 'terminal'> {
    switch (decision.kind) {
      case 'CONTINUE': {
        this.recordDecision(run, step, decision, 'APPROVED', []);
        const executed = await this.executeNextDeclared(run, step);
        if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return 'terminal';
        if (run.state === 'WAITING_FOR_APPROVAL') return 'terminal';
        if (executed === 'none-left') {
          // All declared actions done → verify the step with frozen machinery.
          await this.verifyOrRecover(run, step);
          if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return 'terminal';
        } else if (executed !== 'ok') {
          // Declared action failed → bounded recovery (never permission retry).
          this.handleActionFailure(run, step, executed, this.lastProposal(run, step));
          if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return 'terminal';
        }
        return 'continue';
      }
      case 'TOOL_CALL':
      case 'AI_ACTION': {
        this.recordDecision(run, step, decision, 'APPROVED', []);
        const proposal = this.buildProposal(run, step, decision, validation.permissionClass);
        if (proposal.requiresApproval && !this.approvalDecided(run, proposal.proposalId)) {
          return this.pauseForApproval(run, step, proposal);
        }
        const outcome = await this.executeProposal(run, step, proposal);
        if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return 'terminal';
        if (outcome !== 'ok') {
          this.handleActionFailure(run, step, outcome, proposal);
          if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return 'terminal';
        }
        return 'continue';
      }
      case 'VERIFY': {
        this.recordDecision(run, step, decision, 'APPROVED', []);
        await this.verifyOrRecover(run, step);
        return ADAPTIVE_TERMINAL_STATES.includes(run.state) ? 'terminal' : 'continue';
      }
      case 'COMPLETE': {
        // A model saying "complete" is NOT evidence of completion.
        this.recordDecision(run, step, decision, 'APPROVED', []);
        const allVerified = Object.values(run.stepStatus).every((s) => s === 'verified');
        if (!allVerified) {
          this.terminate(
            run,
            'FAILED_FINAL',
            'VERIFICATION_BLOCKED',
            'the model declared COMPLETE but not every step is VERIFIED — completion without verification evidence is refused',
          );
          return 'terminal';
        }
        await this.finishRun(run);
        return 'terminal';
      }
      case 'FAIL': {
        this.recordDecision(run, step, decision, 'APPROVED', []);
        this.terminate(
          run,
          'FAILED_FINAL',
          'FAIL_DECISION',
          decision.failReason ?? decision.rationale,
        );
        return 'terminal';
      }
      case 'REQUEST_APPROVAL': {
        this.recordDecision(run, step, decision, 'APPROVED', []);
        // The model cannot approve itself — pause at an explicit human gate.
        const proposal: ActionProposal = {
          proposalId: `proposal-${generateId()}`,
          decisionId: decision.decisionId,
          kind: 'AI_ACTION',
          stepId: step.stepId,
          actionId: `ai-${generateId()}`,
          capability: decision.capability ?? step.capability ?? 'reasoning',
          requiredCapabilities: decision.requiredCapabilities ?? [
            decision.capability ?? step.capability ?? 'reasoning',
          ],
          instruction: this.instructionFor(run, step),
          requiresApproval: true,
        };
        return this.pauseForApproval(run, step, proposal);
      }
      case 'REVISE_STEP': {
        if (run.usage.revisions >= run.loopBudgets.maxRevisions) {
          this.recordDecision(run, step, decision, 'BLOCKED', ['REVISION_BUDGET_EXCEEDED']);
          this.terminate(run, 'FAILED_FINAL', 'REVISION_BUDGET_EXCEEDED', 'no revisions remain');
          return 'terminal';
        }
        run.usage.revisions += 1;
        const instruction =
          decision.reviseInstruction !== undefined
            ? decision.reviseInstruction
            : 'Revise the approach: the previous attempt did not satisfy the step. Change your method; do not repeat the same output.';
        run.revisedInstructions[step.stepId] = sanitizeTraceText(instruction, { maxLength: 800 });
        // REVISE_STEP touches ONLY the approach context — never permissions,
        // capability authority, allowedTools, autonomy, budgets or governance.
        this.actionCursor.set(step.stepId, 0);
        this.recordDecision(run, step, decision, 'APPROVED', []);
        run.stepStatus[step.stepId] = 'executing';
        return 'continue';
      }
      case 'REPLAN': {
        if (run.usage.replans >= run.loopBudgets.maxReplans) {
          this.recordDecision(run, step, decision, 'BLOCKED', ['REPLAN_BUDGET_EXCEEDED']);
          this.terminate(run, 'FAILED_FINAL', 'REPLAN_BUDGET_EXCEEDED', 'no replans remain');
          return 'terminal';
        }
        if (this.deps.planner === undefined) {
          this.recordDecision(run, step, decision, 'BLOCKED', ['no planner port wired']);
          this.terminate(
            run,
            'BLOCKED',
            'INVALID_DECISION',
            'REPLAN requested but no planner port is wired',
          );
          return 'terminal';
        }
        const result = await this.deps.planner.replan({
          userId: run.userId,
          goal: run.goal,
          allowedCapabilities: allowedCapabilitiesForStep(run.plan),
          allowedTools: run.allowedTools,
          grantedPermissionClasses: [...run.grantedPermissionClasses],
          autonomyLevel: run.autonomyLevel,
          budget: { ...run.budget },
          replanReason: decision.replanReason,
        });
        if (result.plan === undefined || result.readiness.status !== 'READY') {
          this.recordDecision(run, step, decision, 'BLOCKED', ['replan not READY']);
          this.terminate(
            run,
            'BLOCKED',
            'INVALID_DECISION',
            `replan not READY: ${result.readiness.blockedReasons.join('; ')}`,
          );
          return 'terminal';
        }
        // A replan is a NEW PROPOSAL, never a new authority level.
        if (!this.replanPreservesAuthority(run, result.plan)) {
          this.recordDecision(run, step, decision, 'BLOCKED', [
            'replan widened capability/tool authority',
          ]);
          this.terminate(
            run,
            'BLOCKED',
            'CAPABILITY_ESCALATION',
            'replan attempted to widen capability or tool authority',
          );
          return 'terminal';
        }
        run.usage.replans += 1;
        this.recordDecision(run, step, decision, 'APPROVED', []);
        run.plan = result.plan;
        run.planId = result.plan.planId;
        run.stepStatus = {};
        for (const s of result.plan.steps) run.stepStatus[s.stepId] = 'pending';
        run.verificationResults = [];
        run.currentStepId = result.plan.steps[0]?.stepId;
        this.actionCursor.clear();
        return 'continue';
      }
      case 'ABSTAIN': {
        // Honest abstention — never fabricate an action. The loop re-consults
        // (bounded by maxAbstains in the loop guard).
        this.recordDecision(run, step, decision, 'REJECTED', [
          decision.abstainReason ?? 'abstained',
        ]);
        run.usage.abstains += 1;
        return 'continue';
      }
      default:
        this.recordDecision(run, step, decision, 'BLOCKED', ['unsupported decision kind']);
        this.terminate(run, 'BLOCKED', 'INVALID_DECISION', 'unsupported decision kind');
        return 'terminal';
    }
  }

  // ── Declared-action execution (the deterministic baseline) ──────

  private async executeNextDeclared(
    run: AdaptiveRun,
    step: AgentPlanStep,
  ): Promise<ActionOutcome | 'none-left'> {
    const cursor = this.actionCursor.get(step.stepId) ?? 0;
    const action = step.actions[cursor];
    if (action === undefined) return 'none-left';

    const proposal: ActionProposal = this.proposalFromDeclared(run, step, action);
    // Governance applies to declared actions too (high-risk classes always
    // gate at every autonomy level).
    if (proposal.requiresApproval && !this.approvalDecided(run, proposal.proposalId)) {
      this.pauseForApproval(run, step, proposal);
      return 'none-left';
    }
    const outcome = await this.executeProposal(run, step, proposal);
    if (outcome === 'ok') {
      this.actionCursor.set(step.stepId, cursor + 1);
    }
    return outcome;
  }

  private proposalFromDeclared(
    run: AdaptiveRun,
    step: AgentPlanStep,
    action: AgentPlanStep['actions'][number],
  ): ActionProposal {
    if (action.kind === 'ai') {
      return {
        proposalId: `proposal-${generateId()}`,
        decisionId: 'declared',
        kind: 'AI_ACTION',
        stepId: step.stepId,
        actionId: action.actionId,
        capability: action.capability,
        requiredCapabilities:
          action.requiredCapabilities !== undefined && action.requiredCapabilities.length > 0
            ? action.requiredCapabilities
            : [action.capability],
        instruction: this.instructionFor(run, step, action.instruction),
        requiresApproval: false,
      };
    }
    const info = this.deps.toolRegistry?.describe(action.toolName);
    const caps = allowedCapabilitiesForStep(run.plan, step);
    return {
      proposalId: `proposal-${generateId()}`,
      decisionId: 'declared',
      kind: 'TOOL_CALL',
      stepId: step.stepId,
      actionId: action.actionId,
      capability: caps[0] ?? 'reasoning',
      requiredCapabilities: caps,
      toolName: action.toolName,
      arguments: action.arguments,
      permissionClass: info?.permissionClass,
      requiresApproval: this.requiresApproval(run, action.toolName, info?.permissionClass),
    };
  }

  /**
   * Execute one ActionProposal. The ONLY execution paths are the frozen
   * AgentAiExecutionPort and AgentToolExecutionPort (ToolRuntime chain).
   */
  private async executeProposal(
    run: AdaptiveRun,
    step: AgentPlanStep,
    proposal: ActionProposal,
  ): Promise<ActionOutcome> {
    // Hard ceiling BEFORE execution.
    if (run.usage.attempts >= run.loopBudgets.maxActions) {
      this.terminate(
        run,
        'FAILED_FINAL',
        'ACTION_BUDGET_EXCEEDED',
        'action budget exhausted — no further actions execute',
      );
      return 'budget';
    }

    // Deterministic repetition detection (never delegated to the model).
    const fingerprint = fingerprintDecision({
      kind: proposal.kind,
      stepId: step.stepId,
      tool: proposal.toolName,
      capability: proposal.capability,
      argumentsHash: hashArguments(proposal.arguments),
    });
    const loop = detectLoop(run.usage, fingerprint, run.loopBudgets.loopThreshold);
    if (loop.looped) {
      this.terminate(
        run,
        'FAILED_FINAL',
        'LOOP_DETECTED',
        `identical action repeated ${loop.repeated} times — deterministic loop detection`,
      );
      return 'budget';
    }

    run.usage.attempts += 1;
    run.stepAttempts[step.stepId] = (run.stepAttempts[step.stepId] ?? 0) + 1;
    run.executedActions.push(proposal);
    this.transition(run, 'EXECUTING');
    this.deps.onUpdate?.(run);

    if (proposal.kind === 'AI_ACTION') {
      return this.executeAiAction(run, step, proposal);
    }
    return this.executeToolCall(run, step, proposal);
  }

  private async executeAiAction(
    run: AdaptiveRun,
    step: AgentPlanStep,
    proposal: ActionProposal,
  ): Promise<ActionOutcome> {
    const ai = this.deps.ai;
    if (ai === undefined) {
      this.observe(
        run,
        step,
        proposal,
        'blocked',
        'no AgentAiExecutionPort wired — AI action cannot execute',
      );
      return 'blocked';
    }
    try {
      const result = await ai.execute({
        actionId: proposal.actionId,
        stepId: step.stepId,
        goalId: run.goalId,
        planId: run.planId,
        userId: run.userId,
        capability: proposal.capability,
        requiredCapabilities: proposal.requiredCapabilities,
        qualityTier: 'standard',
        instruction: proposal.instruction ?? step.objective,
        attempt: run.stepAttempts[step.stepId] ?? 1,
        revision: run.usage.revisions,
        fallbackExpected: false,
        expectedOutcome: step.expectedOutcome,
        previousObservations: run.observations
          .filter((o) => o.stepId === step.stepId)
          .slice(-5)
          .map((o) => `${o.status}: ${o.resultSummary}`),
      });
      run.usage.tokensUsed += result.tokens?.total ?? 0;
      run.usage.costUsd += result.costUsd ?? 0;
      run.usage.latencyMs += result.latencyMs ?? 0;
      const now = this.deps.clock.now();
      if (result.abstained === true) {
        this.observe(run, step, proposal, 'blocked', 'the AI runtime abstained (evidence-first)');
        return 'failed';
      }
      if (
        result.error !== undefined ||
        result.content === undefined ||
        result.content.length === 0
      ) {
        this.observe(
          run,
          step,
          proposal,
          'failed',
          result.error ?? 'AI action produced no content',
        );
        return 'failed';
      }
      run.observations.push(
        normalizeObservation({
          runId: run.runId,
          actionId: proposal.actionId,
          stepId: step.stepId,
          attempt: run.usage.attempts,
          status: 'succeeded',
          resultSummary: result.content,
          artifacts: [],
          provider: result.provider,
          model: result.model,
          capability: proposal.capability,
          observedAt: now,
          structured: { content: result.content },
        }),
      );
      this.transition(run, 'OBSERVING');
      this.deps.onUpdate?.(run);
      return 'ok';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.observe(run, step, proposal, 'failed', message);
      return 'failed';
    }
  }

  private async executeToolCall(
    run: AdaptiveRun,
    step: AgentPlanStep,
    proposal: ActionProposal,
  ): Promise<ActionOutcome> {
    const tools = this.deps.tools;
    if (tools === undefined) {
      this.observe(
        run,
        step,
        proposal,
        'blocked',
        'no AgentToolExecutionPort wired — tool call cannot execute',
      );
      return 'blocked';
    }
    if (proposal.toolName === undefined) {
      this.observe(run, step, proposal, 'blocked', 'TOOL_CALL proposal missing a tool name');
      return 'blocked';
    }
    // Tool-call budget — bounded BEFORE the call.
    if (run.usage.toolCalls >= run.loopBudgets.maxToolCalls) {
      this.terminate(
        run,
        'FAILED_FINAL',
        'TOOL_CALL_BUDGET_EXCEEDED',
        'tool-call budget exhausted',
      );
      return 'budget';
    }
    try {
      const result = await tools.execute({
        toolName: proposal.toolName,
        arguments: proposal.arguments ?? {},
        userId: run.userId,
      });
      run.usage.toolCalls += 1;
      const now = this.deps.clock.now();
      const info = this.deps.toolRegistry?.describe(proposal.toolName);
      if (result.denied) {
        // PERMISSION DENIAL IS NEVER RETRIED AND NEVER BYPASSED.
        run.observations.push(
          normalizeObservation({
            runId: run.runId,
            actionId: proposal.actionId,
            stepId: step.stepId,
            attempt: run.usage.attempts,
            status: 'denied',
            resultSummary:
              result.error ?? `tool "${proposal.toolName}" was denied by the security policy`,
            error: result.error,
            denied: true,
            artifacts: [],
            toolName: proposal.toolName,
            capability: proposal.capability,
            observedAt: now,
          }),
        );
        this.transition(run, 'OBSERVING');
        this.deps.onUpdate?.(run);
        this.terminate(
          run,
          'BLOCKED',
          'PERMISSION_DENIED',
          `tool "${proposal.toolName}" denied by the security policy — execution stops, never bypassed`,
        );
        return 'denied';
      }
      if (!result.ok) {
        run.observations.push(
          normalizeObservation({
            runId: run.runId,
            actionId: proposal.actionId,
            stepId: step.stepId,
            attempt: run.usage.attempts,
            status: 'failed',
            resultSummary: result.error ?? `tool "${proposal.toolName}" failed`,
            error: result.error,
            artifacts: result.artifacts,
            toolName: proposal.toolName,
            capability: proposal.capability,
            observedAt: now,
          }),
        );
        this.transition(run, 'OBSERVING');
        this.deps.onUpdate?.(run);
        void info;
        return 'failed';
      }
      run.observations.push(
        normalizeObservation({
          runId: run.runId,
          actionId: proposal.actionId,
          stepId: step.stepId,
          attempt: run.usage.attempts,
          status: 'succeeded',
          resultSummary: result.outcome,
          artifacts: result.artifacts,
          toolName: proposal.toolName,
          capability: proposal.capability,
          observedAt: now,
        }),
      );
      this.transition(run, 'OBSERVING');
      this.deps.onUpdate?.(run);
      return 'ok';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.observe(run, step, proposal, 'failed', message);
      return 'failed';
    }
  }

  /** Normalized + sanitized observation (only what the next decision needs). */
  private lastProposal(run: AdaptiveRun, step: AgentPlanStep): ActionProposal {
    const proposals = run.executedActions.filter((p) => p.stepId === step.stepId);
    const last = proposals[proposals.length - 1];
    return (
      last ?? {
        proposalId: 'declared',
        decisionId: 'declared',
        kind: 'AI_ACTION',
        stepId: step.stepId,
        actionId: 'declared',
        capability: 'reasoning',
        requiredCapabilities: ['reasoning'],
        requiresApproval: false,
      }
    );
  }

  private observe(
    run: AdaptiveRun,
    step: AgentPlanStep,
    proposal: ActionProposal,
    status: 'succeeded' | 'failed' | 'denied' | 'blocked',
    text: string,
  ): void {
    run.observations.push(
      normalizeObservation({
        runId: run.runId,
        actionId: proposal.actionId,
        stepId: step.stepId,
        attempt: run.usage.attempts,
        status,
        resultSummary: text,
        error: status === 'succeeded' ? undefined : text,
        artifacts: [],
        toolName: proposal.toolName,
        capability: proposal.capability,
        observedAt: this.deps.clock.now(),
      }),
    );
    this.transition(run, 'OBSERVING');
    this.deps.onUpdate?.(run);
  }

  // ── Verification (frozen machinery — UNKNOWN is never success) ──

  private async verifyOrRecover(run: AdaptiveRun, step: AgentPlanStep): Promise<void> {
    this.transition(run, 'VERIFYING');
    const stepObservations = run.observations.filter((o) => o.stepId === step.stepId);
    const output = sanitizeTraceText(
      stepObservations
        .filter((o) => o.status === 'succeeded')
        .map((o) => o.resultSummary)
        .join('\n'),
      { maxLength: 16_000 },
    );
    const policy: VerificationPolicy | undefined = step.verificationPolicy;
    const result = await verifyAgainstPolicy(
      policy,
      {
        output,
        artifacts: stepObservations.flatMap((o) => o.artifacts),
        observations: stepObservations,
      },
      { tools: this.deps.tools, modelVerifier: this.deps.modelVerifier },
    );
    const summary: VerificationSummary = {
      stepId: step.stepId,
      verdict: result.verdict,
      reasons: result.reasons,
    };
    const existing = run.verificationResults.findIndex((r) => r.stepId === step.stepId);
    if (existing >= 0) run.verificationResults[existing] = summary;
    else run.verificationResults.push(summary);
    this.deps.onUpdate?.(run);

    if (result.verdict === 'VERIFIED') {
      run.stepStatus[step.stepId] = 'verified';
      this.deps.onUpdate?.(run);
      return;
    }
    if (result.verdict === 'UNKNOWN' && step.recoveryPolicy?.acceptUnknown === true) {
      // Deliberate explicit acceptance — never silent, and the goal can
      // never be ACHIEVED from UNKNOWN alone (see finishRun).
      run.stepStatus[step.stepId] = 'verified';
      const last = run.verificationResults[run.verificationResults.length - 1];
      if (last) last.reasons.push('UNKNOWN explicitly accepted by step recovery policy');
      this.deps.onUpdate?.(run);
      return;
    }
    if (result.verdict === 'BLOCKED') {
      run.stepStatus[step.stepId] = 'blocked';
      this.terminate(
        run,
        'BLOCKED',
        'VERIFICATION_BLOCKED',
        `verification blocked: ${result.reasons.join('; ')}`,
      );
      return;
    }
    this.recoverFromVerification(run, step, result.verdict);
  }

  /** Bounded recovery — reuses the frozen decideRecovery strategy. */
  private recoverFromVerification(
    run: AdaptiveRun,
    step: AgentPlanStep,
    verdict: 'FAILED' | 'PARTIAL' | 'UNKNOWN',
  ): void {
    this.transition(run, 'RECOVERING');
    const attempts = run.stepAttempts[step.stepId] ?? 0;
    const recovery = decideRecovery({
      verdict,
      hasAi: step.actions.some((a) => a.kind === 'ai'),
      hasTools: step.actions.some((a) => a.kind === 'tool'),
      attempts,
      revisions: run.usage.revisions,
      policy: step.recoveryPolicy,
      maxAttempts: step.recoveryPolicy?.maxAttempts ?? run.budget.maxAttemptsPerStep,
      maxRevisions: step.recoveryPolicy?.maxRevisions ?? run.loopBudgets.maxRevisions,
    });

    // A step with no declared actions has nothing meaningful to retry —
    // UNKNOWN is not success and re-verifying nothing can never change.
    if (step.actions.length === 0) {
      run.stepStatus[step.stepId] = 'failed';
      this.deps.onUpdate?.(run);
      return;
    }
    if (recovery.strategy === 'retry' || recovery.strategy === 'alternate_model') {
      this.actionCursor.set(step.stepId, 0);
      return;
    }
    if (recovery.strategy === 'revise_step') {
      run.usage.revisions += 1;
      run.revisedInstructions[step.stepId] =
        `${run.revisedInstructions[step.stepId] ?? ''}\nRevise the approach: the previous attempt did not satisfy verification. Change your method; do not repeat the same output.`;
      this.actionCursor.set(step.stepId, 0);
      run.stepAttempts[step.stepId] = 0;
      return;
    }
    if (recovery.strategy === 'alternate_tool') {
      // Try the first declared alternate tool, then re-verify. Bounded by
      // the frozen recovery policy and attempts (never unbounded).
      this.actionCursor.set(step.stepId, 0);
      return;
    }
    if (recovery.strategy === 'block_step') {
      run.stepStatus[step.stepId] = 'blocked';
      this.terminate(run, 'BLOCKED', 'VERIFICATION_BLOCKED', recovery.reason);
      return;
    }
    // fail_step — honest failure after bounded recovery.
    run.stepStatus[step.stepId] = 'failed';
    this.deps.onUpdate?.(run);
  }

  /** Action-level failure handling (permission/budget NEVER retried). */
  private handleActionFailure(
    run: AdaptiveRun,
    step: AgentPlanStep,
    outcome: ActionOutcome,
    proposal: ActionProposal,
  ): void {
    if (outcome === 'budget' || outcome === 'denied' || outcome === 'blocked') {
      if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return;
      run.stepStatus[step.stepId] = 'failed';
      this.deps.onUpdate?.(run);
      return;
    }
    // TRANSIENT failure → bounded retry through the frozen recovery helper.
    this.transition(run, 'RECOVERING');
    const attempts = run.stepAttempts[step.stepId] ?? 0;
    const recovery = decideRecovery({
      aiFailed: proposal.kind === 'AI_ACTION',
      toolFailed: proposal.kind === 'TOOL_CALL',
      abstained: false,
      hasAi: proposal.kind === 'AI_ACTION',
      hasTools: proposal.kind === 'TOOL_CALL',
      attempts,
      revisions: run.usage.revisions,
      policy: step.recoveryPolicy,
      maxAttempts: step.recoveryPolicy?.maxAttempts ?? run.budget.maxAttemptsPerStep,
      maxRevisions: step.recoveryPolicy?.maxRevisions ?? run.loopBudgets.maxRevisions,
    });
    if (
      recovery.strategy === 'retry' ||
      recovery.strategy === 'alternate_model' ||
      recovery.strategy === 'alternate_tool'
    ) {
      // Re-execute the same action (attempts are bounded by maxAttempts).
      return;
    }
    if (recovery.strategy === 'revise_step') {
      if (run.usage.revisions < run.loopBudgets.maxRevisions) {
        run.usage.revisions += 1;
        run.revisedInstructions[step.stepId] =
          `${run.revisedInstructions[step.stepId] ?? ''}\nRevise the approach after a failure: change your method; do not repeat the same output.`;
      }
      this.actionCursor.set(step.stepId, 0);
      return;
    }
    run.stepStatus[step.stepId] = 'failed';
    this.deps.onUpdate?.(run);
  }

  // ── Finish: verification-aware goal judgment ────────────────────

  private async finishRun(run: AdaptiveRun): Promise<void> {
    const statuses = Object.values(run.stepStatus);
    const hasBlocked = statuses.some((s) => s === 'blocked');
    const hasFailed = statuses.some((s) => s === 'failed');
    const hasPending = statuses.some((s) => s === 'pending' || s === 'executing');

    if (hasBlocked) {
      this.terminate(run, 'BLOCKED', 'VERIFICATION_BLOCKED', 'one or more steps are blocked');
      return;
    }
    if (hasFailed) {
      this.terminate(
        run,
        'FAILED_FINAL',
        'RECOVERY_EXHAUSTED',
        'one or more steps failed after bounded recovery',
      );
      return;
    }
    if (hasPending) {
      this.terminate(
        run,
        'FAILED_FINAL',
        'RECOVERY_EXHAUSTED',
        'the loop ended with steps that never completed — no fabricated success',
      );
      return;
    }

    // Goal-level completion criteria (final verification) — distinct from
    // step verification. Only this may make the goal ACHIEVED.
    const acceptedUnknown = run.verificationResults.some(
      (v) => v.stepId !== '__final__' && v.verdict === 'UNKNOWN',
    );
    const finalPolicy = run.plan.finalVerification;
    if (finalPolicy !== undefined) {
      const all = run.observations.filter((o) => o.status === 'succeeded');
      const result = await verifyAgainstPolicy(
        finalPolicy,
        {
          output: sanitizeTraceText(all.map((o) => o.resultSummary).join('\n'), {
            maxLength: 16_000,
          }),
          artifacts: all.flatMap((o) => o.artifacts),
          observations: run.observations,
        },
        { tools: this.deps.tools, modelVerifier: this.deps.modelVerifier },
      );
      run.verificationResults.push({
        stepId: '__final__',
        verdict: result.verdict,
        reasons: result.reasons,
      });
      if (result.verdict !== 'VERIFIED') {
        this.terminate(
          run,
          'FAILED_FINAL',
          'VERIFICATION_BLOCKED',
          `final goal verification ${result.verdict}: ${result.reasons.join('; ')}`,
        );
        return;
      }
      run.outcome = 'ACHIEVED';
      run.terminationReason = 'GOAL_VERIFIED';
      run.finishedAt = this.deps.clock.now();
      this.transition(run, 'VERIFIED');
      this.deps.onUpdate?.(run);
      return;
    }
    if (acceptedUnknown) {
      // Steps passed with explicitly-accepted UNKNOWN verdicts — the goal is
      // PARTIALLY_ACHIEVED, never a fabricated ACHIEVED.
      run.outcome = 'PARTIALLY_ACHIEVED';
      run.terminationReason = 'GOAL_VERIFIED';
      run.finishedAt = this.deps.clock.now();
      this.transition(run, 'COMPLETED');
      this.deps.onUpdate?.(run);
      return;
    }
    run.outcome = 'ACHIEVED';
    run.terminationReason = 'GOAL_VERIFIED';
    run.finishedAt = this.deps.clock.now();
    this.transition(run, 'VERIFIED');
    this.deps.onUpdate?.(run);
  }

  // ── Approvals (governance is authoritative) ─────────────────────

  private requiresApproval(run: AdaptiveRun, toolName: string, permissionClass?: string): boolean {
    if (run.autonomyLevel === 'ASSISTED') return true;
    const info = this.deps.toolRegistry?.describe(toolName);
    if (info?.requiresApproval === true) return true;
    if (
      permissionClass !== undefined &&
      (HIGH_RISK_PERMISSION_CLASSES as readonly string[]).includes(permissionClass)
    ) {
      return true;
    }
    return false;
  }

  private approvalDecided(run: AdaptiveRun, proposalId: string): boolean {
    return this.deps.approvals.decision(run.runId, proposalId)?.decision === 'approved';
  }

  private pauseForApproval(
    run: AdaptiveRun,
    step: AgentPlanStep,
    proposal: ActionProposal,
  ): 'terminal' {
    run.pendingApprovalProposal = proposal;
    run.pendingApprovalReason =
      proposal.toolName !== undefined
        ? `tool "${proposal.toolName}" requires explicit human approval`
        : 'explicit human approval requested';
    this.deps.approvals.request({
      runId: run.runId,
      proposalId: proposal.proposalId,
      decisionId: proposal.decisionId,
      stepId: step.stepId,
      reason: run.pendingApprovalReason,
      requestedAt: this.deps.clock.now(),
    });
    this.transition(run, 'WAITING_FOR_APPROVAL');
    this.deps.onUpdate?.(run);
    return 'terminal';
  }

  private async resumeAfterApproval(run: AdaptiveRun): Promise<AdaptiveRun> {
    this.passStartedMs = this.deps.clock.timestampMs();
    const proposal = run.pendingApprovalProposal;
    if (proposal === undefined) {
      this.terminate(
        run,
        'FAILED_FINAL',
        'INVALID_DECISION',
        'WAITING_FOR_APPROVAL with no pending proposal',
      );
      return run;
    }
    const decision = this.deps.approvals.decision(run.runId, proposal.proposalId);
    if (decision === undefined) return run; // still waiting — no fabricated resume
    if (decision.decision === 'rejected') {
      run.pendingApprovalProposal = undefined;
      this.terminate(
        run,
        'FAILED_FINAL',
        'APPROVAL_REJECTED',
        `the human rejected ${proposal.proposalId}`,
      );
      return run;
    }
    run.pendingApprovalProposal = undefined;
    run.pendingApprovalReason = undefined;
    const step = run.plan.steps.find((s) => s.stepId === proposal.stepId);
    if (step === undefined) {
      this.terminate(
        run,
        'FAILED_FINAL',
        'INVALID_DECISION',
        'pending proposal references an unknown step',
      );
      return run;
    }
    this.transition(run, 'EXECUTING');
    const outcome = await this.executeProposal(run, step, proposal);
    if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return run;
    if (outcome !== 'ok') {
      this.handleActionFailure(run, step, outcome, proposal);
      if (ADAPTIVE_TERMINAL_STATES.includes(run.state)) return run;
    }
    // A paused DECLARED action was executed here — advance its cursor so the
    // resumed loop does not re-execute it a second time.
    if (proposal.decisionId === 'declared' && outcome === 'ok') {
      const cursor = this.actionCursor.get(step.stepId) ?? 0;
      this.actionCursor.set(step.stepId, cursor + 1);
    }
    await this.executeLoop(run);
    return run;
  }

  // ── Small helpers ───────────────────────────────────────────────

  private stuckSteps(run: AdaptiveRun): string[] {
    const stuck: string[] = [];
    for (const step of run.plan.steps) {
      const status = run.stepStatus[step.stepId];
      if (status === 'verified' || status === 'failed' || status === 'blocked') continue;
      const depsBlocked = step.dependencies.some(
        (depId) => run.stepStatus[depId] === 'failed' || run.stepStatus[depId] === 'blocked',
      );
      if (depsBlocked) stuck.push(step.stepId);
    }
    return stuck;
  }

  private buildProposal(
    run: AdaptiveRun,
    step: AgentPlanStep,
    decision: AdaptiveDecision,
    permissionClass: string | undefined,
  ): ActionProposal {
    if (decision.kind === 'TOOL_CALL') {
      const toolName = decision.tool ?? '';
      const info = this.deps.toolRegistry?.describe(toolName);
      const capability: CapabilityType = decision.capability ?? 'reasoning';
      const effectivePermissionClass = permissionClass ?? info?.permissionClass;
      return {
        proposalId: `proposal-${generateId()}`,
        decisionId: decision.decisionId,
        kind: 'TOOL_CALL',
        stepId: step.stepId,
        actionId: `tool-${decision.decisionId}`,
        capability,
        requiredCapabilities: decision.requiredCapabilities ?? [capability],
        toolName,
        arguments: decision.arguments,
        permissionClass: effectivePermissionClass as
          import('@vedmoulya/agent-execution').ToolPermissionClass | undefined,
        requiresApproval: this.requiresApproval(run, toolName, info?.permissionClass),
      };
    }
    const capability: CapabilityType = decision.capability ?? step.capability ?? 'reasoning';
    return {
      proposalId: `proposal-${generateId()}`,
      decisionId: decision.decisionId,
      kind: 'AI_ACTION',
      stepId: step.stepId,
      actionId: `ai-${decision.decisionId}`,
      capability,
      requiredCapabilities: decision.requiredCapabilities ?? [capability],
      instruction: this.instructionFor(run, step),
      requiresApproval: false,
    };
  }

  private instructionFor(run: AdaptiveRun, step: AgentPlanStep, base?: string): string {
    const raw = base ?? step.objective;
    let instruction = raw.replaceAll('{goal}', run.goal);
    const revision = run.revisedInstructions[step.stepId];
    if (revision !== undefined) {
      instruction = `${instruction}\n\n[Revised approach] ${revision}`;
    }
    return sanitizeTraceText(instruction, { maxLength: 4_000 });
  }

  private replanPreservesAuthority(run: AdaptiveRun, plan: AgentPlan): boolean {
    const allowedTools = new Set(run.allowedTools);
    const allowedCaps = new Set<CapabilityType>(allowedCapabilitiesForStep(run.plan));
    for (const step of plan.steps) {
      for (const action of step.actions) {
        if (action.kind === 'ai') {
          if (!allowedCaps.has(action.capability)) return false;
          for (const rc of action.requiredCapabilities ?? []) {
            if (!allowedCaps.has(rc)) return false;
          }
        } else if (!allowedTools.has(action.toolName)) {
          return false;
        }
      }
    }
    return true;
  }

  private decision(
    kind: AdaptiveDecision['kind'],
    stepId: string,
    rationale: string,
  ): AdaptiveDecision {
    return {
      decisionId: `decision-${generateId()}`,
      kind,
      rationale,
      targetStepId: stepId,
    };
  }

  private recordDecision(
    run: AdaptiveRun,
    step: AgentPlanStep,
    decision: AdaptiveDecision,
    validation: 'APPROVED' | 'REJECTED' | 'BLOCKED',
    rejectionReasons: string[],
  ): void {
    run.decisionRecords.push({
      decisionId: decision.decisionId,
      decisionKind: decision.kind,
      stepId: step.stepId,
      actionId: decision.targetStepId,
      capability: decision.capability,
      requiredCapabilities: decision.requiredCapabilities,
      tool: decision.tool,
      rationale: sanitizeTraceText(decision.rationale, { maxLength: 400 }),
      validation,
      rejectionReasons,
      attempt: run.usage.attempts,
      revision: run.usage.revisions,
      replanCount: run.usage.replans,
      decidedAt: this.deps.clock.now(),
    });
  }

  private transition(run: AdaptiveRun, state: AdaptiveRun['state']): void {
    if (run.state === state) return;
    run.state = state;
    run.stateHistory.push(state);
    run.updatedAt = this.deps.clock.now();
  }

  private terminate(
    run: AdaptiveRun,
    state: 'BLOCKED' | 'FAILED_FINAL' | 'CANCELLED',
    reason: AdaptiveTerminationReason,
    detail: string,
  ): void {
    run.outcome = state === 'BLOCKED' ? 'BLOCKED' : 'FAILED';
    run.terminationReason = reason;
    run.error = sanitizeTraceText(detail, { maxLength: 600 });
    run.finishedAt = this.deps.clock.now();
    this.transition(run, state);
    this.deps.onUpdate?.(run);
  }
}
