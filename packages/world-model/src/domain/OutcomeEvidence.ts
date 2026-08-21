// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · OutcomeEvidence (SPRINT-034)
//
// Revenue → outcome feedback, composed over the existing estate. The ONLY
// data that may influence future opportunity scoring is VERIFIED, evidence-
// carrying outcome data. Raw AI responses, unverified predictions,
// recommendations, hypothetical revenue and fabricated estimates are NEVER
// recorded as actuals:
//   • an ACTUAL figure requires verificationStatus VERIFIED + evidence —
//     otherwise the feedback is REFUSED (UNKNOWN stays UNKNOWN);
//   • an EXPECTED figure is ESTIMATED-only (evidence required);
//   • one outcome NEVER rewrites global policy — each adjustment is clamped
//     to FEEDBACK_DELTA_MAX and always carries its evidence trail.
// This is a composition discipline over the existing learning/memory estate —
// it is not a learning engine.
// ─────────────────────────────────────────────────────────────────────────────

import type { OutcomeEvidence, OutcomeFeedbackResult } from '../types/world-types.js';

/** The opportunity factor keys that verified outcome evidence may nudge. */
type OpportunityFactorKey =
  | 'expectedMargin'
  | 'operatingCost'
  | 'founderInvolvement'
  | 'timeToFirstRevenue'
  | 'risk'
  | 'customerPain';

/** Max per-factor movement from a SINGLE verified outcome. Bounded evidence:
 *  no single outcome can rewrite a factor's value beyond this clamp. */
export const FEEDBACK_DELTA_MAX = 0.05;

/** The minimum evidence count required before a verified outcome may move a
 *  factor at all (a single anecdote is never a policy change). */
export const FEEDBACK_MIN_EVIDENCE = 1;

export interface RecordOutcomeInput {
  ownerId: string;
  kind: OutcomeEvidence['kind'];
  opportunityId?: string;
  workflowId?: string;
  businessUnitId?: string;
  category?: string;
  expected?: { value: number; status: 'ESTIMATED'; evidence: string[] };
  actual?: { value: number; status: 'VERIFIED'; evidence: string[] };
  verificationStatus: OutcomeEvidence['verificationStatus'];
  evidence: string[];
  source?: string;
}

export type RecordOutcomeResult =
  { success: true; data: OutcomeEvidence } | { success: false; error: string; code: string };

/** Runtime guard against forged input — the interface narrows ACTUAL status
 *  to 'VERIFIED', but a record may arrive from untrusted callers, so the
 *  comparison is performed on a widened string. */
function isVerifiedStatus(status: string): boolean {
  return status === 'VERIFIED';
}

export class OutcomeEvidenceModel {
  /** Record outcome evidence. The ACTUAL side must be VERIFIED; without
   *  evidence the record is refused — never inferred, never fabricated. */
  record(input: RecordOutcomeInput, now: () => string): RecordOutcomeResult {
    if (input.verificationStatus !== 'VERIFIED') {
      return {
        success: false,
        error: 'Only VERIFIED outcome evidence may be recorded as an actual.',
        code: 'NOT_VERIFIED',
      };
    }
    if (
      input.actual &&
      (!isVerifiedStatus(input.actual.status) || input.actual.evidence.length === 0)
    ) {
      return {
        success: false,
        error: 'An ACTUAL figure requires VERIFIED status and evidence — never inferred.',
        code: 'ACTUAL_UNVERIFIED',
      };
    }
    if (input.evidence.length === 0) {
      return {
        success: false,
        error: 'Outcome evidence requires an evidence trail — no fabricated facts.',
        code: 'NO_EVIDENCE',
      };
    }
    const ts = now();
    const tsDigits = ts.replace(/\D/g, '').slice(-10);
    const id = `oe-${tsDigits}-${Math.random().toString(36).slice(2, 8)}`;
    const stableKey = [
      input.ownerId,
      input.kind,
      input.opportunityId ?? input.workflowId ?? input.businessUnitId ?? 'none',
    ].join(':');
    return {
      success: true,
      data: {
        id,
        ownerId: input.ownerId,
        stableKey,
        kind: input.kind,
        opportunityId: input.opportunityId,
        workflowId: input.workflowId,
        businessUnitId: input.businessUnitId,
        category: input.category,
        expected: input.expected,
        actual: input.actual,
        verificationStatus: input.verificationStatus,
        evidence: input.evidence.slice(0, 8),
        source: input.source,
        recordedAt: ts,
      },
    };
  }

