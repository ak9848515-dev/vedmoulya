// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S10 — BLOCKED-mission recovery policy
//
// A mission can be left BLOCKED by three existing paths:
//   • the selector found no work with satisfied dependencies,
//   • the watchdog observed a RUNNING mission with no progress and no live lease,
//   • the S10 durability barrier could not persist an acknowledgement.
//
// BLOCKED is deliberately NOT auto-resumed today. This module makes that a
// DECISION rather than an omission: every block reason is classified, and only
// a block whose reason is PROVABLY transient and safe to retry may be resumed
// automatically. Everything else is retained with the reason exposed and an
// explicit operator action — because the alternative (blindly re-running an
// objective after an ambiguous interruption) can duplicate side effects.
//
// HONEST FINDING: none of the block reasons the system can currently produce is
// provably transient AND safe to retry. `AUTO_SAFE` therefore exists as an
// explicit, tested gate that nothing may pass until such a reason is added: it
// is not a placeholder for convenience, and no automatic recovery is enabled by
// this module.
// ─────────────────────────────────────────────────────────────────────────────

/** Who (or what) can clear a BLOCKED mission. */
export type MissionRecoveryRequirement = 'AUTO_SAFE' | 'OPERATOR_ACTION' | 'EXTERNAL_CONDITION';

export interface BlockedRecoveryAssessment {
  /** What must happen before the mission may continue. */
  requirement: MissionRecoveryRequirement;
  /** Why the classification was reached (safe to show an operator). */
  rationale: string;
  /** The concrete action an operator must take. Absent for AUTO_SAFE. */
  operatorAction?: string;
}

/** The operator action for a block that only a human may clear. */
const OPERATOR_ACTION =
  'Review the mission, resolve the reported condition, then explicitly resume it (or cancel it).';

/**
 * Classify why a mission is BLOCKED. Deterministic and evidence-only: it reads
 * the recorded reason and never infers a cause that was not recorded. An
 * unknown or missing reason is NEVER treated as recoverable.
 */
export function assessBlockedRecovery(reason: string | undefined): BlockedRecoveryAssessment {
  const text = (reason ?? '').trim();
  if (text.length === 0) {
    return {
      requirement: 'OPERATOR_ACTION',
      rationale: 'No block reason is recorded, so the condition cannot be judged recoverable.',
      operatorAction: OPERATOR_ACTION,
    };
  }

  // 1. Dependency block: work remains but nothing is selectable because a
  //    dependency is unsatisfied. Continuing requires the DEPENDENCY to change
  //    (an external condition) — it is not a transient glitch to retry.
  if (/no selectable objective with satisfied dependencies/i.test(text)) {
    return {
      requirement: 'EXTERNAL_CONDITION',
      rationale:
        'The block is caused by unsatisfied objective dependencies: an external condition must change before any work may continue.',
      operatorAction:
        'Satisfy the missing dependency (or amend the mission objectives), then explicitly resume the mission.',
    };
  }

  // 2. Persistence barrier: the durable state could not be written. Retrying
  //    while persistence is still failing would only re-fail, and retrying the
  //    WORK is unsafe (an ambiguous objective may already have side effects).
  if (/durability barrier|persistence/i.test(text)) {
    return {
      requirement: 'OPERATOR_ACTION',
      rationale:
        'The mission is held because a state transition could not be durably recorded — the interrupted objective is ambiguous and must not be re-run blindly.',
      operatorAction:
        'Confirm persistence is healthy, verify whether the interrupted objective actually completed, then explicitly resume or cancel the mission.',
    };
  }

  // 3. Watchdog / no-progress block: no live lease and no progress. Whether the
  //    work is safe to retry depends on evidence the watchdog does not have.
  if (/watchdog|no progress/i.test(text)) {
    return {
      requirement: 'OPERATOR_ACTION',
      rationale:
        'The mission stopped making progress with no live execution owner; nothing recorded establishes that a retry is safe.',
      operatorAction: OPERATOR_ACTION,
    };
  }

  // 4. A recovery pass itself failed for this mission.
  if (/recovery failed/i.test(text)) {
    return {
      requirement: 'OPERATOR_ACTION',
      rationale:
        'A recovery pass could not recover this mission; the cause must be resolved before it can continue.',
      operatorAction: OPERATOR_ACTION,
    };
  }

  // Unknown reason ⇒ never recoverable automatically.
  return {
    requirement: 'OPERATOR_ACTION',
    rationale:
      'The recorded block reason is not classified as transient/safe, so automatic continuation is refused.',
    operatorAction: OPERATOR_ACTION,
  };
}

/**
 * S10 — the single gate every automatic continuation must pass. Only an
 * `AUTO_SAFE` classification may resume a BLOCKED mission without a human.
 */
export function mayAutoResumeBlocked(reason: string | undefined): boolean {
  return assessBlockedRecovery(reason).requirement === 'AUTO_SAFE';
}
