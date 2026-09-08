// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Bounded Recovery
//
// When verification fails (or an action errors), the engine NEVER simply
// retries the exact same action forever. It:
//   1. CLASSIFIES the failure (deterministic),
//   2. DECIDES one bounded strategy:
//        retry → alternate_model → alternate_tool → revise_step
//        → block_step / fail_step,
//   3. enforces hard budgets (attempts, revisions, tool calls, tokens,
//      cost, time) — no infinite loops by construction.
// ──────────────────────────────────────────────────────────────────

import type { VerificationVerdict } from '../types/agent-execution-types.js';
import type {
  FailureClass,
  RecoveryStrategyType,
  StepRecoveryPolicy,
} from '../types/agent-execution-types.js';

export interface StepAttemptFailure {
  /** Verdict of the last verification (undefined when no policy). */
  verdict?: VerificationVerdict;
  /** A tool was denied by the security chain (never bypassed). */
  toolDenied?: boolean;
  /** The required tool is not available/not allowed on this platform. */
  toolUnavailable?: boolean;
  /** The AI execution threw or returned a runtime error. */
  aiFailed?: boolean;
  /** A tool call failed (not denied — a transient tool error). */
  toolFailed?: boolean;
  /** The AI execution abstained (evidence-first — no fabrication). */
  abstained?: boolean;
  /** A hard run budget bound was exceeded. */
  budgetExceeded?: boolean;
  /** The step declares an AI action (revision can change the approach). */
  hasAi: boolean;
  /** The step declares tool actions. */
  hasTools: boolean;
  /** Current tool action toolName when a tool failed (for alternate_tool). */
  failedToolName?: string;
  /** Attempts already executed for this step (next attempt = this + 1). */
  attempts: number;
  /** Revisions already applied to this step. */
  revisions: number;
  /**
   * True when the routing-level model fallback has ALREADY been requested
   * for this step (the engine sets it after the first `alternate_model`
   * decision). The FIRST AI transient failure re-runs through routing
   * expecting a fallback model; later failures plain-retry the current
   * selection — the identical action is never blindly retried forever.
   */
  aiFallbackUsed?: boolean;
  policy?: StepRecoveryPolicy;
  /** Run-level attempt cap. */
  maxAttempts: number;
  /** Run-level revision cap. */
  maxRevisions: number;
}

export interface RecoveryDecision {
  strategy: RecoveryStrategyType;
  failureClass: FailureClass;
  reason: string;
}

/** Deterministic failure classification from the last attempt snapshot. */
export function classifyFailure(input: StepAttemptFailure): FailureClass {
  if (input.budgetExceeded) return 'BUDGET_EXCEEDED';
  if (input.toolDenied) return 'PERMISSION_DENIED';
  if (input.toolUnavailable) return 'TOOL_UNAVAILABLE';
  if (input.abstained) return 'ABSTRACTION';
  if (input.aiFailed || input.toolFailed) return 'TRANSIENT';
  if (input.verdict === 'BLOCKED') return 'PERMISSION_DENIED';
  if (input.verdict !== undefined && input.verdict !== 'VERIFIED') return 'VERIFICATION_FAILED';
  return 'UNKNOWN_FAILURE';
}

/**
 * One bounded recovery decision. All budgets are enforced here — a step can
 * retry at most `maxAttempts` times and be revised at most `maxRevisions`
 * times. There is no path that loops forever.
 */
export function decideRecovery(input: StepAttemptFailure): RecoveryDecision {
  const failureClass = classifyFailure(input);
  const alternateTools = input.policy?.alternateTools ?? [];
  const nextAttempt = input.attempts + 1;
  // `attempts` counts executions already made; one more is allowed when the
  // next attempt number stays within maxAttempts (bounded by construction).
  const canRetry = nextAttempt <= input.maxAttempts;
  const canRevise = input.revisions < input.maxRevisions;

  switch (failureClass) {
    case 'BUDGET_EXCEEDED':
      return {
        strategy: 'block_step',
        failureClass,
        reason: 'a hard run budget was exceeded — the run fails closed and does not continue',
      };
    case 'PERMISSION_DENIED':
      return {
        strategy: 'block_step',
        failureClass,
        reason:
          'the tool security chain denied execution — a model request is NOT authorization and permission is never bypassed',
      };
    case 'TOOL_UNAVAILABLE':
      if (alternateTools.length > 0) {
        return {
          strategy: 'alternate_tool',
          failureClass,
          reason: `tool "${input.failedToolName ?? '?'}" is unavailable — trying declared alternate "${alternateTools[0]}"`,
        };
      }
      return {
        strategy: 'block_step',
        failureClass,
        reason: `tool "${input.failedToolName ?? '?'}" is unavailable and no alternate tool is declared`,
      };
    case 'TRANSIENT':
      if (canRetry) {
        // The FIRST AI failure re-runs through routing expecting a model
        // fallback (aiFallbackUsed). Later AI failures plain-retry the
        // current selection — the identical call is never repeated forever.
        // Tool failures retry the same declared tool (bounded).
        return {
          strategy: input.hasAi && input.aiFallbackUsed !== true ? 'alternate_model' : 'retry',
          failureClass,
          reason:
            input.hasAi && input.aiFallbackUsed !== true
              ? 'AI execution failed transiently — re-running through routing (bounded, fallback expected)'
              : `transient failure — retrying (attempt ${String(nextAttempt)})`,
        };
      }
      return {
        strategy: 'fail_step',
        failureClass,
        reason: `transient failure persisted after ${String(input.attempts)} attempt(s) — recovery exhausted`,
      };
    case 'ABSTRACTION':
      // The runtime refused to fabricate. A revision asks for a different
      // (still evidence-honest) approach; otherwise the step fails honestly.
      if (input.hasAi && canRevise) {
        return {
          strategy: 'revise_step',
          failureClass,
          reason:
            'the runtime abstained (evidence-first) — revising the approach for a grounded attempt',
        };
      }
      if (canRetry) {
        return { strategy: 'retry', failureClass, reason: 'abstention — bounded retry' };
      }
      return {
        strategy: 'fail_step',
        failureClass,
        reason: 'the runtime abstained and recovery is exhausted — no fabricated success',
      };
    case 'VERIFICATION_FAILED': {
      const verdict = input.verdict;
      // A revision changes the APPROACH (never a blind identical retry).
      if (input.hasAi && canRevise) {
        return {
          strategy: 'revise_step',
          failureClass,
          reason: `verification ${String(verdict)} — revising the step approach (revision ${String(
            input.revisions + 1,
          )})`,
        };
      }
      if (input.hasTools && alternateTools.length > 0) {
        return {
          strategy: 'alternate_tool',
          failureClass,
          reason: `verification failed after tool "${input.failedToolName ?? '?'}" — trying alternate "${alternateTools[0]}"`,
        };
      }
      if (canRetry && verdict === 'UNKNOWN') {
        return {
          strategy: 'retry',
          failureClass,
          reason: 'verification could not be evaluated (UNKNOWN is not success) — bounded retry',
        };
      }
      return {
        strategy: 'fail_step',
        failureClass,
        reason: `verification ${String(verdict)} and recovery is exhausted — no further revisions allowed`,
      };
    }
    case 'UNKNOWN_FAILURE':
      return {
        strategy: 'fail_step',
        failureClass,
        reason: 'failure could not be classified — failing the step rather than guessing',
      };
  }
}
