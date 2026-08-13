// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · Outcome Verdict
// SPRINT-024 — HONEST OUTCOME STATE (Phase 2)
//
// A single, honest, derived verdict for a realized outcome. It
// distinguishes the states the operator/user must be able to tell
// apart, and it guarantees that UNKNOWN / FAILED / AWAITING_APPROVAL /
// BUDGET_EXHAUSTED are NEVER silently converted into SUCCESS.
//
// The verdict is DERIVED from the task status + verification + decision
// records. It is a derived view over the existing outcome model — NOT a
// new engine.
// ──────────────────────────────────────────────────────────────────

import type { BrainTaskStatus } from '../types/brain-types.js';

export type OutcomeVerdict =
  'SUCCESS' | 'FAILED' | 'UNKNOWN' | 'AWAITING_APPROVAL' | 'CANCELLED' | 'BUDGET_EXHAUSTED';

export const OUTCOME_VERDICTS: readonly OutcomeVerdict[] = [
  'SUCCESS',
  'FAILED',
  'UNKNOWN',
  'AWAITING_APPROVAL',
  'CANCELLED',
  'BUDGET_EXHAUSTED',
] as const;

/** Plain-language labels for the UI (Phase 5). */
export const OUTCOME_VERDICT_LABELS: Readonly<Record<OutcomeVerdict, string>> = {
  SUCCESS: 'Completed — verified',
  FAILED: 'Execution finished, but the result could not be verified',
  UNKNOWN: 'Result could not be determined',
  AWAITING_APPROVAL: 'Waiting for your approval',
  CANCELLED: 'Cancelled',
  BUDGET_EXHAUSTED: 'Stopped — execution budget exhausted',
};

export interface OutcomeVerdictInput {
  status: BrainTaskStatus;
  /** true = verification passed; false = verification failed or inconclusive; undefined = not yet verified. */
  verificationPassed?: boolean;
  /**
   * true = verification produced a DEFINITIVE FAIL (an artifact check failed:
   * malformed / contradictory / expected artifact missing). This is the
   * difference between FAILED and UNKNOWN: definitive failures are FAILED,
   * inconclusive evidence stays UNKNOWN.
   */
  verificationFailed?: boolean;
  /** A budget-limit decision was recorded (BrainBudgetGuard trip). */
  hasBudgetDecision: boolean;
  /** At least one provider execution failed (honestly recorded). */
  hasFailedProvider: boolean;
}

/**
 * Derive the honest outcome verdict. Ordering matters (fail-closed first):
 *   AWAITING_APPROVAL / CANCELLED / BUDGET_EXHAUSTED are terminal gates;
 *   SUCCESS only when the task completed AND verification passed;
 *   FAILED when execution definitively failed OR verification produced a
 *     definitive FAIL (contradictory / malformed / expected-artifact missing);
 *   UNKNOWN whenever evidence is missing/incomplete — never upgraded.
 *
 * A COMPLETED task whose artifact verification FAILED is FAILED, never SUCCESS
 * and never masked as UNKNOWN — the verification is independent of the
 * execution claim and wins over it.
 */
export function deriveOutcomeVerdict(input: OutcomeVerdictInput): OutcomeVerdict {
  if (input.status === 'AWAITING_APPROVAL') return 'AWAITING_APPROVAL';
  if (input.status === 'CANCELLED') return 'CANCELLED';
  if (input.hasBudgetDecision) return 'BUDGET_EXHAUSTED';
  if (input.status === 'COMPLETED') {
    // SUCCESS only when the outcome is COMPLETED AND independently verified.
    if (input.verificationPassed === true) return 'SUCCESS';
    // A definitive verification failure (artifact contradicts the claim) is
    // FAILED — the verification result wins over the execution claim.
    if (input.verificationFailed === true) return 'FAILED';
    // Verification ran but could not decide (evidence UNKNOWN / unavailable).
    return 'UNKNOWN';
  }
  if (input.status === 'FAILED') return 'FAILED';
  // PARTIAL / NEW / UNDERSTANDING / PLANNED / RUNNING / VERIFYING
  if (input.hasFailedProvider) return 'FAILED';
  // Only a DEFINITIVE verification failure is FAILED — inconclusive evidence
  // (verification ran but could not decide) stays UNKNOWN in every state.
  if (input.verificationFailed === true) return 'FAILED';
  return 'UNKNOWN';
}
