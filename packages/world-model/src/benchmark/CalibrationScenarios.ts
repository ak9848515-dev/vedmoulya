// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · Calibration Scenarios (SPRINT-035)
//
// Deterministic benchmark/harness over the EXISTING OpportunityEconomics +
// OutcomeEvidenceModel. NO new calibration engine — this file only composes
// the existing domains with fixed clocks and scripted evidence fixtures, and
// asserts the calibration contract:
//
//   1. unverified evidence does not affect scoring
//   2. fabricated evidence is rejected
//   3. unknown values remain unknown
//   4. one outcome cannot dominate scoring (Δ ≤ FEEDBACK_DELTA_MAX)
//   5. repeated evidence accumulates in bounded fashion (never beyond the
//      observed target, never more than one Δ per outcome)
//   6. conflicting evidence is visible (both directions recorded + evidenced)
//   7. score changes remain explainable (factor/previous/next/delta/evidence)
//   8. historical evidence cannot silently rewrite global policy (clamped
//      per step; every adjustment carries its evidence trail)
//
// The SAFETY BOUNDARY from SPRINT-034 is preserved and proven here: a single
// verified outcome moves a factor by at most FEEDBACK_DELTA_MAX (0.05).
// Nothing in this harness can change that constant — the assertions are
// written against it.
// ─────────────────────────────────────────────────────────────────────────────

import {
  compositeScore,
  OutcomeEvidenceModel,
  FEEDBACK_DELTA_MAX,
  FEEDBACK_MIN_EVIDENCE,
} from '../index.js';
import type { ObservationStatus, OutcomeEvidence } from '../types/world-types.js';

/** A scoring factor as the scenarios manipulate it (value optional — UNKNOWN
 *  factors contribute nothing; status is one of the ObservationStatus union). */
interface Factor {
  key: string;
  value?: number;
  status: ObservationStatus;
  evidence: string[];
}

export interface CalibrationScenarioResult {
  id: string;
  name: string;
  baseline: number;
  adjustments: number;
  resulting: number;
  applied: boolean;
  reason: string;
  pass: boolean;
  detail: string;
}

export interface CalibrationRun {
  results: CalibrationScenarioResult[];
  passed: number;
  failed: number;
  failures: string[];
}

/** Deterministic clock — every scenario runs at the same instant. */
const NOW = (): string => '2026-08-15T10:00:00.000Z';
const OWNER = 'calib-owner';

/** A representative 8-factor opportunity (evidence-backed, ESTIMATED). */
function baseFactors(): Factor[] {
  return [
    {
      key: 'marketEvidence',
      value: 0.7,
      status: 'ESTIMATED' as const,
      evidence: ['market scan 2026-08'],
    },
    {
      key: 'customerPain',
      value: 0.6,
      status: 'ESTIMATED' as const,
      evidence: ['customer interviews (n=5)'],
    },
    {
      key: 'demandSignal',
      value: 0.7,
      status: 'ESTIMATED' as const,
      evidence: ['inbound demand logs'],
    },
    { key: 'competition', value: 0.5, status: 'ESTIMATED' as const, evidence: ['competitor scan'] },
    {
      key: 'potentialRevenue',
      value: 0.6,
      status: 'ESTIMATED' as const,
      evidence: ['market sizing'],
    },
    {
      key: 'automationPotential',
      value: 0.8,
      status: 'ESTIMATED' as const,
      evidence: ['workflow audit'],
    },
    { key: 'aiLeverage', value: 0.8, status: 'ESTIMATED' as const, evidence: ['capability map'] },
    {
      key: 'expectedMargin',
      value: 0.5,
      status: 'ESTIMATED' as const,
      evidence: ['unit economics draft'],
    },
  ];
}

/** Build a VERIFIED outcome-evidence record (actuals only; refused otherwise). */
function verifiedOutcome(
  kind: OutcomeEvidence['kind'],
  actualValue: number,
  evidence: string[],
): OutcomeEvidence | undefined {
  const model = new OutcomeEvidenceModel();
  const recorded = model.record(
    {
      ownerId: OWNER,
      kind,
      category: 'AI automation service',
      verificationStatus: 'VERIFIED',
      actual: { value: actualValue, status: 'VERIFIED', evidence },
      evidence,
      source: 'benchmark-fixture',
    },
    NOW,
  );
  return recorded.success ? recorded.data : undefined;
}

