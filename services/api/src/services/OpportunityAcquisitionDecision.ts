// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S9 — Adaptive work-acquisition decision
//
// Answers exactly one question:
//
//     "Should I acquire/pursue THIS opportunity now, defer it, reject it, or is
//      it blocked by a mandatory gate?"
//
// It is a PURE, evidence-backed verdict composed into the EXISTING S7.1
// recommendation path. It creates no scoring engine, no registry, no router and
// no second lifecycle: every number it uses comes from the EXISTING S5.1
// canonical qualification (`BusinessOpportunityAssessor`), the EXISTING S8
// valuation (Sprint 016 `world.opportunityPipeline`) and the canonical
// lifecycle record. It never invents revenue, cost, probability or historical
// success — a figure that is not evidence-backed stays UNKNOWN.
//
// States:
//   RECOMMEND  — evidence supports prioritizing the opportunity.
//   DEFER      — evidence or a dependency is missing; further evaluation is appropriate.
//   REJECT     — the candidate is unsuitable / fails a substantive eligibility requirement.
//   INELIGIBLE — a mandatory authorization, risk, suitability, budget or policy gate blocks acquisition.
//
// The function returns understandable `reasons`, the `missingEvidence` that
// would refine the verdict, and the `changeConditions` that could change it.
// It holds NO authority: it cannot approve, transition, launch a Mission, bid
// or contact anyone.
// ─────────────────────────────────────────────────────────────────────────────

import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import type { OpportunityQualification } from './OpportunityQualification.js';

/** The adaptive acquisition verdict (no equivalent enum exists in the estate). */
export type AcquisitionDecisionState = 'RECOMMEND' | 'DEFER' | 'REJECT' | 'INELIGIBLE';

/**
 * The Sprint 016 valuation for ONE opportunity, as produced by
 * `world.opportunityPipeline`. Structural copy of the exposed pipeline fields —
 * the S9 path consumes it, it never recomputes it.
 */
export interface AcquisitionValuation {
  expectedValue?: { value: number; status: string; evidence: string[] };
  expectedCost?: { value: number; status: string; evidence: string[] };
  expectedMargin?: number;
  expectedRoi?: number;
  rankScore?: number;
  valuationProvenance?: 'OUTCOME_EVIDENCE' | 'RECORD_LABEL' | 'NONE';
  reasoning?: string[];
}

export interface AcquisitionDecisionInput {
  record: OpportunityLifecycleRecord;
  qualification: OpportunityQualification;
  /** Sprint 016 valuation — absent means UNKNOWN, never zero. */
  valuation?: AcquisitionValuation;
  /** Optional hard budget gate. Absent ⇒ no budget gate is applied. */
  budget?: { availableUsd?: number };
  /** The EXISTING presentation threshold on the 0..1 assessment score. */
  scoreThreshold: number;
}

export interface AcquisitionDecision {
  state: AcquisitionDecisionState;
  /** Understandable, evidence-referencing reasons (never hidden arithmetic). */
  reasons: string[];
  /** Evidence that is missing and would refine the decision (never invented). */
  missingEvidence: string[];
  /** Conditions under which the decision could change. */
  changeConditions: string[];
}

function figureText(
  figure: { value: number; status: string } | undefined,
  label: string,
): string | undefined {
  if (figure === undefined) return undefined;
  return `${label} $${figure.value} (${figure.status})`;
}

/**
 * Decide whether to acquire/pursue one opportunity. Deterministic and
 * evidence-only; UNKNOWN contributes nothing and is never converted to zero.
 */
