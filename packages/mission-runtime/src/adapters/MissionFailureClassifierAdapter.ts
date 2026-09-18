// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Failure Classification Adapter (BLD-022)
//
// The frozen MissionControllerService classifies objective failures by
// calling the injected FailureClassificationPort. The frozen domain
// classifyFailure() is text-heuristic, so an executor-reported semantic
// failure class (PERMISSION_DENIED / CAPABILITY_UNAVAILABLE / …) is
// honored deterministically here BEFORE delegating everything else to
// the frozen classifier. Nothing is duplicated: classifyFailure stays
// the authority for every case this adapter does not explicitly own.
//
// The result is that permanent conditions (a tool the security chain
// denies, a capability no provider/model offers) fail an objective
// immediately instead of burning bounded retries on an impossible retry,
// while transient/verification conditions keep the frozen recovery path.
// ──────────────────────────────────────────────────────────────────

import { classifyFailure } from '@vedmoulya/mission-controller';
import type {
  FailureClassificationPort,
  MissionFailureClassification,
  ProviderStatus,
} from '@vedmoulya/mission-controller';

/** Executor-reported failure classes that are permanent by construction. */
const NON_RECOVERABLE_CLASSES: Record<
  string,
  {
    failureClass: MissionFailureClassification['failureClass'];
    reason: string;
    suggestedAction: MissionFailureClassification['suggestedAction'];
  }
> = {
  PERMISSION_DENIED: {
    failureClass: 'PERMISSION_DENIED',
    reason:
      'Permission denied by the mission or tool security policy — cannot be resolved by retrying',
    suggestedAction: 'BLOCK',
  },
  CAPABILITY_UNAVAILABLE: {
    failureClass: 'CAPABILITY_UNAVAILABLE',
    reason:
      'Required capability is unavailable (no provider/model/tool can serve it) — cannot be resolved by retrying',
    suggestedAction: 'BLOCK',
  },
  BUDGET_EXHAUSTION: {
    failureClass: 'BUDGET_EXHAUSTION',
    reason: 'Budget exhausted — cannot continue',
    suggestedAction: 'FAIL',
  },
};

/**
 * FINAL-03A — executor-reported failure classes that are RECOVERABLE and must
 * reach the EXISTING revision/repair path rather than a blind retry.
 *
 * A `FAILED_FINAL` execution run (every bounded recovery on the plan's own
 * steps was exhausted without an achieved, verified outcome) is a
 * verification failure of the OBJECTIVE: re-running the identical plan cannot
 * help. The frozen classifier is text-heuristic and never sees run-level
 * semantics, so without this the controller would retry a deterministic
 * failure until the budget ran out instead of revising (and repairing) the
 * objective. Bounds are untouched: the revision still consumes the existing
 * retry and replan budgets.
 */
const RECOVERABLE_CLASSES: Record<
  string,
  {
    failureClass: MissionFailureClassification['failureClass'];
    reason: string;
    suggestedAction: MissionFailureClassification['suggestedAction'];
  }
> = {
  VERIFICATION_FAILURE: {
    failureClass: 'VERIFICATION_FAILURE',
    reason: 'The objective did not reach a verified outcome — the objective may need revision',
    suggestedAction: 'REVISE_OBJECTIVE',
  },
};

export class MissionFailureClassifierAdapter implements FailureClassificationPort {
  async classify(
    error: string,
    executionResult: { failureClass?: string; usage: unknown },
    providerStatus: ProviderStatus,
  ): Promise<MissionFailureClassification> {
    const reported = executionResult.failureClass;
    const mapped = reported ? NON_RECOVERABLE_CLASSES[reported] : undefined;
    if (mapped) {
      return {
        failureClass: mapped.failureClass,
        recoverable: false,
        reason: mapped.reason,
        suggestedAction: mapped.suggestedAction,
        evidence: [error].filter((part) => part.length > 0),
      };
    }
    // FINAL-03A — an executor-reported verification failure routes into the
    // EXISTING revision path (still bounded by maxRetries / maxReplans).
    const recoverable = reported ? RECOVERABLE_CLASSES[reported] : undefined;
    if (recoverable) {
      return {
        failureClass: recoverable.failureClass,
        recoverable: true,
        reason: recoverable.reason,
        suggestedAction: recoverable.suggestedAction,
        evidence: [error].filter((part) => part.length > 0),
      };
    }
    // Every other case stays with the frozen domain classifier unchanged.
    return classifyFailure(error, executionResult, providerStatus);
  }
}
