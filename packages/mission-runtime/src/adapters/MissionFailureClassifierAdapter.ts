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
    // Every other case stays with the frozen domain classifier unchanged.
    return classifyFailure(error, executionResult, providerStatus);
  }
}
