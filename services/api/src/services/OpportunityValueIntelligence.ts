// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.3 · Opportunity Value Intelligence
//
// The LAST mile of the opportunity pipeline. Qualification (S5.1) answers
// "is this worth PRESENTING?". This layer adds ONE further, honest question:
//
//     "what does this OWNER's real delivery + commercial history say about
//      an opportunity that looks like this one?"
//
// It is NOT a second economics engine. The EXISTING `OpportunityEconomics`
// (SPRINT-032) already carries the advisory 18-factor value score inside the
// existing assessor pipeline; this layer never recomputes it, never mutates it
// and never competes with it. Its entire contribution is EVIDENCE FROM REAL
// HISTORY — verified deliveries and canonical commercial outcomes — kept
// strictly separate from the economics score and strictly separate from each
// other.
//
// CANONICAL SOURCE. The only evidence consulted is the owner's canonical
// commercial-outcome records (`CommercialOutcomeStore`, S6.0/S6.1). Each such
// record is minted EXCLUSIVELY from a VERIFIED Mission delivery (the S4 handoff
// gate admits exactly `VERIFIED` objectives), and each carries the canonical
// `opportunityId` linkage and the canonical commercial `status`. There is
// therefore NO inference here: delivery evidence is the existence of a verified
// delivery boundary event, and commercial evidence is the governed status the
// S6.1 reconciliation already established.
//
// LINKING. Ownership and linkage are CANONICAL only:
//   • the owner is the record's `ownerId`, never client-supplied;
//   • an outcome links to an opportunity through `opportunityId` equality.
// Title/description/client similarity is NEVER used. An unlinked outcome is
// EXCLUDED rather than attributed — MEDIUM-risk legacy gaps stay honest gaps.
//
// UNKNOWN ≠ FALSE. With no linked history the levels are `INSUFFICIENT`, never
// a fabricated success or failure. UNKNOWN and FALSE are distinct states.
//
// DELIVERY ≠ COMMERCIAL. The two evidence sets are reported side by side and
// never collapsed: three verified deliveries with one paid outcome and two
// pending outcomes yields three separate facts, not "success".
//
// DETERMINISM. Same owner + opportunity + canonical history ⇒ same result.
// No randomness, no clock-dependent scoring, no model, no LLM. `generatedAt` is
// the only time-varying field.
// ─────────────────────────────────────────────────────────────────────────────

import {
  computeConfidence,
  type ExecutionMemoryConfidence,
  type ExecutionMemoryConfidenceLevel,
} from '@vedmoulya/execution-memory';
import type { CommercialOutcomeRecord, CommercialOutcomeStatus } from '@vedmoulya/control-plane';

/**
 * The audit-approved overall assessment states. Derived deterministically from
 * BOTH evidence sets; it never lets commercial evidence masquerade as delivery
 * evidence or vice versa.
 */
export type ValueAssessment =
  'INSUFFICIENT_EVIDENCE' | 'PROMISING' | 'STRONG_CANDIDATE' | 'HIGH_RISK';

/** Evidence level, reusing the EXISTING confidence vocabulary. */
export type ValueEvidenceLevel = ExecutionMemoryConfidenceLevel;

/** Verified-delivery evidence for one opportunity. */
export interface DeliveryValueEvidence {
  /** INSUFFICIENT means NO verified delivery history — never a failure. */
  level: ValueEvidenceLevel;
  /** Verified deliveries linked to this opportunity. */
  successCount: number;
  /** Failed delivery outcomes, counted ONLY where canonical linkage exists. */
  failureCount: number;
  sampleCount: number;
  confidence: ExecutionMemoryConfidence;
}

/** Canonical commercial evidence for one opportunity. */
export interface CommercialValueEvidence {
  /** INSUFFICIENT means NO commercial history — never a success or a failure. */
  level: ValueEvidenceLevel;
  /** Commercial successes — asserted ONLY by the canonical PAID state. */
  paidCount: number;
  /** Non-success commercial states awaiting human action or already resolved. */
  pendingCount: number;
  /** Canonically cancelled outcomes. */
  cancelledCount: number;
  sampleCount: number;
  confidence: ExecutionMemoryConfidence;
}

/** The additive, evidence-only intelligence attached to qualification. */
export interface OpportunityValueIntelligence {
  deliveryEvidence: DeliveryValueEvidence;
  commercialEvidence: CommercialValueEvidence;
  overallAssessment: ValueAssessment;
  /** Aggregate confidence across both evidence sets. */
  confidence: ValueEvidenceLevel;
  /** Total canonical evidence items consumed (delivery + commercial). */
  evidenceCount: number;
  /** Deterministic, human-readable explanations — never generated prose. */
  reasons: string[];
  generatedAt: string;
}