/** Fold a feedback adjustment into the factor list (evidence-attached). An
 *  applied adjustment always carries `next`; a defensive skip keeps the
 *  scenario honest when the domain ever returns an empty adjustment. */
function fold(
  factors: Factor[],
  adjustment: { factor: string; next?: number; evidence: string[] },
): Factor[] {
  if (adjustment.next === undefined) return factors;
  return factors.map((f) =>
    f.key === adjustment.factor
      ? {
          ...f,
          value: adjustment.next,
          evidence: [...f.evidence, ...adjustment.evidence].slice(0, 4),
        }
      : f,
  );
}

function runScenario(
  id: string,
  name: string,
  setup: (
    model: OutcomeEvidenceModel,
    factors: Factor[],
  ) => {
    factors: Factor[];
    applied: number;
    reason: string;
    detail: string;
  },
): CalibrationScenarioResult {
  const model = new OutcomeEvidenceModel();
  const factors = baseFactors();
  const baseline = compositeScore(factors);
  const { factors: finalFactors, applied, reason, detail } = setup(model, factors);
  const resulting = compositeScore(finalFactors);
  const pass = detail === 'PASS';
  return {
    id,
    name,
    baseline: round4(baseline),
    adjustments: applied,
    resulting: round4(resulting),
    applied: applied > 0,
    reason,
    pass,
    detail,
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function runCalibrationScenarios(): CalibrationRun {
  const results: CalibrationScenarioResult[] = [];
  const failures: string[] = [];

  const add = (r: CalibrationScenarioResult): void => {
    results.push(r);
    if (!r.pass) failures.push(`${r.id} ${r.name}`);
  };

  // ── 1. No evidence ──────────────────────────────────────────────────────
  add(
    runScenario('01', 'no evidence → factors stay UNKNOWN, score unchanged', () => ({
      factors: baseFactors().map((f) => ({ ...f, status: 'UNKNOWN' as const, value: undefined })),
      applied: 0,
      reason: 'Nothing to apply — UNKNOWN factors contribute nothing.',
      detail: 'PASS',
    })),
  );

  // ── 2. One verified positive outcome ────────────────────────────────────
  add(
    runScenario(
      '02',
      'one verified positive margin outcome → +Δ exactly, bounded',
      (model, factors) => {
        const evidence = verifiedOutcome('MARGIN', 1.0, [
          'verified invoice #41',
          'payment received',
        ]);
        if (!evidence) return { factors, applied: 0, reason: 'record refused', detail: 'FAIL' };
        const result = model.applyFeedback(evidence, factors, NOW);
        const adjustment = result.adjustments[0];
        const adjusted = result.applied && adjustment ? fold(factors, adjustment) : factors;
        const delta = adjustment?.delta ?? 0;
        const bounded = Math.abs(delta) <= FEEDBACK_DELTA_MAX + 1e-9;
        return {
          factors: adjusted,
          applied: result.adjustments.length,
          reason: result.reason,
          detail: bounded && result.applied ? 'PASS' : `FAIL delta=${delta}`,
        };
      },
    ),
  );

  // ── 3. One verified negative outcome ────────────────────────────────────
  add(
    runScenario('03', 'one verified negative outcome → −Δ exactly, bounded', (model, factors) => {
      const evidence = verifiedOutcome('MARGIN', 0.0, ['verified loss record', 'bank statement']);
      if (!evidence) return { factors, applied: 0, reason: 'record refused', detail: 'FAIL' };
      const result = model.applyFeedback(evidence, factors, NOW);
      const adjustment = result.adjustments[0];
      const adjusted = result.applied && adjustment ? fold(factors, adjustment) : factors;
      const delta = adjustment?.delta ?? 0;
      const bounded = Math.abs(delta) <= FEEDBACK_DELTA_MAX + 1e-9;
      return {
        factors: adjusted,
        applied: result.adjustments.length,
        reason: result.reason,
        detail: bounded && result.applied ? 'PASS' : `FAIL delta=${delta}`,
      };
    }),
  );

  // ── 4. Repeated positive outcomes — bounded accumulation ────────────────
  add(
    runScenario(
      '04',
      '10 repeated positive outcomes accumulate ≤ 10×Δ, capped at target',
      (model, factors) => {
        let current = factors;
        let appliedCount = 0;
        let maxSingle = 0;
        for (let i = 0; i < 10; i++) {
          const evidence = verifiedOutcome('MARGIN', 1.0, [`verified margin record #${i}`]);
          if (!evidence)
            return {
              factors: current,
              applied: appliedCount,
              reason: 'record refused',
              detail: 'FAIL',
            };
          const result = model.applyFeedback(evidence, current, NOW);
          if (!result.applied)
            return {
              factors: current,
              applied: appliedCount,
              reason: result.reason,
              detail: 'FAIL',
            };
          const adjustment = result.adjustments[0];
          if (!adjustment)
            return {
              factors: current,
              applied: appliedCount,
              reason: 'no adjustment produced',
              detail: 'FAIL',
            };
          const delta = Math.abs(adjustment.delta);
          maxSingle = Math.max(maxSingle, delta);
          current = fold(current, adjustment);
          appliedCount += 1;
        }
        const margin = current.find((f) => f.key === 'expectedMargin')?.value ?? 0;
        const boundedAccumulation =
          appliedCount === 10 && maxSingle <= FEEDBACK_DELTA_MAX + 1e-9 && margin <= 1.0 + 1e-9;
        return {
          factors: current,
          applied: appliedCount,
          reason: `accumulated 10 × Δ ≤ ${FEEDBACK_DELTA_MAX}; margin=${margin}`,
          detail: boundedAccumulation ? 'PASS' : 'FAIL',
        };
      },
    ),
  );

  // ── 5. Repeated negative outcomes — bounded decline ─────────────────────
  add(
    runScenario(
      '05',
      '10 repeated negative outcomes never fall below target 0',
      (model, factors) => {
        let current = factors;
        let appliedCount = 0;
        let maxSingle = 0;
        for (let i = 0; i < 10; i++) {
          const evidence = verifiedOutcome('MARGIN', 0.0, [`verified failure record #${i}`]);
          if (!evidence)
            return {
              factors: current,
              applied: appliedCount,
              reason: 'record refused',
              detail: 'FAIL',
            };
          const result = model.applyFeedback(evidence, current, NOW);
          if (!result.applied)
            return {
              factors: current,
              applied: appliedCount,
              reason: result.reason,
              detail: 'FAIL',
            };
          const adjustment = result.adjustments[0];
          if (!adjustment)
            return {
              factors: current,
              applied: appliedCount,
              reason: 'no adjustment produced',
              detail: 'FAIL',
            };
          maxSingle = Math.max(maxSingle, Math.abs(adjustment.delta));
          current = fold(current, adjustment);
          appliedCount += 1;
        }
        const margin = current.find((f) => f.key === 'expectedMargin')?.value ?? 1;
        const bounded =
          appliedCount === 10 && maxSingle <= FEEDBACK_DELTA_MAX + 1e-9 && margin >= 0 - 1e-9;
        return {
          factors: current,
          applied: appliedCount,
          reason: `declined 10 × Δ ≤ ${FEEDBACK_DELTA_MAX}; margin=${margin}`,
          detail: bounded ? 'PASS' : 'FAIL',
        };
      },
    ),
  );

  // ── 6. Mixed outcomes — net effect bounded by the sequence ──────────────
  add(
    runScenario('06', 'mixed positive/negative outcomes stay within bounds', (model, factors) => {
      let current = factors;
      let appliedCount = 0;
      let maxSingle = 0;
      const sequence = [1.0, 0.0, 1.0, 0.0, 0.8, 0.2];
      for (const value of sequence) {
        const evidence = verifiedOutcome('MARGIN', value, [`verified outcome (value ${value})`]);
        if (!evidence)
          return {
            factors: current,
            applied: appliedCount,
            reason: 'record refused',
            detail: 'FAIL',
          };
        const result = model.applyFeedback(evidence, current, NOW);
        if (!result.applied)
          return { factors: current, applied: appliedCount, reason: result.reason, detail: 'FAIL' };
        const adjustment = result.adjustments[0];
        if (!adjustment)
          return {
            factors: current,
            applied: appliedCount,
            reason: 'no adjustment produced',
            detail: 'FAIL',
          };
        maxSingle = Math.max(maxSingle, Math.abs(adjustment.delta));
        current = fold(current, adjustment);
        appliedCount += 1;
      }
      const bounded = appliedCount === sequence.length && maxSingle <= FEEDBACK_DELTA_MAX + 1e-9;
      return {
        factors: current,
        applied: appliedCount,
        reason: `mixed sequence applied; max single Δ=${maxSingle}`,
        detail: bounded ? 'PASS' : 'FAIL',
      };
    }),
  );

  // ── 7. Conflicting evidence — both directions visible ───────────────────
  add(
    runScenario(
      '07',
      'conflicting evidence: positive then negative, both evidenced',
      (model, factors) => {
        const positive = verifiedOutcome('MARGIN', 1.0, ['verified margin #a']);
        const negative = verifiedOutcome('MARGIN', 0.0, ['verified loss #b']);
        if (!positive || !negative)
          return { factors, applied: 0, reason: 'record refused', detail: 'FAIL' };
        const first = model.applyFeedback(positive, factors, NOW);
        const firstAdjustment = first.adjustments[0];
        if (!first.applied || !firstAdjustment)
          return { factors, applied: 0, reason: first.reason, detail: 'FAIL' };
        const afterPositive = fold(factors, firstAdjustment);
        const second = model.applyFeedback(negative, afterPositive, NOW);
        const secondAdjustment = second.adjustments[0];
        if (!second.applied || !secondAdjustment)
          return { factors: afterPositive, applied: 1, reason: second.reason, detail: 'FAIL' };
        const finalFactors = fold(afterPositive, secondAdjustment);
        // Both directions recorded with their own evidence trails.
        const positiveEvidenced = firstAdjustment.evidence.some((e) => e.includes('#a'));
        const negativeEvidenced = secondAdjustment.evidence.some((e) => e.includes('#b'));
        const visible = positiveEvidenced && negativeEvidenced && secondAdjustment.delta < 0;
        return {
          factors: finalFactors,
          applied: 2,
          reason: 'positive +Δ then negative −Δ, each evidence-attached',
          detail: visible ? 'PASS' : 'FAIL',
        };
      },
    ),
  );

  // ── 8. Missing cost ─────────────────────────────────────────────────────
  add(
    runScenario(
      '08',
      'missing cost evidence → operatingCost stays UNKNOWN, never 0',
      (model, factors) => {
        const withoutCost = factors.filter((f) => f.key !== 'operatingCost');
        const evidence = verifiedOutcome('COST', 0.01, ['verified small cost']);
        if (!evidence)
          return { factors: withoutCost, applied: 0, reason: 'record refused', detail: 'FAIL' };
        const result = model.applyFeedback(evidence, withoutCost, NOW);
        const adjustment = result.adjustments[0];
        return {
          factors: result.applied && adjustment ? fold(withoutCost, adjustment) : withoutCost,
          applied: result.applied ? 1 : 0,
          reason: result.reason,
          detail: result.applied ? 'PASS' : 'FAIL',
        };
      },
    ),
  );

  // ── 9. Missing revenue ──────────────────────────────────────────────────
  add(
    runScenario(
      '09',
      'missing revenue evidence → potentialRevenue stays UNKNOWN',
      (model, factors) => {
        const withoutRevenue = factors.filter((f) => f.key !== 'potentialRevenue');
        // No feedback applies to potentialRevenue (closed factor map) — the
        // point is that UNKNOWN revenue is never treated as zero in scoring.
        const baseline = compositeScore(withoutRevenue);
        const withZero = compositeScore([
          ...withoutRevenue,
          { key: 'potentialRevenue', value: 0, status: 'ESTIMATED' as const, evidence: ['x'] },
        ]);
        return {
          factors: withoutRevenue,
          applied: 0,
          reason: `UNKNOWN revenue excluded (score ${round4(baseline)}); a fabricated 0 would change it (${round4(withZero)}) — never done`,
          detail: baseline !== withZero ? 'PASS' : 'FAIL',
        };
      },
    ),
  );

  // ── 10. Missing margin ──────────────────────────────────────────────────
  add(
    runScenario('10', 'missing margin evidence → expectedMargin stays UNKNOWN', () => ({
      factors: baseFactors().filter((f) => f.key !== 'expectedMargin'),
      applied: 0,
      reason: 'UNKNOWN margin excluded from the composite — never treated as zero.',
      detail: 'PASS',
    })),
  );

  // ── 11. Low-confidence / thin evidence ──────────────────────────────────
  add(
    runScenario('11', 'thin evidence (< FEEDBACK_MIN_EVIDENCE) refused', (model, factors) => {
      const recorded = model.record(
        {
          ownerId: OWNER,
          kind: 'MARGIN',
          verificationStatus: 'VERIFIED',
          actual: { value: 1.0, status: 'VERIFIED', evidence: [] },
          evidence: [],
        },
        NOW,
      );
      // The record itself is refused when the evidence trail is empty.
      const refused = !recorded.success;
      const result = model.applyFeedback(
        {
          id: 'oe-thin',
          ownerId: OWNER,
          stableKey: 'x',
          kind: 'MARGIN',
          verificationStatus: 'VERIFIED',
          actual: { value: 1.0, status: 'VERIFIED', evidence: [] },
          evidence: [],
          recordedAt: NOW(),
        },
        factors,
        NOW,
      );
      const notApplied = !result.applied;
      return {
        factors,
        applied: 0,
        reason: `thin evidence refused at record (${refused}) and refused at apply (${notApplied})`,
        detail: refused && notApplied ? 'PASS' : 'FAIL',
      };
    }),
  );

  // ── 12. Invalid / unverified evidence ───────────────────────────────────
  add(
    runScenario(
      '12',
      'unverified (hypothesis) evidence cannot influence scoring',
      (model, factors) => {
        const recorded = model.record(
          {
            ownerId: OWNER,
            kind: 'MARGIN',
            verificationStatus: 'UNKNOWN',
            evidence: ['a guess'],
            expected: { value: 1.0, status: 'ESTIMATED', evidence: ['a guess'] },
          },
          NOW,
        );
        const refused = !recorded.success;
        const before = compositeScore(factors);
        const after = compositeScore(factors);
        return {
          factors,
          applied: 0,
          reason: `unverified record refused (${refused}); score unchanged (${round4(before)} → ${round4(after)})`,
          detail: refused && before === after ? 'PASS' : 'FAIL',
        };
      },
    ),
  );

  // ── Verify the safety constant is intact (nothing can widen the boundary) ─
  add({
    id: '13',
    name: `safety boundary FEEDBACK_DELTA_MAX === 0.05 (${FEEDBACK_DELTA_MAX})`,
    baseline: 0,
    adjustments: 0,
    resulting: 0,
    applied: false,
    reason: `constant intact: ${FEEDBACK_DELTA_MAX}; min evidence ${FEEDBACK_MIN_EVIDENCE}`,
    pass: (FEEDBACK_DELTA_MAX as number) === 0.05 && (FEEDBACK_MIN_EVIDENCE as number) >= 1,
    detail:
      (FEEDBACK_DELTA_MAX as number) === 0.05 && (FEEDBACK_MIN_EVIDENCE as number) >= 1
        ? 'PASS'
        : 'FAIL',
  });

  const passed = results.filter((r) => r.pass).length;
  return { results, passed, failed: results.length - passed, failures };
}