export function decideAcquisition(input: AcquisitionDecisionInput): AcquisitionDecision {
  const { record, qualification, valuation, budget, scoreThreshold } = input;
  const { score, riskLevel, evidence } = qualification.assessment;
  const inputs = qualification.inputsUsed;

  const reasons: string[] = [];
  const missingEvidence: string[] = [];
  const changeConditions: string[] = [];

  // ── 1. INELIGIBLE — a mandatory gate blocks acquisition (before any merit) ──
  //    Same rule as the EXISTING S7.2 Mission launch gate: the persisted OR the
  //    current assessed risk marks the work HIGH.
  if (record.riskLevel === 'HIGH' || riskLevel === 'HIGH') {
    reasons.push(
      'HIGH suitability/risk: the existing risk gate blocks autonomous acquisition of this work.',
    );
    changeConditions.push(
      'A re-assessment that lowers risk below HIGH, or an explicit human approval of this specific work.',
    );
    return { state: 'INELIGIBLE', reasons, missingEvidence, changeConditions };
  }

  const expectedCost = valuation?.expectedCost;
  if (
    budget?.availableUsd !== undefined &&
    expectedCost !== undefined &&
    expectedCost.value > budget.availableUsd
  ) {
    reasons.push(
      `Expected cost $${expectedCost.value} exceeds the available budget $${budget.availableUsd}: a mandatory budget gate blocks acquisition.`,
    );
    changeConditions.push(
      'A larger budget, or a cheaper delivery path that brings the expected cost within budget.',
    );
    return { state: 'INELIGIBLE', reasons, missingEvidence, changeConditions };
  }

  // ── 2. DEFER — evidence or a dependency is missing ─────────────────────────
  const noEvidence = record.evidence.length === 0;
  const missingCapabilityDependency =
    inputs.requiredCapabilities > 0 && inputs.availableCapabilities === 0;

  if (noEvidence || missingCapabilityDependency) {
    if (noEvidence) {
      missingEvidence.push('No evidence lines are recorded for this opportunity.');
      changeConditions.push('Record at least one evidence item with provenance.');
    }
    if (missingCapabilityDependency) {
      missingEvidence.push(
        `The source requires ${inputs.requiredCapabilities} capability/capabilities, but no demonstrable owner capability was found.`,
      );
      changeConditions.push(
        'Demonstrate the required capability (for example a completed task), or confirm an external provider can supply it.',
      );
    }
    addValuationGaps(valuation, missingEvidence, changeConditions);
    reasons.push(
      'Evaluation is incomplete: deferring until the missing evidence or dependency exists.',
    );
    return { state: 'DEFER', reasons, missingEvidence, changeConditions };
  }

  // ── 3. REJECT — evidence is sufficient and shows unsuitability ─────────────
  if (
    valuation !== undefined &&
    valuation.valuationProvenance === 'OUTCOME_EVIDENCE' &&
    valuation.expectedRoi !== undefined &&
    valuation.expectedRoi < 0
  ) {
    reasons.push(
      `Verified outcome evidence shows a negative ROI (${valuation.expectedRoi}×): the candidate is not economically suitable.`,
    );
    changeConditions.push('New verified evidence showing positive margin/ROI.');
    return { state: 'REJECT', reasons, missingEvidence, changeConditions };
  }

  if (score < scoreThreshold) {
    reasons.push(
      `The existing assessment score ${score.toFixed(2)} is below the recommendation threshold ${scoreThreshold}, and the evidence is sufficient to judge: the candidate is unsuitable to prioritize.`,
    );
    changeConditions.push(
      'New evidence (capability fit, market signals) that raises the assessment score above the threshold.',
    );
    return { state: 'REJECT', reasons, missingEvidence, changeConditions };
  }

  // ── 4. RECOMMEND — evidence supports prioritizing ─────────────────────────
  reasons.push(
    `The existing assessment score ${score.toFixed(2)} is at or above the threshold ${scoreThreshold} with adequate evidence.`,
  );
  if (evidence.length > 0) {
    reasons.push(...evidence.slice(0, 3));
  }
  if (valuation !== undefined) {
    const valueText = figureText(valuation.expectedValue, 'Expected value');
    const costText = figureText(valuation.expectedCost, 'Expected cost');
    if (valueText) reasons.push(valueText);
    if (costText) reasons.push(costText);
    if (valuation.rankScore !== undefined && valuation.expectedRoi !== undefined) {
      reasons.push(
        `Margin-aware rank ${valuation.rankScore} (ROI ${valuation.expectedRoi}×) — revenue alone never decides.`,
      );
    }
    if (valuation.valuationProvenance === 'OUTCOME_EVIDENCE') {
      reasons.push('The valuation is backed by the owner’s verified outcome evidence.');
    }
    addValuationGaps(valuation, missingEvidence, changeConditions);
  } else {
    missingEvidence.push(
      'No Sprint 016 valuation is available (value/cost/margin UNKNOWN) — the decision rests on the assessment evidence only.',
    );
    changeConditions.push(
      'Retrieve value/cost evidence (verified outcomes) to strengthen or revise this recommendation.',
    );
  }
  return { state: 'RECOMMEND', reasons, missingEvidence, changeConditions };
}

/** Record which valuation figures are UNKNOWN (never invented, never zero). */
function addValuationGaps(
  valuation: AcquisitionValuation | undefined,
  missingEvidence: string[],
  changeConditions: string[],
): void {
  if (valuation === undefined) {
    missingEvidence.push('No Sprint 016 valuation is available (value/cost/margin UNKNOWN).');
    changeConditions.push('Retrieve expected value and cost evidence to re-evaluate.');
    return;
  }
  if (valuation.expectedValue === undefined) {
    missingEvidence.push('Expected value UNKNOWN — no value/margin evidence.');
  }
  if (valuation.expectedCost === undefined) {
    missingEvidence.push('Expected cost UNKNOWN — no cost evidence.');
  }
  if (valuation.expectedValue === undefined || valuation.expectedCost === undefined) {
    changeConditions.push(
      'Add verified value/cost outcome evidence to compute a margin-aware verdict.',
    );
  }
}