/**
 * The narrow, owner-scoped read seam. The production composition wires this to
 * the EXISTING `CommercialOutcomeService.listCommercialOutcomes(userId)` — no
 * new repository, no new store, no full scan per opportunity beyond the single
 * bounded owner-scoped list.
 */
export interface OpportunityValueEvidencePort {
  /** Canonical commercial-outcome records for ONE owner (never another user). */
  listCommercialOutcomes(userId: string): CommercialOutcomeRecord[];
}

export interface OpportunityValueIntelligenceDeps {
  /** Canonical evidence source. Absent ⇒ qualification omits valueIntelligence. */
  evidence?: OpportunityValueEvidencePort;
  now: () => string;
}

/** Minimum sample before any non-INSUFFICIENT level may be claimed. */
const MIN_SAMPLE = 2;

/**
 * Map a canonical commercial status onto the conservative evidence buckets.
 *
 * PAID is the ONLY success. Every other state is honestly non-success; CLOSED
 * is interpreted ONLY through the S6.2 semantics (an outcome that was resolved
 * without a canonical `paid` invoice) — it is never treated as PAID. A recorded
 * payment or the mere existence of an invoice never reaches this function: only
 * the governed status does.
 */
function classifyCommercialStatus(status: CommercialOutcomeStatus): {
  paid: number;
  pending: number;
  cancelled: number;
} {
  switch (status) {
    case 'PAID':
      return { paid: 1, pending: 0, cancelled: 0 };
    case 'COMMERCIAL_PENDING':
    case 'MANUAL_REVIEW':
    case 'INVOICE_PENDING':
    case 'CLOSED':
      // Pending human action, awaiting payment, or closed without a canonical
      // paid invoice — non-success, never success, never a delivery failure.
      return { paid: 0, pending: 1, cancelled: 0 };
    case 'CANCELLED':
      return { paid: 0, pending: 0, cancelled: 1 };
  }
}

/**
 * Derive delivery evidence from the canonically linked outcomes. An outcome
 * exists ONLY because a VERIFIED delivery boundary event occurred, so each
 * linked outcome is one successful verified delivery. There is no canonical
 * "failed delivery" record in the estate, so failureCount stays 0 and is never
 * inferred — UNKNOWN is not FALSE.
 */
function deliveryEvidenceFor(linked: CommercialOutcomeRecord[]): DeliveryValueEvidence {
  const successCount = linked.length;
  const failureCount = 0;
  const sampleCount = successCount + failureCount;
  const confidence =
    sampleCount === 0
      ? computeConfidence({ sampleCount: 0, successCount: 0, verifiedCount: 0, recency: 0 })
      : computeConfidence({
          sampleCount,
          successCount,
          verifiedCount: successCount,
          recency: 1,
        });
  return {
    level: confidence.level,
    successCount,
    failureCount,
    sampleCount,
    confidence,
  };
}

/** Derive commercial evidence from the canonically linked outcomes' statuses. */
function commercialEvidenceFor(linked: CommercialOutcomeRecord[]): CommercialValueEvidence {
  let paidCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;
  for (const record of linked) {
    const bucket = classifyCommercialStatus(record.status);
    paidCount += bucket.paid;
    pendingCount += bucket.pending;
    cancelledCount += bucket.cancelled;
  }
  const sampleCount = paidCount + pendingCount + cancelledCount;
  const confidence =
    sampleCount === 0
      ? computeConfidence({ sampleCount: 0, successCount: 0, verifiedCount: 0, recency: 0 })
      : computeConfidence({
          sampleCount,
          successCount: paidCount,
          verifiedCount: sampleCount,
          recency: 1,
        });
  return {
    level: confidence.level,
    paidCount,
    pendingCount,
    cancelledCount,
    sampleCount,
    confidence,
  };
}

/**
 * Deterministic, explainable assessment over BOTH evidence sets.
 *
 * The commercial evidence can never promote an opportunity to STRONG_CANDIDATE
 * on its own, and delivery evidence can never be read as commercial success.
 */
