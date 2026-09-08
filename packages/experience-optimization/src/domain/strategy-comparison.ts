// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: Conservative A/B Comparison
// (Phase 22)
//
// Transparent, conservative comparison with 1-sigma uncertainty. An
// LLM NEVER declares statistical significance here — the verdict is
// purely arithmetic: A is "credibly better" only when A's lower
// 1-sigma bound exceeds B's upper 1-sigma bound AND both sides have
// enough verified samples. Otherwise: INSUFFICIENT_TO_CONCLUDE.
// ──────────────────────────────────────────────────────────────────

import type {
  ComparisonVerdict,
  StrategyComparison,
  StrategyEvidence,
} from '../types/experience-optimization-types.js';
import { MIN_SAMPLES_RELIABLE } from './strategy-evidence.js';

export const COMPARISON_MIN_SAMPLES = MIN_SAMPLES_RELIABLE;

export function waldInterval(p: number, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  // Add-one (Laplace-style) smoothing. The RAW Wald interval is degenerate
  // at p = 0 / p = 1 (zero variance): a tiny 100% sample would produce
  // [1, 1] and "prove" superiority its sample count cannot support
  // (e.g. 100% vs 60% at n = 5). Smoothing keeps small-sample uncertainty
  // honest so comparison stays CONSERVATIVE (Phase 22). Deterministic —
  // never model-decided.
  const smoothed = (p * n + 1) / (n + 2);
  const se = Math.sqrt((smoothed * (1 - smoothed)) / n);
  return [Math.max(0, smoothed - se), Math.min(1, smoothed + se)];
}

export function compareStrategies(a: StrategyEvidence, b: StrategyEvidence): StrategyComparison {
  const aRate = a.verificationSuccessRate;
  const bRate = b.verificationSuccessRate;
  const aInterval = waldInterval(aRate, a.sampleCount);
  const bInterval = waldInterval(bRate, b.sampleCount);
  const reasons: string[] = [];

  let verdict: ComparisonVerdict;
  if (a.sampleCount < COMPARISON_MIN_SAMPLES || b.sampleCount < COMPARISON_MIN_SAMPLES) {
    verdict = 'INSUFFICIENT_TO_CONCLUDE';
    reasons.push(
      `A has ${a.sampleCount} samples, B has ${b.sampleCount}; at least ${COMPARISON_MIN_SAMPLES} verified samples per strategy are required`,
    );
  } else if (aInterval[0] > bInterval[1]) {
    verdict = 'A_CREDIBLY_BETTER';
    reasons.push(
      `A's 1-sigma floor (${(aInterval[0] * 100).toFixed(1)}%) is above B's 1-sigma ceiling (${(bInterval[1] * 100).toFixed(1)}%)`,
    );
  } else if (bInterval[0] > aInterval[1]) {
    verdict = 'B_CREDIBLY_BETTER';
    reasons.push(
      `B's 1-sigma floor (${(bInterval[0] * 100).toFixed(1)}%) is above A's 1-sigma ceiling (${(aInterval[1] * 100).toFixed(1)}%)`,
    );
  } else {
    verdict = 'INSUFFICIENT_TO_CONCLUDE';
    reasons.push(
      'the 1-sigma uncertainty intervals overlap — the evidence cannot credibly separate the strategies',
    );
  }
  reasons.push(
    `A: ${a.sampleCount} samples, ${(aRate * 100).toFixed(1)}% verified success, ${a.verifiedCount} verified; B: ${b.sampleCount} samples, ${(bRate * 100).toFixed(1)}% verified success, ${b.verifiedCount} verified`,
  );

  return {
    a: {
      subject: a.subject,
      sampleCount: a.sampleCount,
      successRate: aRate,
      verifiedCount: a.verifiedCount,
    },
    b: {
      subject: b.subject,
      sampleCount: b.sampleCount,
      successRate: bRate,
      verifiedCount: b.verifiedCount,
    },
    verdict,
    uncertainty: { a: aInterval, b: bInterval },
    reasons,
  };
}
