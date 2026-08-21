// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · OpportunityEconomics
// SPRINT-032 — evidence-only opportunity economics EXTENDING the existing
// BusinessOpportunityAssessor (SPRINT-029) composition.
//
// Every opportunity can be evaluated on: market evidence, customer pain,
// demand signal, competition, implementation effort, initial cost, operating
// cost, potential revenue, time to first revenue, risk, automation potential,
// user fit, AI leverage, provider cost, scalability and defensibility.
//
// Honesty rules (absolute):
//   • a factor contributes ONLY when evidence supports it — with no evidence
//     the factor is UNKNOWN and the composite stays low;
//   • the composite OPPORTUNITY SCORE is an advisory ranking, NEVER objective
//     truth — every underlying factor stays visible;
//   • zero/low-capital mode classifies NO_COST / LOW_COST / CAPITAL_REQUIRED
//     from evidence about initial cost; UNKNOWN when there is none;
//   • no income is ever promised and no revenue projection is fabricated.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CapitalMode,
  ObservationStatus,
  OpportunityEvaluation,
  OpportunityFactor,
} from '../types/world-types.js';
import { CAPITAL_BUDGET_TIERS_INR } from '../types/world-types.js';

export interface FactorInput {
  /** Known keys carry documented weights; unknown keys (from external
   *  sources) contribute nothing — the composite is never NaN. */
  key: OpportunityFactor['key'] | (string & {});
  /** 0..1 — only when evidence supports it. */
  value?: number;
  status: ObservationStatus;
  evidence: string[];
}

export interface EconomicsInput {
  ownerId: string;
  title: string;
  description: string;
  category: string;
  /** The EXISTING assessor's base score (0 when no evidence). */
  baseScore: number;
  baseBusinessCase: string[];
  baseEstimatedCost?: { label: string; status: ObservationStatus };
  baseEstimatedRevenue?: { label: string; status: ObservationStatus };
  baseRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  baseMvpPlan: string[];
  baseEvidence: string[];
  /** The factor breakdown — supplied by the caller from evidence. */
  factors: FactorInput[];
  /** The ACTUAL initial cost in INR (evidence-carrying) — drives the
   *  zero/low-capital classification. NEVER fabricated: UNKNOWN stays
   *  UNKNOWN. */
  initialCostInr?: { value?: number; status: ObservationStatus };
  /** The owner's zero/low-capital budget tier (INR). */
  capitalBudgetInr?: number;
  now?: () => string;
}

/** Deterministic composite: weighted average over the KNOWN factors only.
 *  UNKNOWN factors contribute nothing — with no evidence the score is 0. */
export function compositeScore(factors: FactorInput[]): number {
  const known = factors.filter((f) => f.status !== 'UNKNOWN' && f.value !== undefined);
  if (known.length === 0) return 0;
  const weights = factorWeights();
  let total = 0;
  let weightSum = 0;
  for (const factor of known) {
    const weight = weights[factor.key];
    // A factor outside the weights table contributes nothing (never NaN).
    if (weight === undefined) continue;
    total += (factor.value ?? 0) * weight;
    weightSum += weight;
  }
  if (weightSum === 0) return 0;
  return Math.min(1, Math.max(0, total / weightSum));
}

/** Human-interpretable factor weights (documented — never secret). Unknown
 *  keys have no weight and contribute nothing. */
function factorWeights(): Record<string, number> {
  return {
    marketEvidence: 1.2,
    customerPain: 1.3,
    demandSignal: 1.3,
    competition: 0.8,
    implementationEffort: 0.6,
    initialCost: 0.9,
    operatingCost: 0.7,
    potentialRevenue: 1.4,
    timeToFirstRevenue: 1.0,
    risk: 1.2,
    automationPotential: 1.1,
    userFit: 1.0,
    aiLeverage: 1.1,
    providerCost: 0.6,
    scalability: 1.0,
    defensibility: 0.8,
    // SPRINT-033 (Part B) — founder/margin factors (documented weights).
    expectedMargin: 1.0,
    founderInvolvement: 0.7,
  };
}