function assess(
  delivery: DeliveryValueEvidence,
  commercial: CommercialValueEvidence,
): { overallAssessment: ValueAssessment; confidence: ValueEvidenceLevel; reasons: string[] } {
  const reasons: string[] = [];

  // No history of either kind: honest absence, never a fabricated verdict.
  if (delivery.sampleCount === 0 && commercial.sampleCount === 0) {
    reasons.push('No canonical delivery or commercial evidence is linked to this opportunity.');
    return { overallAssessment: 'INSUFFICIENT_EVIDENCE', confidence: 'INSUFFICIENT', reasons };
  }

  if (delivery.sampleCount > 0) {
    reasons.push(
      `${delivery.successCount} verified delivery outcome(s) linked to this opportunity.`,
    );
  }
  if (delivery.failureCount > 0) {
    reasons.push(`${delivery.failureCount} failed delivery outcome(s) canonically linked.`);
  }
  if (commercial.paidCount > 0) {
    reasons.push(`${commercial.paidCount} paid commercial outcome(s) linked to this opportunity.`);
  }
  if (commercial.pendingCount > 0) {
    reasons.push(
      `${commercial.pendingCount} commercial outcome(s) pending human action (not paid).`,
    );
  }
  if (commercial.cancelledCount > 0) {
    reasons.push(`${commercial.cancelledCount} cancelled commercial outcome(s) linked.`);
  }

  const hasDelivery = delivery.sampleCount > 0;
  const hasCommercial = commercial.sampleCount > 0;

  // HIGH_RISK requires ACTUAL negative evidence: cancelled commercial outcomes
  // with no offsetting paid success, or canonically linked delivery failures.
  const negativeCommercial = commercial.cancelledCount > 0 && commercial.paidCount === 0;
  const negativeDelivery = delivery.failureCount > 0 && delivery.successCount === 0;
  if (negativeCommercial || negativeDelivery) {
    reasons.push('Negative canonical evidence outweighs any success for this opportunity.');
    return {
      overallAssessment: 'HIGH_RISK',
      confidence: overallConfidence(delivery, commercial),
      reasons,
    };
  }

  const confidence = overallConfidence(delivery, commercial);

  // STRONG_CANDIDATE needs a paid outcome AND repeated verified delivery.
  if (commercial.paidCount > 0 && delivery.successCount >= MIN_SAMPLE) {
    reasons.push(
      `Paid commercial success with ${delivery.successCount} verified deliveries supports a strong candidate.`,
    );
    return { overallAssessment: 'STRONG_CANDIDATE', confidence, reasons };
  }

  // PROMISING: at least one paid outcome, or repeated verified delivery without
  // negative commercial evidence. Commercial evidence alone never suffices.
  if (commercial.paidCount > 0 || delivery.successCount >= MIN_SAMPLE) {
    if (commercial.paidCount > 0) {
      reasons.push(
        'Verified delivery history and a paid commercial outcome support this candidate.',
      );
    } else {
      reasons.push('Repeated verified delivery history supports this candidate.');
    }
    if (hasCommercial && commercial.paidCount === 0) {
      reasons.push('Commercial sample is limited and contains no paid outcome yet.');
    }
    return { overallAssessment: 'PROMISING', confidence, reasons };
  }

  // Some evidence, but too little to promote — still INSUFFICIENT, not FALSE.
  reasons.push('Linked evidence exists but is too limited to assess reliably.');
  if (hasDelivery && !hasCommercial) {
    reasons.push('No linked commercial history yet — commercial reliability is UNKNOWN.');
  }
  if (hasCommercial && !hasDelivery) {
    reasons.push('No verified delivery history yet — delivery reliability is UNKNOWN.');
  }
  return { overallAssessment: 'INSUFFICIENT_EVIDENCE', confidence, reasons };
}

/** Conservative aggregate: the weaker of the two evidence levels wins. */
function overallConfidence(
  delivery: DeliveryValueEvidence,
  commercial: CommercialValueEvidence,
): ValueEvidenceLevel {
  const rank: Record<ValueEvidenceLevel, number> = {
    INSUFFICIENT: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
  };
  const weakest =
    rank[delivery.level] <= rank[commercial.level] ? delivery.level : commercial.level;
  return weakest;
}

/**
 * Build the evidence-only value intelligence for ONE opportunity.
 *
 * Owner isolation is structural: `ownerId` comes from the canonical record and
 * is passed verbatim to the owner-scoped evidence port. No ledger is read
 * across users and no client-supplied identity is accepted.
 */
export function computeOpportunityValueIntelligence(
  input: {
    ownerId: string;
    opportunityId: string;
  },
  deps: OpportunityValueIntelligenceDeps,
): OpportunityValueIntelligence | undefined {
  if (deps.evidence === undefined) return undefined;

  // ONE bounded, owner-scoped read. No N+1, no per-opportunity scan of the
  // whole estate, no new cache and no new index.
  const owned = deps.evidence.listCommercialOutcomes(input.ownerId);
  // CANONICAL linkage only: `opportunityId` equality. Unlinked records are
  // excluded, never guessed by title/description/client similarity.
  const linked = owned.filter((record) => record.opportunityId === input.opportunityId);

  const deliveryEvidence = deliveryEvidenceFor(linked);
  const commercialEvidence = commercialEvidenceFor(linked);
  const { overallAssessment, confidence, reasons } = assess(deliveryEvidence, commercialEvidence);

  return {
    deliveryEvidence,
    commercialEvidence,
    overallAssessment,
    confidence,
    evidenceCount: deliveryEvidence.sampleCount + commercialEvidence.sampleCount,
    reasons,
    generatedAt: deps.now(),
  };
}