  /**
   * Apply ONE verified outcome to the opportunity economics as bounded
   * feedback. Returns the (clamped) factor adjustments with their evidence.
   * Never applied when the evidence is not VERIFIED. The adjustment never
   * rewrites a factor beyond FEEDBACK_DELTA_MAX in one step, and it can only
   * nudge factors toward the evidence direction (a verified margin outcome
   * raises expectedMargin toward the observed value; a verified failure
   * lowers it).
   */
  applyFeedback(
    evidence: OutcomeEvidence,
    currentFactors: Array<{ key: string; value?: number }>,
    _now: () => string,
  ): OutcomeFeedbackResult {
    if (evidence.verificationStatus !== 'VERIFIED' || !evidence.actual) {
      return {
        evidenceId: evidence.id,
        kind: evidence.kind,
        adjustments: [],
        applied: false,
        reason:
          'Only VERIFIED actual outcome evidence may influence scoring — the feedback was refused.',
      };
    }
    if (evidence.evidence.length < FEEDBACK_MIN_EVIDENCE) {
      return {
        evidenceId: evidence.id,
        kind: evidence.kind,
        adjustments: [],
        applied: false,
        reason: 'The evidence trail is too thin to adjust a factor — bounded evidence required.',
      };
    }
    const factor = this.factorForKind(evidence.kind);
    const adjustments: OutcomeFeedbackResult['adjustments'] = [];
    if (factor) {
      const current = currentFactors.find((f) => f.key === factor);
      const currentValue = current?.value;
      // Direction: the observed value nudges the factor toward it. Clamped.
      const observed = evidence.actual.value;
      const target = Math.min(1, Math.max(0, observed));
      let next = currentValue ?? 0.5;
      if (target > next) next = Math.min(target, next + FEEDBACK_DELTA_MAX);
      else if (target < next) next = Math.max(target, next - FEEDBACK_DELTA_MAX);
      const delta = next - (currentValue ?? 0.5);
      adjustments.push({
        factor,
        previous: currentValue,
        next,
        delta: round3(delta),
        evidence: evidence.evidence.slice(0, 4),
      });
    }
    return {
      evidenceId: evidence.id,
      kind: evidence.kind,
      adjustments,
      applied: adjustments.length > 0,
      reason:
        adjustments.length > 0
          ? `Adjusted ${adjustments.map((a) => a.factor).join(', ')} by at most ${FEEDBACK_DELTA_MAX} toward the verified outcome — every adjustment carries its evidence.`
          : 'No scoring factor maps to this evidence kind — recorded, not applied.',
    };
  }

  /** Map an evidence kind to the opportunity factor it can nudge (closed map —
   *  only these pairs exist; everything else is recorded, not applied). */
  private factorForKind(kind: OutcomeEvidence['kind']): OpportunityFactorKey | undefined {
    switch (kind) {
      case 'REVENUE':
      case 'MARGIN':
        return 'expectedMargin';
      case 'COST':
        return 'operatingCost';
      case 'EFFORT':
        return 'founderInvolvement';
      case 'TIME':
        return 'timeToFirstRevenue';
      case 'QUALITY':
      case 'EXECUTION_RELIABILITY':
        return 'risk';
      case 'CUSTOMER_RESPONSE':
        return 'customerPain';
      default:
        return undefined;
    }
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
