// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · OpportunityDiscovery (SPRINT-038)
// A PRACTICAL problem→revenue-validation composition over the frozen estate —
// NOT an engine. Everything is deterministic, evidence-only and advisory:
//   • a problem without evidence is refused (no fabricated customers/revenue)
//   • THREE DISTINCT advisory scores (problem / business-opportunity /
//     experiment) — weights documented, factors exposed, UNKNOWN never zero
//   • an EXPLAINABLE problem level (0–4) driven by evidence
//   • a BOUNDED lifecycle — no opportunity jumps from an idea to a business
//   • revenue evidence states — "sounds useful" ≠ revenue; "I would pay" ≠
//     revenue; only VERIFIED payment evidence becomes REVENUE_VERIFIED
//   • a zero/low-cost experiment planner (NO_COST preferred, then LOW_COST,
//     then CAPITAL_REQUIRED — never spend when a cheaper experiment answers
//     the same question)
//   • a STOP (kill-bad-ideas) recommendation — the system CAN say "do not
//     build this"
//   • provider economics over the EXISTING Intelligence Fabric — existing
//     providers preferred; capability gaps become founder notifications with
//     NO automatic paid-provider adoption
//   • an advisory Business Candidate — produced only after sufficient
//     evidence; the founder remains the final authority
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BusinessCandidate,
  BusinessProblem,
  CapitalMode,
  CustomerDiscoveryPlan,
  ExperimentPlan,
  ObservationStatus,
  OpportunityRadar,
  OpportunityRadarEntry,
  ProblemAssessment,
  ProblemEvidence,
  ProblemFactor,
  ProblemLevel,
  ProblemLevelLabel,
  ProblemScoreResult,
  ProblemStatus,
  ProviderEconomicsResult,
  RevenueFigure,
  RevenueValidationState,
} from '../types/world-types.js';
import { CAPITAL_BUDGET_TIERS_INR } from '../types/world-types.js';
import type { WorldFabricPort } from '../contracts/world-ports.js';

// ── Sanitization ────────────────────────────────────────────────────────────
// External content is UNTRUSTED (Part B / source safety). Evidence text is
// sanitized before it is stored — scripts/markup/control characters stripped,
// length-bounded. Sanitization is NOT a security boundary by itself (the
// presentation layer escapes), but it removes the obvious injection vectors.
// eslint-disable-next-line no-control-regex -- Intentional control-char stripping of untrusted evidence text.
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/g;