/** Zero/low-capital classification. Never promises income; UNKNOWN when no
 *  initial-cost evidence exists. */
export function classifyCapitalMode(
  initialCostInr?: { value?: number; status: ObservationStatus },
  budgetInr: number = CAPITAL_BUDGET_TIERS_INR[0] ?? 0,
): CapitalMode {
  if (
    !initialCostInr ||
    initialCostInr.status === 'UNKNOWN' ||
    initialCostInr.value === undefined
  ) {
    return 'UNKNOWN';
  }
  if (initialCostInr.value <= 0) return 'NO_COST';
  if (initialCostInr.value <= budgetInr) return 'LOW_COST';
  return 'CAPITAL_REQUIRED';
}

export class OpportunityEconomics {
  evaluate(input: EconomicsInput): OpportunityEvaluation {
    const ts = input.now?.() ?? new Date().toISOString();
    const factors: OpportunityFactor[] = input.factors.map((f) => ({
      key: f.key as OpportunityFactor['key'],
      value: f.value,
      status: f.status,
      evidence: f.evidence.slice(0, 4),
    }));
    const score = compositeScore(factors);
    const capitalBudgetInr = pickBudgetTier(input.capitalBudgetInr);
    const capitalMode = classifyCapitalMode(input.initialCostInr, capitalBudgetInr);
    const automationFactor = factors.find((f) => f.key === 'automationPotential');
    const aiFactor = factors.find((f) => f.key === 'aiLeverage');

    // The composite blends the EXISTING assessor's base (capability fit,
    // recent work, market signals) with the factor breakdown — but the
    // composite is never shown without its factors (never objective truth).
    const blended = Math.min(1, score * 0.7 + input.baseScore * 0.3);

    const businessCase = [
      ...input.baseBusinessCase,
      `${factors.filter((f) => f.status !== 'UNKNOWN').length} of ${factors.length} economics factors are evidence-backed; the rest are UNKNOWN.`,
      `Composite score is advisory (${blended.toFixed(2)}) — every factor is exposed below; it is never a promise.`,
    ];

    return {
      id: `eval-${ts.replace(/\D/g, '').slice(-8)}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: input.ownerId,
      title: input.title.slice(0, 160),
      description: input.description.slice(0, 400),
      category: input.category,
      score: blended,
      factors,
      businessCase,
      estimatedCost: input.baseEstimatedCost,
      estimatedRevenue: input.baseEstimatedRevenue,
      riskLevel: input.baseRiskLevel,
      capitalMode,
      capitalBudgetInr,
      automationPotential: labelFromFactor(automationFactor, 'UNKNOWN'),
      aiLeverage: labelFromFactor(aiFactor, 'UNKNOWN'),
      mvpPlan: input.baseMvpPlan.slice(0, 8),
      authorizationRequired: true,
      status: 'RESEARCHED',
      evidence: input.baseEvidence.slice(0, 8),
      createdAt: ts,
    };
  }
}

function pickBudgetTier(requested: number | undefined): number {
  const defaultTier = CAPITAL_BUDGET_TIERS_INR[0] ?? 0;
  if (requested === undefined) return defaultTier;
  const exact = CAPITAL_BUDGET_TIERS_INR.find((tier) => tier === requested);
  if (exact !== undefined) return exact;
  // Round to the nearest configured tier (bounded — never arbitrary).
  const sorted = [...CAPITAL_BUDGET_TIERS_INR].sort(
    (a, b) => Math.abs(a - requested) - Math.abs(b - requested),
  );
  return sorted[0] ?? defaultTier;
}

function labelFromFactor(
  factor: OpportunityFactor | undefined,
  fallback: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN',
): 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' {
  if (!factor || factor.status === 'UNKNOWN' || factor.value === undefined) return fallback;
  if (factor.value >= 0.66) return 'HIGH';
  if (factor.value >= 0.33) return 'MEDIUM';
  return 'LOW';
}
