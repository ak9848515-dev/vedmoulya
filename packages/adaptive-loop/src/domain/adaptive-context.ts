// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: Bounded Decision Context (PHASE 17)
//
// The model NEVER receives the entire execution history. Only a bounded,
// sanitized decision context is built: goal, current step (objective +
// capability only), recent observations (structured summaries), the
// tools the principal may actually use, allowed capabilities, remaining
// budget and verification/recovery state. Observations are bounded by
// count and length; older ones are compressed into one-line digests.
// Secrets never appear (all text passed through the frozen sanitizer
// before it reaches the model).
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { AgentToolRegistryPort } from '@vedmoulya/agent-execution';
import { sanitizeTraceText } from '@vedmoulya/agent-execution';
import type { DecisionContext } from '../contracts/adaptive-loop-ports.js';
import type {
  AdaptiveLoopBudgets,
  AdaptiveRun,
  AdaptiveRunUsage,
  VerificationSummary,
} from '../types/adaptive-loop-types.js';
import { buildBoundedObservationContext, MAX_CONTEXT_OBSERVATIONS } from './observation.js';

export interface ContextBudgetView {
  actions: number;
  toolCalls: number;
  tokens: number;
  costUsd: number;
  decisionIterations: number;
}

function remainingBudget(usage: AdaptiveRunUsage, budgets: AdaptiveLoopBudgets): ContextBudgetView {
  return {
    actions: Math.max(budgets.maxActions - usage.attempts, 0),
    toolCalls: Math.max(budgets.maxToolCalls - usage.toolCalls, 0),
    tokens: Math.max(budgets.maxTokens - usage.tokensUsed, 0),
    costUsd: Math.max(Number((budgets.maxCostUsd - usage.costUsd).toFixed(6)), 0),
    decisionIterations: Math.max(budgets.maxDecisionIterations - usage.decisionIterations, 0),
  };
}

/** Verification state digest for the current step. */
function verificationDigest(
  run: AdaptiveRun,
  stepId: string,
): import('@vedmoulya/agent-execution').VerificationVerdict | 'PENDING' {
  const result = run.verificationResults.find((r) => r.stepId === stepId);
  if (!result) return 'PENDING';
  return result.verdict;
}

/**
 * Build the bounded context handed to the decision model. All text is
 * sanitized; observations are truncated to the most recent N with a
 * compression marker for older ones (never the full transcript).
 */
export function buildDecisionContext(input: {
  run: AdaptiveRun;
  currentStep?: {
    stepId: string;
    objective: string;
    capability?: string;
    requiredCapabilities?: string[];
  };
  allowedCapabilities: CapabilityType[];
  toolRegistry?: AgentToolRegistryPort;
  verificationSummaries: VerificationSummary[];
}): DecisionContext {
  const { run, currentStep } = input;
  const principalTools = run.allowedTools;
  const registryTools = input.toolRegistry?.listAllowed() ?? [];
  // Constraint union: the principal may use a tool only when it is both
  // permitted by the principal AND exposed by the authoritative registry
  // (when a registry is wired).
  const availableTools = [
    ...new Set(
      principalTools.filter((t) => registryTools.length === 0 || registryTools.includes(t)),
    ),
  ];
  const recoveryState = {
    attempts: run.usage.attempts,
    revisions: run.usage.revisions,
    replans: run.usage.replans,
    abstains: run.usage.abstains,
  };

  return {
    userId: run.userId,
    goal: sanitizeTraceText(run.goal, { maxLength: 600 }),
    goalId: run.goalId,
    planId: run.planId,
    currentStep: currentStep
      ? {
          stepId: currentStep.stepId,
          objective: sanitizeTraceText(currentStep.objective, { maxLength: 400 }),
          capability: currentStep.capability,
          requiredCapabilities: currentStep.requiredCapabilities,
        }
      : undefined,
    recentObservations: buildBoundedObservationContext(run.observations, MAX_CONTEXT_OBSERVATIONS),
    availableTools,
    allowedCapabilities: input.allowedCapabilities,
    remainingBudget: remainingBudget(run.usage, run.loopBudgets),
    verificationState: currentStep ? verificationDigest(run, currentStep.stepId) : 'PENDING',
    recoveryState,
    allowedDecisionKinds: [
      'CONTINUE',
      'TOOL_CALL',
      'AI_ACTION',
      'VERIFY',
      'REVISE_STEP',
      'REPLAN',
      'COMPLETE',
      'FAIL',
      'REQUEST_APPROVAL',
      'ABSTAIN',
    ],
  };
}

/** Step ordering helper: next step whose dependencies are all verified. */
export function pickNextPendingStep(
  run: AdaptiveRun,
):
  | { stepId: string; objective: string; capability?: string; requiredCapabilities?: string[] }
  | undefined {
  const plan = run.plan;
  const done = (stepId: string): boolean => run.stepStatus[stepId] === 'verified';
  for (const step of plan.steps) {
    const status = run.stepStatus[step.stepId];
    if (status === 'verified' || status === 'failed' || status === 'blocked') continue;
    const depsReady = step.dependencies.every((depId) => {
      const dep = plan.steps.find((s) => s.stepId === depId);
      return dep === undefined || done(depId);
    });
    if (!depsReady) continue;
    return {
      stepId: step.stepId,
      objective: step.objective,
      capability: step.capability,
      requiredCapabilities: step.requiredCapabilities,
    };
  }
  return undefined;
}