export function sanitizeEvidenceText(text: string, maxLength = 500): string {
  return text
    .replace(/<[^>]*>/g, ' ') // strip markup/scripts
    .replace(CONTROL_CHAR_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// ── Stable keys + ids ───────────────────────────────────────────────────────

export function problemStableKey(ownerId: string, problemStatement: string): string {
  const slug = problemStatement
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${ownerId}:${slug || 'problem'}`;
}

export function evidenceId(
  ownerId: string,
  source: string,
  observedAt: string,
  index: number,
): string {
  const slug = `${source}:${observedAt}:${index}`.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 64);
  return `ev-${slug}`;
}

// ── Evidence validation (Part B) ────────────────────────────────────────────
// A problem requires at least one evidence record with provenance. Text is
// sanitized at the boundary. External evidence NEVER becomes authorization.

export function validateEvidence(
  input: {
    ownerId: string;
    source: ProblemEvidence['source'];
    observedAt?: string;
    reference?: string;
    text: string;
    confidence: ObservationStatus;
  },
  now: () => string,
  index = 0,
): { success: true; data: ProblemEvidence } | { success: false; error: string; code: string } {
  const text = sanitizeEvidenceText(input.text);
  if (text.length === 0) {
    return { success: false, error: 'Evidence text is required.', code: 'EVIDENCE_REQUIRED' };
  }
  return {
    success: true,
    data: {
      id: evidenceId(input.ownerId, input.source, input.observedAt ?? now(), index),
      ownerId: input.ownerId,
      source: input.source,
      observedAt: input.observedAt ?? now(),
      reference: input.reference?.slice(0, 240),
      text,
      confidence: input.confidence,
      evidenceOnly: true,
    },
  };
}

/** Deterministic confidence from the evidence set — VERIFIED only when a
 *  VERIFIED record exists; ESTIMATED when any ESTIMATED record exists;
 *  otherwise UNKNOWN. Never fabricated. */
export function deriveConfidence(evidence: ProblemEvidence[]): ObservationStatus {
  if (evidence.some((e) => e.confidence === 'VERIFIED')) return 'VERIFIED';
  if (evidence.some((e) => e.confidence === 'ESTIMATED')) return 'ESTIMATED';
  return 'UNKNOWN';
}

// ── Three advisory scores (Part C) ──────────────────────────────────────────
// Deterministic weighted composite over KNOWN factors ONLY — UNKNOWN factors
// contribute nothing (never converted to zero). Weights are documented and
// returned with every score so the composite is fully explainable. Scores are
// ADVISORY rankings, never objective truth.

export const PROBLEM_SCORE_WEIGHTS: Record<string, number> = {
  pain: 1.3,
  frequency: 1.1,
  humanEffort: 1.0,
  recurringCost: 1.2,
  revenueImpact: 1.4,
  errorImpact: 1.3,
  urgency: 1.0,
};

export const OPPORTUNITY_SCORE_WEIGHTS: Record<string, number> = {
  economicValue: 1.4,
  willingnessToPay: 1.4,
  buyerClarity: 1.2,
  aiFeasibility: 1.3,
  automationPotential: 1.1,
  competition: 1.0,
  differentiation: 0.9,
  salesDifficulty: 0.8,
  implementationComplexity: 0.8,
  deliveryCost: 0.7,
  expectedMargin: 1.2,
};

export const EXPERIMENT_SCORE_WEIGHTS: Record<string, number> = {
  experimentCost: 1.2,
  experimentDuration: 1.0,
  customerAccess: 1.1,
  dataAccess: 1.1,
  measurableOutcome: 1.3,
  reversibility: 0.8,
  risk: 1.0,
  expectedInformationGain: 1.3,
};

function weightedComposite(
  factors: ProblemFactor[],
  weights: Record<string, number>,
): {
  score: number;
  factors: ProblemFactor[];
  rationale: string[];
} {
  const known = factors.filter((f) => f.status !== 'UNKNOWN' && f.value !== undefined);
  const rationale: string[] = [];
  if (known.length === 0) {
    rationale.push('No evidence-backed factors — the score stays 0 (UNKNOWN never becomes zero).');
    return { score: 0, factors, rationale };
  }
  let total = 0;
  let weightSum = 0;
  for (const factor of known) {
    const weight = weights[factor.key];
    if (weight === undefined) continue; // unknown keys contribute nothing
    total += (factor.value ?? 0) * weight;
    weightSum += weight;
  }
  if (weightSum === 0) {
    rationale.push('No weighted factors — the score stays 0.');
    return { score: 0, factors, rationale };
  }
  const score = Math.min(1, Math.max(0, total / weightSum));
  rationale.push(
    `${known.length} of ${factors.length} factors are evidence-backed; the rest are UNKNOWN and contribute nothing.`,
    `Composite score is advisory (${score.toFixed(2)}) — every factor is exposed below; it is never a promise.`,
  );
  return { score, factors, rationale };
}

export function scoreProblem(factors: ProblemFactor[]): ProblemScoreResult {
  const { score, rationale } = weightedComposite(factors, PROBLEM_SCORE_WEIGHTS);
  return { score, factors, weights: { ...PROBLEM_SCORE_WEIGHTS }, rationale, advisory: true };
}

export function scoreBusinessOpportunity(factors: ProblemFactor[]): ProblemScoreResult {
  const { score, rationale } = weightedComposite(factors, OPPORTUNITY_SCORE_WEIGHTS);
  return { score, factors, weights: { ...OPPORTUNITY_SCORE_WEIGHTS }, rationale, advisory: true };
}

export function scoreExperiment(factors: ProblemFactor[]): ProblemScoreResult {
  const { score, rationale } = weightedComposite(factors, EXPERIMENT_SCORE_WEIGHTS);
  return { score, factors, weights: { ...EXPERIMENT_SCORE_WEIGHTS }, rationale, advisory: true };
}

// ── Problem LEVELS (Part D) — explainable, evidence-driven ──────────────────
// Level 0 INTERESTING (little/no demonstrated economic value) → Level 4
// MISSION_CRITICAL (significant financial/operational/compliance/customer or
// business risk). A high level does NOT automatically mean a good business —
// the level measures PAIN/SIGNIFICANCE, the opportunity score measures
// COMMERCIAL ATTRACTIVENESS.

export function classifyProblemLevel(
  problemScore: ProblemScoreResult,
  opportunityScore: ProblemScoreResult,
): { level: ProblemLevel; levelLabel: ProblemLevelLabel; reasons: string[] } {
  const reasons: string[] = [];
  const p = factorValue(problemScore.factors);
  const o = factorValue(opportunityScore.factors);

  // Mission critical: significant risk (error impact / urgency) — evidence only.
  if (p.errorImpact !== undefined && p.errorImpact >= 0.66) {
    reasons.push(
      `High error impact (${p.errorImpact.toFixed(2)}) — significant operational/customer risk.`,
    );
    return { level: 4, levelLabel: 'MISSION_CRITICAL', reasons };
  }
  if (p.urgency !== undefined && p.urgency >= 0.66) {
    reasons.push(`High urgency (${p.urgency.toFixed(2)}) — a mission-critical time pressure.`);
    return { level: 4, levelLabel: 'MISSION_CRITICAL', reasons };
  }
  // Revenue impacting: lost sales/leads/customers/productivity/revenue.
  if (p.revenueImpact !== undefined && p.revenueImpact >= 0.5) {
    reasons.push(
      `Revenue impact (${p.revenueImpact.toFixed(2)}) — the problem loses sales/leads/revenue.`,
    );
    return { level: 3, levelLabel: 'REVENUE_IMPACTING', reasons };
  }
  // Costly: meaningful recurring labour / cost.
  if (p.recurringCost !== undefined && p.recurringCost >= 0.5) {
    reasons.push(
      `Recurring cost (${p.recurringCost.toFixed(2)}) — meaningful recurring labour/cost.`,
    );
    return { level: 2, levelLabel: 'COSTLY', reasons };
  }
  if (p.humanEffort !== undefined && p.humanEffort >= 0.5) {
    reasons.push(`Human effort (${p.humanEffort.toFixed(2)}) — meaningful recurring labour.`);
    return { level: 2, levelLabel: 'COSTLY', reasons };
  }
  // Annoying: convenience / small time saving (any pain/frequency evidence).
  if (p.pain !== undefined || p.frequency !== undefined) {
    reasons.push(
      'Demonstrated annoyance (pain/frequency evidence) — convenience or small time saving.',
    );
    return { level: 1, levelLabel: 'ANNOYING', reasons };
  }
  // Interesting: little / no demonstrated economic value.
  const knownProblemFactors = problemScore.factors.filter((f) => f.status !== 'UNKNOWN').length;
  reasons.push(
    knownProblemFactors === 0
      ? 'No evidence-backed problem factors — the level stays 0 (INTERESTING) until evidence exists.'
      : 'No evidence of significant pain, cost, revenue impact or risk — INTERESTING, little demonstrated economic value.',
  );
  void o;
  return { level: 0, levelLabel: 'INTERESTING', reasons };
}

function factorValue(factors: ProblemFactor[]): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {};
  for (const f of factors) {
    if (f.status !== 'UNKNOWN' && f.value !== undefined) out[f.key] = f.value;
  }
  return out;
}

// ── Lifecycle (Part E) — bounded transitions, no idea→business jump ────────
// Every transition is validated against this table; an invalid transition is
// refused with a deterministic reason. REJECTED / DISMISSED / NEEDS_REVIEW are
// terminal review states (a NEEDS_REVIEW problem can move back to review).

const LIFECYCLE_TRANSITIONS: Record<ProblemStatus, ProblemStatus[]> = {
  OBSERVED: ['PROBLEM', 'REJECTED', 'DISMISSED'],
  PROBLEM: ['VALIDATED_PROBLEM', 'REJECTED', 'DISMISSED', 'NEEDS_REVIEW'],
  VALIDATED_PROBLEM: ['ECONOMIC_OPPORTUNITY', 'REJECTED', 'DISMISSED', 'NEEDS_REVIEW'],
  ECONOMIC_OPPORTUNITY: ['AI_FEASIBLE', 'REJECTED', 'DISMISSED', 'NEEDS_REVIEW'],
  AI_FEASIBLE: ['EXPERIMENT_CANDIDATE', 'REJECTED', 'DISMISSED'],
  EXPERIMENT_CANDIDATE: [
    'EXPERIMENT_APPROVAL_REQUIRED',
    'EXPERIMENT_RUNNING',
    'REJECTED',
    'DISMISSED',
  ],
  EXPERIMENT_APPROVAL_REQUIRED: ['EXPERIMENT_RUNNING', 'REJECTED', 'DISMISSED'],
  EXPERIMENT_RUNNING: ['EXPERIMENT_COMPLETED', 'NEEDS_REVIEW'],
  EXPERIMENT_COMPLETED: ['PAYMENT_EVIDENCE', 'REJECTED', 'DISMISSED', 'NEEDS_REVIEW'],
  PAYMENT_EVIDENCE: ['BUSINESS_CANDIDATE', 'REJECTED', 'DISMISSED'],
  BUSINESS_CANDIDATE: ['BUILD_RECOMMENDED', 'REJECTED', 'DISMISSED'],
  BUILD_RECOMMENDED: ['REJECTED', 'DISMISSED'],
  REJECTED: [],
  DISMISSED: [],
  NEEDS_REVIEW: ['PROBLEM', 'VALIDATED_PROBLEM', 'REJECTED', 'DISMISSED'],
};

export function canTransition(from: ProblemStatus, to: ProblemStatus): boolean {
  // eslint-disable-next-line security/detect-object-injection -- Closed ProblemStatus union key on a bounded lifecycle table; never user-controlled.
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}

export function transitionReason(from: ProblemStatus, to: ProblemStatus): string {
  if (from === to) return `The problem is already in ${to}.`;
  if (canTransition(from, to)) {
    return transitionJustification(from, to);
  }
  return `Transition ${from} → ${to} is not allowed by the bounded lifecycle (no opportunity jumps from an idea to a business).`;
}

function transitionJustification(from: ProblemStatus, to: ProblemStatus): string {
  switch (to) {
    case 'PROBLEM':
      return 'An observed opportunity becomes a PROBLEM once it has a problem statement + at least one evidence record.';
    case 'VALIDATED_PROBLEM':
      return 'The problem is VALIDATED when the evidence supports it (≥2 records, with a VERIFIED or ESTIMATED confidence).';
    case 'ECONOMIC_OPPORTUNITY':
      return 'A validated problem becomes an ECONOMIC_OPPORTUNITY when the business-opportunity score is evidence-backed (≥ 0.35).';
    case 'AI_FEASIBLE':
      return 'An economic opportunity becomes AI_FEASIBLE when AI suitability is evidenced (aiFeasibility ≥ 0.35).';
    case 'EXPERIMENT_CANDIDATE':
      return 'An AI-feasible opportunity becomes an EXPERIMENT_CANDIDATE when an experiment plan exists.';
    case 'EXPERIMENT_APPROVAL_REQUIRED':
      return 'A NO_COST experiment may run directly; any cost/external action requires the EXISTING approval authority first.';
    case 'EXPERIMENT_RUNNING':
      return 'The experiment is RUNNING only after approval where required (the existing authority decides) — never implied.';
    case 'EXPERIMENT_COMPLETED':
      return 'The experiment COMPLETED — the result is recorded; success/failure determines the next state.';
    case 'PAYMENT_EVIDENCE':
      return 'The problem reaches PAYMENT_EVIDENCE only with VERIFIED payment evidence (never interest or intent).';
    case 'BUSINESS_CANDIDATE':
      return 'A BUSINESS_CANDIDATE requires verified payment + willingness-to-pay evidence + a validated problem.';
    case 'BUILD_RECOMMENDED':
      return 'BUILD_RECOMMENDED is the advisory ceiling — the founder remains the final authority.';
    case 'REJECTED':
      return 'REJECTED — the opportunity is closed (evidence showed it is not worth pursuing).';
    case 'DISMISSED':
      return 'DISMISSED — the founder chose not to pursue it.';
    case 'NEEDS_REVIEW':
      return 'NEEDS_REVIEW — evidence is conflicting or incomplete; a human must review.';
    default:
      return `Valid bounded transition ${from} → ${to}.`;
  }
}

// ── Revenue evidence states (Part J) ────────────────────────────────────────
// Strict ladder with the ONLY verified path to revenue. Signals can only move
// the state FORWARD (never downgrade). VERIFIED payment evidence is counted
// from the problem's own evidence records (source 'verified_payment').

export type RevenueSignal =
  | 'INTEREST'
  | 'PROBLEM_CONFIRMED'
  | 'EXPERIMENT_SUCCESS'
  | 'WILLINGNESS_TO_PAY'
  | 'VERIFIED_PAYMENT'
  | 'REPEAT_PAYMENT'
  | 'REPEATABLE';

const REVENUE_LADDER: Record<RevenueValidationState, number> = {
  NO_EVIDENCE: 0,
  INTEREST: 1,
  PROBLEM_CONFIRMED: 2,
  EXPERIMENT_SUCCESS: 3,
  PAYING_INTEREST: 4,
  REVENUE_VERIFIED: 5,
  REPEAT_REVENUE: 6,
  REPEATABLE_BUSINESS: 7,
};

export function applyRevenueSignal(
  current: RevenueValidationState,
  signal: RevenueSignal,
  verifiedPaymentCount: number,
): { state: RevenueValidationState; reasons: string[] } {
  const reasons: string[] = [];

  switch (signal) {
    case 'VERIFIED_PAYMENT':
    case 'REPEAT_PAYMENT':
    case 'REPEATABLE': {
      if (verifiedPaymentCount >= 3) {
        reasons.push(
          'Three or more verified payments — repeatable revenue evidence (still advisory).',
        );
        return { state: maxState(current, 'REPEATABLE_BUSINESS'), reasons };
      }
      if (verifiedPaymentCount >= 2) {
        reasons.push(
          'Two verified payments — repeat revenue evidence (still advisory, not a promise).',
        );
        return { state: maxState(current, 'REPEAT_REVENUE'), reasons };
      }
      reasons.push(
        'A VERIFIED payment is the ONLY revenue-verification path — the state is REVENUE_VERIFIED.',
      );
      return { state: maxState(current, 'REVENUE_VERIFIED'), reasons };
    }
    case 'WILLINGNESS_TO_PAY':
      reasons.push(
        'Willingness-to-pay EVIDENCE ("I would pay ₹X") — this is PAYING_INTEREST, never revenue.',
      );
      return { state: maxState(current, 'PAYING_INTEREST'), reasons };
    case 'EXPERIMENT_SUCCESS':
      reasons.push(
        'The experiment succeeded — EXPERIMENT_SUCCESS is recorded; revenue still requires a verified payment.',
      );
      return { state: maxState(current, 'EXPERIMENT_SUCCESS'), reasons };
    case 'PROBLEM_CONFIRMED':
      reasons.push('The problem was confirmed by evidence.');
      return { state: maxState(current, 'PROBLEM_CONFIRMED'), reasons };
    case 'INTEREST':
      reasons.push('Customer interest ("sounds useful") is INTEREST — it is NOT revenue.');
      return { state: maxState(current, 'INTEREST'), reasons };
    default:
      reasons.push('No revenue evidence change.');
      return { state: current, reasons };
  }
}

function maxState(a: RevenueValidationState, b: RevenueValidationState): RevenueValidationState {
  // eslint-disable-next-line security/detect-object-injection -- Closed RevenueValidationState union key on a bounded ladder; never user-controlled.
  const rankA = REVENUE_LADDER[a];
  // eslint-disable-next-line security/detect-object-injection -- Closed RevenueValidationState union key on a bounded ladder; never user-controlled.
  const rankB = REVENUE_LADDER[b];
  return rankA >= rankB ? a : b;
}

// ── STOP recommendation (Part M) — the system CAN say "do not build this" ───
// Deterministic over the assessment + lifecycle + revenue state. Advisory.

export function recommendStop(input: { problem: BusinessProblem; assessment: ProblemAssessment }): {
  stop: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const problem = input.problem;
  const a = input.assessment;
  const ov = factorValue(a.opportunityScore.factors);

  if (a.problemScore.score < 0.3 && a.problemScore.factors.some((f) => f.status !== 'UNKNOWN')) {
    reasons.push(
      'Insufficient demonstrated pain — the problem score is below 0.3 despite evidence.',
    );
  }
  if (
    a.opportunityScore.score < 0.3 &&
    a.opportunityScore.factors.some((f) => f.status !== 'UNKNOWN')
  ) {
    reasons.push(
      'Insufficient economics — the business-opportunity score is below 0.3 despite evidence.',
    );
  }
  if (ov.aiFeasibility !== undefined && ov.aiFeasibility < 0.35) {
    reasons.push(
      'Poor AI feasibility — the required capability/quality is not reasonably achievable.',
    );
  }
  if (ov.competition !== undefined && ov.competition >= 0.75) {
    reasons.push('Excessive competition — the market is saturated (competition factor ≥ 0.75).');
  }
  if (ov.buyerClarity === undefined && !problem.buyer) {
    reasons.push('No identifiable buyer — buyer access is unproven (no buyer clarity evidence).');
  }
  if (ov.implementationComplexity !== undefined && ov.implementationComplexity >= 0.75) {
    reasons.push(
      'Excessive implementation complexity (≥ 0.75) — delivery cost/effort is likely prohibitive.',
    );
  }
  if (ov.expectedMargin !== undefined && ov.expectedMargin < 0.2) {
    reasons.push('Poor expected margin (< 0.2) — the economics do not support building.');
  }
  if (problem.status === 'EXPERIMENT_COMPLETED' && problem.revenueState === 'NO_EVIDENCE') {
    reasons.push(
      'The experiment completed without revenue evidence — do not build on unvalidated demand.',
    );
  }
  if (problem.status === 'REJECTED') {
    reasons.push('The opportunity was already rejected.');
  }
  if (a.stopRecommendation && a.stopRecommendation.stop) {
    reasons.push(...a.stopRecommendation.reasons);
  }
  return { stop: reasons.length > 0, reasons };
}

// ── Zero/low-cost experiment planner (Part F) ───────────────────────────────
// The CHEAPEST realistic validation experiment that can answer the question.
// NO_COST is always preferred; spending only when a cheaper experiment cannot
// answer the question; spending stays behind existing authorization.

export function planExperiment(
  input: {
    ownerId: string;
    problemId: string;
    hypothesis: string;
    targetCustomer: string;
    problemUnderTest: string;
    objective: string;
    minimumRequiredData: string[];
    actions: string[];
    estimatedAiCost?: RevenueFigure;
    humanEffort?: RevenueFigure;
    duration?: RevenueFigure;
    successCriteria: string[];
    failureCriteria: string[];
    stopConditions: string[];
    measurementMethod: string;
    expectedInformationGain?: RevenueFigure;
    maxBudget?: RevenueFigure;
    capitalBudgetInr?: number;
  },
  now: () => string,
): ExperimentPlan {
  const id = `exp-${now().replace(/\D/g, '').slice(-10)}-${Math.random().toString(36).slice(2, 6)}`;
  const budgetUsd = input.maxBudget?.value ?? 0;
  const capitalMode = classifyExperimentCapitalMode(input.maxBudget, input.capitalBudgetInr);
  // Approval is required when the experiment spends anything or acts externally.
  const approvalRequired =
    budgetUsd > 0 ||
    input.actions.some((a) => /(pay|buy|order|publish|post|email|send|hire|sign|commit)/i.test(a));
  const cheaper = cheaperAlternative(input);
  return {
    id,
    ownerId: input.ownerId,
    problemId: input.problemId,
    hypothesis: input.hypothesis.slice(0, 300),
    targetCustomer: input.targetCustomer.slice(0, 160),
    problemUnderTest: input.problemUnderTest.slice(0, 300),
    objective: input.objective.slice(0, 300),
    minimumRequiredData: input.minimumRequiredData.slice(0, 12),
    actions: input.actions.slice(0, 12),
    estimatedAiCost: input.estimatedAiCost,
    humanEffort: input.humanEffort,
    duration: input.duration,
    successCriteria: input.successCriteria.slice(0, 8),
    failureCriteria: input.failureCriteria.slice(0, 8),
    stopConditions: input.stopConditions.slice(0, 8),
    measurementMethod: input.measurementMethod.slice(0, 300),
    expectedInformationGain: input.expectedInformationGain,
    maxBudget: input.maxBudget,
    capitalMode,
    approvalRequired,
    cheaperAlternative: cheaper,
    status: approvalRequired ? 'APPROVAL_REQUIRED' : 'DRAFT',
    createdAt: now(),
    updatedAt: now(),
  };
}

function classifyExperimentCapitalMode(
  maxBudget?: RevenueFigure,
  capitalBudgetInr?: number,
): CapitalMode {
  if (!maxBudget || maxBudget.status === 'UNKNOWN') return 'NO_COST';
  if (maxBudget.value <= 0) return 'NO_COST';
  const tier = pickBudgetTier(capitalBudgetInr);
  if (maxBudget.value * 83 <= tier) return 'LOW_COST'; // approximate INR conversion is advisory only
  return 'CAPITAL_REQUIRED';
}

function pickBudgetTier(requested: number | undefined): number {
  const defaultTier = CAPITAL_BUDGET_TIERS_INR[0] ?? 0;
  if (requested === undefined) return defaultTier;
  const exact = CAPITAL_BUDGET_TIERS_INR.find((tier) => tier === requested);
  if (exact !== undefined) return exact;
  const sorted = [...CAPITAL_BUDGET_TIERS_INR].sort(
    (a, b) => Math.abs(a - requested) - Math.abs(b - requested),
  );
  return sorted[0] ?? defaultTier;
}

/** Advisory: when a cheaper experiment can answer the same question, it is
 *  always preferred (Part F — never spend when a cheaper experiment works). */
function cheaperAlternative(input: {
  minimumRequiredData: string[];
  actions: string[];
  maxBudget?: RevenueFigure;
}): string | undefined {
  if ((input.maxBudget?.value ?? 0) <= 0) return undefined;
  const hasData = input.minimumRequiredData.some((d) =>
    /(existing|available|public|already|interview)/i.test(d),
  );
  if (hasData) {
    return 'Existing/available data may answer the question — prefer a NO_COST analysis before spending.';
  }
  if (input.actions.some((a) => /(interview|survey|observe)/i.test(a))) {
    return 'Manual interviews/observations may answer the question at NO_COST before any paid experiment.';
  }
  return undefined;
}

// ── Customer discovery (Part G) — PREPARATION only, never fabricated results ─

export function buildCustomerDiscovery(input: {
  ownerId: string;
  problemId: string;
  customerProfile?: string;
  problemStatement: string;
  affectedRole?: string;
  currentSolution?: string;
}): CustomerDiscoveryPlan {
  const role = input.affectedRole?.slice(0, 120);
  const solution = input.currentSolution?.slice(0, 120);
  return {
    problemId: input.problemId,
    ownerId: input.ownerId,
    customerProfile: input.customerProfile?.slice(0, 300),
    interviewPlan: [
      `Find 3–5 people in the role${role ? ` of ${role}` : ''} who currently${solution ? ` ${solution}` : ' handle this work'} — the goal is PROBLEM validation, not selling.`,
      'Ask about the CURRENT solution first — how the work is done today, how often, how long it takes.',
      'Ask about the ECONOMIC impact — what a mistake costs, what lost time costs, what lost revenue costs.',
      'Ask about the BUYER — who decides, who pays, what budget exists.',
      'Ask about WILLINGNESS TO PAY — "how much would you pay to remove this?" — record it as WTP EVIDENCE, never revenue.',
      'Propose the cheapest experiment — never a paid commitment.',
    ],
    problemValidationQuestions: [
      `How often does this problem${role ? ` affect your ${role}` : ''}?`,
      'What happens today when the problem occurs?',
      'How much time does it cost you each time?',
      'How much would a mistake cost you?',
      'What have you tried so far?',
    ],
    currentSolutionQuestions: [
      `How do you${solution ? ` currently ${solution}` : ' handle this'} today?`,
      'What tools or people do you use?',
      'What is wrong with the current solution?',
      'How much does the current solution cost (time and money)?',
    ],
    economicImpactQuestions: [
      'What does this problem cost you per week/month?',
      'Does it lose you sales, leads, customers or productivity?',
      'How much revenue is affected?',
      'Who bears the cost — you, your team, or your customers?',
    ],
    buyerQuestions: [
      'Who decides to buy a solution for this?',
      'Who pays for it?',
      'What budget would this come from?',
      'How quickly could you decide to buy?',
    ],
    willingnessToPayQuestions: [
      'If this were solved, what would that save you?',
      'How much would you pay per month to remove this problem?',
      'Would you pay a one-time setup fee?',
      'What would you pay for the result, not the tool?',
    ],
    experimentProposal:
      'Propose the CHEAPEST experiment that answers: is the problem real, is it economically significant, and would the customer pay? Prefer NO_COST — interviews and observed data — before any spend.',
    advisory: true,
  };
}

// ── Business Candidate (Part N) — advisory, produced only after evidence ────

export function buildBusinessCandidate(
  input: {
    ownerId: string;
    problem: BusinessProblem;
    serviceDefinition: string;
    targetCustomer: string;
    pricingHypothesis?: RevenueFigure;
    deliveryWorkflow: string[];
    providerStrategy: string;
    aiCost?: RevenueFigure;
    humanCost?: RevenueFigure;
    marginHypothesis?: RevenueFigure;
    customerAcquisitionHypothesis?: string;
    mvpScope: string[];
    automationPotential?: RevenueFigure;
    risks: string[];
    nextExperiment?: string;
  },
  now: () => string,
): { success: true; data: BusinessCandidate } | { success: false; error: string; code: string } {
  const paymentEvidence = input.problem.evidence.filter(
    (e) => e.source === 'verified_payment',
  ).length;
  if (
    input.problem.revenueState !== 'REVENUE_VERIFIED' &&
    input.problem.revenueState !== 'REPEAT_REVENUE' &&
    input.problem.revenueState !== 'REPEATABLE_BUSINESS'
  ) {
    return {
      success: false,
      error:
        'A Business Candidate requires verified payment evidence (revenueState REVENUE_VERIFIED or higher).',
      code: 'REVENUE_NOT_VERIFIED',
    };
  }
  if (paymentEvidence === 0) {
    return {
      success: false,
      error: 'A Business Candidate requires at least one verified payment evidence record.',
      code: 'PAYMENT_EVIDENCE_REQUIRED',
    };
  }
  if (input.problem.willingnessToPayEvidence.length === 0) {
    return {
      success: false,
      error: 'A Business Candidate requires willingness-to-pay evidence (never fabricated).',
      code: 'WILLINGNESS_TO_PAY_REQUIRED',
    };
  }
  return {
    success: true,
    data: {
      problemId: input.problem.id,
      ownerId: input.ownerId,
      serviceDefinition: input.serviceDefinition.slice(0, 400),
      targetCustomer: input.targetCustomer.slice(0, 160),
      pricingHypothesis: input.pricingHypothesis,
      deliveryWorkflow: input.deliveryWorkflow.slice(0, 12),
      providerStrategy: input.providerStrategy.slice(0, 200),
      aiCost: input.aiCost,
      humanCost: input.humanCost,
      marginHypothesis: input.marginHypothesis,
      customerAcquisitionHypothesis: input.customerAcquisitionHypothesis?.slice(0, 300),
      mvpScope: input.mvpScope.slice(0, 12),
      automationPotential: input.automationPotential,
      risks: input.risks.slice(0, 12),
      nextExperiment: input.nextExperiment?.slice(0, 300),
      advisory: true,
      createdAt: now(),
    },
  };
}

// ── Provider economics (Part K) — reuse the EXISTING Intelligence Fabric ────
// For every required capability: select the cheapest SUITABLE existing
// provider through the fabric. Existing providers are PREFERRED when they
// satisfy the requirement. When none satisfies, a CAPABILITY GAP DETECTED
// founder notification is produced — with NO automatic paid-provider adoption.

export async function providerEconomics(input: {
  ownerId: string;
  problemId: string;
  requiredCapabilities: string[];
  qualityRequirement?: { capability: string; quality: number }[];
  fabric: WorldFabricPort;
  privacy: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'PRIVATE';
  strategy?: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
}): Promise<ProviderEconomicsResult> {
  const strategy = input.strategy ?? 'CHEAP';
  const selections: ProviderEconomicsResult['selections'] = [];
  const capabilityGaps: ProviderEconomicsResult['capabilityGaps'] = [];

  for (const capability of input.requiredCapabilities.slice(0, 12)) {
    let selection;
    try {
      selection = await input.fabric.selectStrategy({
        strategy,
        taskPrivacy: input.privacy,
        capability,
      });
    } catch {
      capabilityGaps.push({
        requiredCapability: capability,
        evaluatedProviders: [],
        whyInsufficient: [
          'The intelligence fabric is unavailable — no provider selection could be made.',
        ],
        founderApprovalRequired: true,
      });
      continue;
    }
    const qualityNeed = input.qualityRequirement?.find((q) => q.capability === capability);
    const selected = selection.selected;
    const meetsQuality =
      selected && qualityNeed ? (selected.quality ?? 0) >= qualityNeed.quality : true;
    if (selected && selected.capabilityMatched && meetsQuality) {
      selections.push({
        capability,
        providerId: selected.providerId,
        modelId: selected.modelId,
        strategy: selection.strategy,
        reasons: selection.reasons.slice(0, 4),
        preferredExisting: true,
      });
    } else {
      // CAPABILITY GAP DETECTED — a founder notification, never auto-adoption.
      const why: string[] = [];
      if (selected && !selected.capabilityMatched) {
        why.push(`No existing provider matched the capability ${capability}.`);
      } else if (selected && qualityNeed) {
        why.push(
          `The best existing candidate quality (${(selected.quality ?? 0).toFixed(2)}) is below the required ${qualityNeed.quality.toFixed(2)}.`,
        );
      } else {
        why.push(`No existing provider could serve ${capability} within the ${strategy} strategy.`);
      }
      if (selection.ranked.length > 0) {
        why.push(
          `Evaluated existing providers: ${selection.ranked
            .map((c) => c.name)
            .slice(0, 6)
            .join(', ')}.`,
        );
      }
      if (selection.reasons.length > 0) {
        why.push(...selection.reasons.slice(0, 2));
      }
      capabilityGaps.push({
        requiredCapability: capability,
        requiredQuality: qualityNeed ? `quality ≥ ${qualityNeed.quality.toFixed(2)}` : undefined,
        evaluatedProviders: selection.ranked.map((c) => c.providerId).slice(0, 8),
        whyInsufficient: why,
        // Advisory: a local/open-source alternative is named when one exists;
        // the fabric's reasons carry that evidence.
        localOpenSourceAlternative: selection.ranked.find((c) => c.localAvailability === 'yes')
          ?.name,
        privacyImplications:
          input.privacy === 'PRIVATE'
            ? 'PRIVATE — only local/private providers are acceptable; no public fallback.'
            : undefined,
        founderApprovalRequired: true,
      });
    }
  }
  return { problemId: input.problemId, selections, capabilityGaps, advisory: true };
}

// ── Opportunity Radar (Part I) — presentation-only read model ───────────────

export function buildOpportunityRadar(input: {
  ownerId: string;
  problems: BusinessProblem[];
  now: () => string;
  limit?: number;
}): OpportunityRadar {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 50);
  const counts = {
    newProblems: 0,
    validatedProblems: 0,
    highValueProblems: 0,
    experimentCandidates: 0,
    runningExperiments: 0,
    completedExperiments: 0,
    paymentEvidence: 0,
    businessCandidates: 0,
    rejectedOpportunities: 0,
  };
  const entries: OpportunityRadarEntry[] = input.problems
    .slice(0, limit)
    .map((p) => {
      const isHighValue = (p.assessment?.opportunityScore.score ?? 0) >= 0.5;
      if (p.status === 'PROBLEM' || p.status === 'OBSERVED') counts.newProblems += 1;
      if (p.status === 'VALIDATED_PROBLEM') counts.validatedProblems += 1;
      if (isHighValue) counts.highValueProblems += 1;
      if (
        p.status === 'EXPERIMENT_CANDIDATE' ||
        p.status === 'EXPERIMENT_APPROVAL_REQUIRED' ||
        p.status === 'AI_FEASIBLE'
      )
        counts.experimentCandidates += 1;
      if (p.status === 'EXPERIMENT_RUNNING') counts.runningExperiments += 1;
      if (p.status === 'EXPERIMENT_COMPLETED') counts.completedExperiments += 1;
      if (p.status === 'PAYMENT_EVIDENCE') counts.paymentEvidence += 1;
      if (p.status === 'BUSINESS_CANDIDATE' || p.status === 'BUILD_RECOMMENDED')
        counts.businessCandidates += 1;
      if (p.status === 'REJECTED' || p.status === 'DISMISSED') counts.rejectedOpportunities += 1;
      return {
        problemId: p.id,
        problemStatement: p.problemStatement.slice(0, 160),
        status: p.status,
        revenueState: p.revenueState,
        level: p.level,
        levelLabel: p.levelLabel,
        scores: p.assessment
          ? {
              problemScore: p.assessment.problemScore.score,
              opportunityScore: p.assessment.opportunityScore.score,
              experimentScore: p.assessment.experimentScore.score,
            }
          : undefined,
        evidenceCount: p.evidence.length,
        hasVerifiedPayment: p.evidence.some((e) => e.source === 'verified_payment'),
        stopReason: p.stopReason,
        nextAction: nextActionFor(p),
      };
    })
    .sort((a, b) => rankProblem(b) - rankProblem(a));

  return {
    ownerId: input.ownerId,
    generatedAt: input.now(),
    entries,
    counts,
    advisory: true,
  };
}

/** Deterministic advisory sort — high-value, actionable problems first. */
function rankProblem(p: OpportunityRadarEntry): number {
  const score = p.scores ? p.scores.opportunityScore * 2 + p.scores.problemScore : 0;
  let statusBonus = 0;
  if (p.status === 'EXPERIMENT_APPROVAL_REQUIRED' || p.status === 'EXPERIMENT_CANDIDATE')
    statusBonus = 3;
  if (p.status === 'EXPERIMENT_RUNNING' || p.status === 'EXPERIMENT_COMPLETED') statusBonus = 2;
  if (p.status === 'PAYMENT_EVIDENCE' || p.status === 'BUSINESS_CANDIDATE') statusBonus = 2;
  if (p.revenueState === 'REVENUE_VERIFIED' || p.revenueState === 'REPEAT_REVENUE')
    statusBonus += 1;
  if (p.stopReason) statusBonus -= 3;
  if (p.status === 'REJECTED' || p.status === 'DISMISSED') statusBonus -= 10;
  return score + statusBonus;
}

function nextActionFor(p: BusinessProblem): string {
  switch (p.status) {
    case 'OBSERVED':
      return 'Add the problem statement + first evidence record.';
    case 'PROBLEM':
      return 'Collect more evidence (interviews / data) to VALIDATE the problem.';
    case 'VALIDATED_PROBLEM':
      return 'Assess the business opportunity (economics factors) — decide whether it is economically attractive.';
    case 'ECONOMIC_OPPORTUNITY':
      return 'Evidence AI suitability (aiFeasibility) before designing an experiment.';
    case 'AI_FEASIBLE':
      return 'Design the cheapest validation experiment (NO_COST preferred).';
    case 'EXPERIMENT_CANDIDATE':
      return p.assessment?.experimentCapitalMode === 'NO_COST'
        ? 'Start the NO_COST experiment.'
        : 'Request approval through the existing authority before the experiment spends anything.';
    case 'EXPERIMENT_APPROVAL_REQUIRED':
      return 'The experiment requires the existing approval authority — request founder approval.';
    case 'EXPERIMENT_RUNNING':
      return 'Run the experiment; record the result when it completes.';
    case 'EXPERIMENT_COMPLETED':
      return p.stopReason
        ? `STOP recommended: ${p.stopReason.slice(0, 140)}`
        : 'Record the result and seek VERIFIED payment evidence — interest is not revenue.';
    case 'PAYMENT_EVIDENCE':
      return 'With verified payment + willingness-to-pay evidence, the problem may become a BUSINESS_CANDIDATE.';
    case 'BUSINESS_CANDIDATE':
      return 'Prepare the service definition + MVP scope; the founder decides whether to build.';
    case 'BUILD_RECOMMENDED':
      return 'Advisory ceiling reached — the founder is the final authority.';
    case 'REJECTED':
      return 'Closed — evidence showed it is not worth pursuing.';
    case 'DISMISSED':
      return 'Closed — the founder chose not to pursue it.';
    case 'NEEDS_REVIEW':
      return 'Evidence is conflicting/incomplete — a human must review before it moves on.';
    default:
      return 'Review the problem.';
  }
}
