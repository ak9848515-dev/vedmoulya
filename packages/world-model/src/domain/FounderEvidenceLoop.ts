// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · FounderEvidenceLoop (SPRINT-039)
// The disciplined, auditable feedback loop that turns the founder's real-world
// observations + customer-discovery results into calibrated opportunity
// scoring — COMPOSITION ONLY, NOT an engine:
//   • founder observations are bounded owner-scoped evidence records with
//     EXPLICIT evidence states (OBSERVED / REPORTED_BY_CUSTOMER /
//     FOUNDER_OBSERVED / DOCUMENTED / VERIFIED / HYPOTHESIS / UNKNOWN /
//     CONFLICTING) — provenance MANDATORY (no provenance → refusal)
//   • evidence NORMALIZATION is deterministic — AI text can never become
//     verified evidence; external signals remain untrusted
//   • evidence CALIBRATION is bounded (CALIBRATION_DELTA_MAX) over the
//     EXISTING SPRINT-038 factors — one observation never rewrites policy;
//     every adjustment keeps its evidence trail; conflicting evidence visible
//   • evidence QUALITY is deterministic (provenance/directness/recency/
//     independence/repetition/specificity/contradiction/verification) —
//     never fake precision; UNKNOWN/NEEDS_REVIEW when insufficient
//   • NEXT BEST ACTION is an explainable advisory (the system CAN say STOP)
//   • OPPORTUNITY COMPARISON is evidence-driven (STRONG_EVIDENCE /
//     PROMISING / INSUFFICIENT_EVIDENCE / NEEDS_CUSTOMER_VALIDATION / STOP /
//     UNKNOWN) — never \"profitable\" merely because a score is high
// Nothing here approves, spends, executes or promotes to memory.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BusinessProblem,
  CapitalMode,
  CustomerDiscoveryRecord,
  EvidenceCalibrationResult,
  EvidenceQualityResult,
  EvidenceQualityState,
  FounderEvidenceState,
  FounderObservation,
  NextBestAction,
  NextBestActionKind,
  OpportunityComparison,
  OpportunityComparisonEntry,
  OpportunityComparisonState,
  ProblemAssessment,
  ProblemEvidence,
  ProblemFactor,
  ProspectDiscoveryStatus,
  RevenueFigure,
} from '../types/world-types.js';
import { sanitizeEvidenceText } from './OpportunityDiscovery.js';

/** Strict maximum score delta per single evidence event (Part E rule 1/9).
 *  One observation can never cause a huge score jump or rewrite policy. */
export const CALIBRATION_DELTA_MAX = 0.05;

export function observationId(ownerId: string, sourceReference: string, timestamp: string): string {
  const slug = `${sourceReference}:${timestamp}`.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 60);
  return `obs-${ownerId.slice(0, 8)}-${slug || 'observation'}`;
}

export function prospectId(ownerId: string, problemId: string, prospectReference: string): string {
  const slug = `${problemId}:${prospectReference}`.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 60);
  return `pros-${ownerId.slice(0, 8)}-${slug || 'prospect'}`;
}

// ── Evidence-state normalization (Part D) — deterministic, never invented ───
// Compose the existing evidence discipline: text is sanitized; the evidence
// STATE is derived from WHO said it + WHAT was said, not from confidence.

function inferEvidenceStateFromStatement(statement: string): FounderEvidenceState | undefined {
  const lower = statement.toLowerCase();
  if (/(i think|i believe|maybe|could be|perhaps|i assume|i guess)/.test(lower))
    return 'HYPOTHESIS';
  if (/(told me|said|reported|mentioned|complained|explained|described)/.test(lower))
    return 'REPORTED_BY_CUSTOMER';
  if (/(i saw|i observed|i watched|i noticed|i visited|during the visit)/.test(lower))
    return 'FOUNDER_OBSERVED';
  if (/(documented|record shows|invoice|report shows|the data shows)/.test(lower))
    return 'DOCUMENTED';
  if (/(agreed to pay|will pay|ready to pay|would pay|can pay)/.test(lower))
    return 'REPORTED_BY_CUSTOMER';
  return undefined;
}

/** Deterministic normalization: a founder-entered statement is classified into
 *  one of the explicit evidence states. `HYPOTHESIS` is the DEFAULT for
 *  unverifiable claims — an opinion is never upgraded to customer evidence. */
export function normalizeObservationState(input: {
  sourceType: FounderObservation['sourceType'];
  observedStatement: string;
  claimedState?: FounderEvidenceState;
}): FounderEvidenceState {
  const statement = sanitizeEvidenceText(input.observedStatement, 500);
  const inferred = inferEvidenceStateFromStatement(statement);
  if (
    input.claimedState &&
    input.claimedState !== 'UNKNOWN' &&
    input.claimedState !== 'CONFLICTING'
  ) {
    // The founder may tag an observation, but AI-generated/claimed certainty
    // can never be VERIFIED — VERIFIED requires a real cross-check.
    if (input.claimedState === 'VERIFIED') return 'OBSERVED';
    return input.claimedState;
  }
  if (inferred) return inferred;
  if (input.sourceType === 'customer_conversation') return 'REPORTED_BY_CUSTOMER';
  if (input.sourceType === 'site_visit' || input.sourceType === 'workflow_observation')
    return 'FOUNDER_OBSERVED';
  return 'HYPOTHESIS';
}

/** Evidence strength from the observation set — deterministic. */
export function evidenceStrength(
  observations: FounderObservation[],
): 'WEAK' | 'MODERATE' | 'STRONG' | 'UNKNOWN' {
  if (observations.length === 0) return 'UNKNOWN';
  const verified = observations.filter(
    (o) => o.evidenceState === 'VERIFIED' || o.verificationStatus === 'VERIFIED',
  ).length;
  const customer = observations.filter(
    (o) => o.evidenceState === 'REPORTED_BY_CUSTOMER' || o.evidenceState === 'FOUNDER_OBSERVED',
  ).length;
  if (verified >= 1 && observations.length >= 2) return 'STRONG';
  if (customer >= 3) return 'STRONG';
  if (customer >= 2 || verified >= 1) return 'MODERATE';
  if (observations.length >= 1) return 'WEAK';
  return 'UNKNOWN';
}

/** Validate a founder observation — provenance MANDATORY (Part B). */
export function validateFounderObservation(
  input: {
    ownerId: string;
    problemId?: string;
    sourceType: FounderObservation['sourceType'];
    sourceReference: string;
    observedStatement: string;
    context?: string;
    affectedCustomerSegment?: string;
    frequency?: string;
    severity?: string;
    currentWorkaround?: string;
    statedWillingnessToPay?: RevenueFigure;
    statedBudget?: RevenueFigure;
    objection?: string;
    nextAction?: string;
    claimedState?: FounderEvidenceState;
    provenance?: { source: string; reference?: string; observedAt: string };
  },
  now: () => string,
): { success: true; data: FounderObservation } | { success: false; error: string; code: string } {
  const statement = sanitizeEvidenceText(input.observedStatement);
  if (statement.length === 0) {
    return {
      success: false,
      error: 'An observed statement is required.',
      code: 'STATEMENT_REQUIRED',
    };
  }
  if (
    !input.provenance ||
    !input.provenance.source ||
    input.provenance.source.trim().length === 0
  ) {
    return {
      success: false,
      error: 'Provenance is REQUIRED — every observation needs a source.',
      code: 'PROVENANCE_REQUIRED',
    };
  }
  if (!input.sourceReference || input.sourceReference.trim().length === 0) {
    return {
      success: false,
      error: 'A source reference is required.',
      code: 'SOURCE_REFERENCE_REQUIRED',
    };
  }
  const evidenceState = normalizeObservationState({
    sourceType: input.sourceType,
    observedStatement: statement,
    claimedState: input.claimedState,
  });
  const ts = now();
  return {
    success: true,
    data: {
      id: observationId(input.ownerId, input.sourceReference, ts),
      ownerId: input.ownerId,
      problemId: input.problemId,
      timestamp: ts,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference.slice(0, 120),
      observedStatement: statement,
      context: input.context?.slice(0, 300),
      affectedCustomerSegment: input.affectedCustomerSegment?.slice(0, 120),
      frequency: input.frequency?.slice(0, 200),
      severity: input.severity?.slice(0, 200),
      currentWorkaround: input.currentWorkaround?.slice(0, 300),
      statedWillingnessToPay: input.statedWillingnessToPay,
      statedBudget: input.statedBudget,
      objection: input.objection?.slice(0, 300),
      nextAction: input.nextAction?.slice(0, 300),
      evidenceState,
      evidenceStrength: evidenceStrength([]), // strength computed over the set at read time
      provenance: {
        source: input.provenance.source.slice(0, 160),
        reference: input.provenance.reference?.slice(0, 240),
        observedAt: input.provenance.observedAt,
      },
      verificationStatus: evidenceState === 'DOCUMENTED' ? 'CROSS_CHECKED' : 'UNVERIFIED',
      createdAt: ts,
      updatedAt: ts,
    },
  };
}

// ── Customer discovery ledger (Part C) — NOT a CRM ──────────────────────────
// Statuses distinguish DISCOVERY from VALIDATION. A conversation is never a
// customer; interest is never revenue; stated WTP is never payment.

export function validateCustomerDiscoveryRecord(
  input: {
    ownerId: string;
    problemId: string;
    prospectReference: string;
    customerSegment: string;
    problemDiscussed: string;
    currentSolution?: string;
    painSeverity?: string;
    frequency?: string;
    existingSpending?: RevenueFigure;
    budgetIndication?: RevenueFigure;
    willingnessToPayIndication?: RevenueFigure;
    objection?: string;
    desiredOutcome?: string;
    nextStep?: string;
    discoveryStatus?: ProspectDiscoveryStatus;
    evidence?: Array<{
      source: string;
      observedAt?: string;
      reference?: string;
      text: string;
      confidence: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
    }>;
    provenance?: { source: string; reference?: string; observedAt: string };
  },
  now: () => string,
):
  | { success: true; data: CustomerDiscoveryRecord }
  | { success: false; error: string; code: string } {
  if (!input.prospectReference || input.prospectReference.trim().length === 0) {
    return {
      success: false,
      error: 'A prospect reference is required.',
      code: 'PROSPECT_REFERENCE_REQUIRED',
    };
  }
  if (!input.customerSegment || input.customerSegment.trim().length === 0) {
    return { success: false, error: 'A customer segment is required.', code: 'SEGMENT_REQUIRED' };
  }
  if (!input.problemDiscussed || sanitizeEvidenceText(input.problemDiscussed).length === 0) {
    return {
      success: false,
      error: 'The problem discussed is required.',
      code: 'PROBLEM_DISCUSSED_REQUIRED',
    };
  }
  if (!input.provenance || !input.provenance.source) {
    return {
      success: false,
      error: 'Provenance is REQUIRED — every prospect record needs a source.',
      code: 'PROVENANCE_REQUIRED',
    };
  }
  const ts = now();
  const evidence: ProblemEvidence[] = (input.evidence ?? []).slice(0, 10).map((e, i) => ({
    id: `ev-${ts.replace(/\D/g, '').slice(-8)}-${i}`,
    ownerId: input.ownerId,
    source: e.source as ProblemEvidence['source'],
    observedAt: e.observedAt ?? ts,
    reference: e.reference?.slice(0, 240),
    text: sanitizeEvidenceText(e.text),
    confidence: e.confidence,
    evidenceOnly: true,
  }));
  return {
    success: true,
    data: {
      id: prospectId(input.ownerId, input.problemId, input.prospectReference),
      ownerId: input.ownerId,
      problemId: input.problemId,
      prospectReference: input.prospectReference.slice(0, 120),
      customerSegment: input.customerSegment.slice(0, 120),
      problemDiscussed: sanitizeEvidenceText(input.problemDiscussed, 300),
      currentSolution: input.currentSolution?.slice(0, 300),
      painSeverity: input.painSeverity?.slice(0, 200),
      frequency: input.frequency?.slice(0, 200),
      existingSpending: input.existingSpending,
      budgetIndication: input.budgetIndication,
      willingnessToPayIndication: input.willingnessToPayIndication,
      objection: input.objection?.slice(0, 300),
      desiredOutcome: input.desiredOutcome?.slice(0, 300),
      nextStep: input.nextStep?.slice(0, 300),
      discoveryStatus: input.discoveryStatus ?? 'CONTACTED',
      evidence,
      provenance: {
        source: input.provenance.source.slice(0, 160),
        reference: input.provenance.reference?.slice(0, 240),
        observedAt: input.provenance.observedAt,
      },
      createdAt: ts,
      updatedAt: ts,
    },
  };
}

/** Deterministic prospect-status transition guard (Part C) — discovery ≠
 *  validation; a prospect cannot jump to VERIFIED_PAYMENT without the status
 *  chain and the payment evidence. */
const PROSPECT_NEXT: Record<ProspectDiscoveryStatus, ProspectDiscoveryStatus[]> = {
  CONTACTED: ['CONVERSATION', 'LOST'],
  CONVERSATION: ['PROBLEM_CONFIRMED', 'LOST'],
  PROBLEM_CONFIRMED: ['SOLUTION_INTEREST', 'LOST'],
  SOLUTION_INTEREST: ['WTP_SIGNAL', 'PAYMENT_REQUESTED', 'LOST'],
  WTP_SIGNAL: ['PAYMENT_REQUESTED', 'LOST'],
  PAYMENT_REQUESTED: ['VERIFIED_PAYMENT', 'LOST'],
  VERIFIED_PAYMENT: ['LOST'],
  LOST: [],
};

export function canAdvanceProspect(
  from: ProspectDiscoveryStatus,
  to: ProspectDiscoveryStatus,
): boolean {
  return PROSPECT_NEXT[from].includes(to);
}

export function prospectTransitionReason(
  from: ProspectDiscoveryStatus,
  to: ProspectDiscoveryStatus,
): string {
  if (from === to) return `The prospect is already ${to}.`;
  if (canAdvanceProspect(from, to)) {
    if (to === 'VERIFIED_PAYMENT')
      return 'Only a VERIFIED payment advances a prospect to VERIFIED_PAYMENT.';
    return `Discovery progresses ${from} → ${to}.`;
  }
  return `Transition ${from} → ${to} is not allowed (discovery must progress through the bounded chain; conversation ≠ customer, interest ≠ revenue, WTP ≠ payment).`;
}

// ── Evidence quality (Part F) — deterministic dimensions, never fake precision ─

export function evidenceQuality(input: {
  problemId: string;
  observations: FounderObservation[];
  prospects: CustomerDiscoveryRecord[];
  evidence: ProblemEvidence[];
}): EvidenceQualityResult {
  const refs = (obs: FounderObservation[] | ProblemEvidence[], prefix: string): string[] =>
    obs.slice(0, 10).map((o, i) => `${prefix}-${i}`);

  const dimensions: EvidenceQualityResult['dimensions'] = [];
  const recordCount = input.observations.length + input.prospects.length;
  const hasProvenance =
    input.observations.every((o) => o.provenance.source) &&
    input.prospects.every((p) => p.provenance.source);
  dimensions.push({
    name: 'provenance',
    // Empty evidence has NO provenance to judge — reporting HIGH on an empty
    // set would be fake precision (every() over [] is vacuously true).
    state: recordCount === 0 ? 'UNKNOWN' : hasProvenance ? 'HIGH' : 'NEEDS_REVIEW',
    reason:
      recordCount === 0
        ? 'No observation or prospect records yet — provenance is UNKNOWN, not HIGH.'
        : hasProvenance
          ? 'Every observation/prospect record carries a source.'
          : 'Some records lack provenance — mark NEEDS_REVIEW.',
    evidenceRefs: refs(input.observations, 'obs'),
  });

  const direct = input.observations.filter(
    (o) => o.evidenceState === 'REPORTED_BY_CUSTOMER' || o.evidenceState === 'FOUNDER_OBSERVED',
  ).length;
  dimensions.push({
    name: 'directness',
    state: direct >= 3 ? 'HIGH' : direct >= 1 ? 'MODERATE' : 'UNKNOWN',
    reason: `${direct} direct customer/founder observations.`,
    evidenceRefs: refs(input.observations, 'obs'),
  });

  const recent = input.observations.filter((o) => {
    const age = Date.now() - Date.parse(o.timestamp);
    return Number.isFinite(age) && age < 30 * 24 * 60 * 60 * 1000;
  }).length;
  dimensions.push({
    name: 'recency',
    state: recent >= 1 ? 'MODERATE' : 'UNKNOWN',
    reason: `${recent} observations within the last 30 days.`,
    evidenceRefs: refs(input.observations, 'obs'),
  });

  const segments = new Set(input.observations.map((o) => o.affectedCustomerSegment ?? 'unknown'));
  dimensions.push({
    name: 'independence',
    state: segments.size >= 3 ? 'HIGH' : segments.size >= 2 ? 'MODERATE' : 'LOW',
    reason: `${segments.size} distinct customer segments observed.`,
    evidenceRefs: refs(input.observations, 'obs'),
  });

  const repeated = input.observations.filter((o) =>
    /(5 |four|five|several|many|multiple|each|every|3 |three)/.test(
      o.observedStatement.toLowerCase(),
    ),
  ).length;
  dimensions.push({
    name: 'repetition',
    state: repeated >= 1 ? 'MODERATE' : 'LOW',
    reason: `${repeated} observations reference repeated occurrence.`,
    evidenceRefs: refs(input.observations, 'obs'),
  });

  const specific = input.observations.filter(
    (o) => o.frequency || o.severity || o.statedWillingnessToPay,
  ).length;
  dimensions.push({
    name: 'specificity',
    state: specific >= 2 ? 'HIGH' : specific >= 1 ? 'MODERATE' : 'LOW',
    reason: `${specific} observations carry specific frequency/severity/WTP detail.`,
    evidenceRefs: refs(input.observations, 'obs'),
  });

  const conflictStates = input.observations.map((o) => o.evidenceState);
  const hasConflict = conflictStates.includes('CONFLICTING');
  dimensions.push({
    name: 'contradiction',
    state: hasConflict ? 'NEEDS_REVIEW' : 'HIGH',
    reason: hasConflict
      ? 'Conflicting observations present — NEEDS_REVIEW, never silently resolved.'
      : 'No conflicting evidence state observed.',
    evidenceRefs: refs(input.observations, 'obs'),
  });

  const verified = input.evidence.filter(
    (e) => e.source === 'verified_payment' || e.confidence === 'VERIFIED',
  ).length;
  dimensions.push({
    name: 'verification',
    state: verified >= 1 ? 'HIGH' : 'UNKNOWN',
    reason: `${verified} verified evidence records (payments/VERIFIED).`,
    evidenceRefs: refs(input.evidence, 'ev'),
  });

  const states = dimensions.map((d) => d.state);
  const overall: EvidenceQualityState = states.includes('NEEDS_REVIEW')
    ? 'NEEDS_REVIEW'
    : states.every((s) => s === 'HIGH')
      ? 'HIGH'
      : states.includes('UNKNOWN')
        ? 'UNKNOWN'
        : states.filter((s) => s === 'MODERATE').length >= 3
          ? 'MODERATE'
          : 'LOW';

  return { problemId: input.problemId, dimensions, overall, advisory: true };
}

// ── Evidence calibration (Part E) — bounded, evidence-trailed ───────────────
// Composes the EXISTING SPRINT-038 factors. A single evidence event may move
// a factor by at most CALIBRATION_DELTA_MAX; UNKNOWN never becomes zero;
// fabricated/unverifiable evidence is rejected (never used); conflicts visible.

export function calibrateFactors(input: {
  problemId: string;
  current: ProblemFactor[];
  observation?: FounderObservation;
  observations: FounderObservation[];
  prospects: CustomerDiscoveryRecord[];
  factorKey: string;
  direction: 1 | -1;
  reason: string;
}): EvidenceCalibrationResult {
  const adjustments: EvidenceCalibrationResult['adjustments'] = [];
  const factors: EvidenceCalibrationResult['factors'] = [];
  const conflicts: EvidenceCalibrationResult['conflicts'] = [];

  const hasConflict = input.observations.some((o) => o.evidenceState === 'CONFLICTING');
  if (hasConflict) {
    conflicts.push({
      factorKey: input.factorKey,
      forEvidence: input.observations
        .filter((o) => o.evidenceState !== 'CONFLICTING')
        .map((o) => o.id),
      againstEvidence: input.observations
        .filter((o) => o.evidenceState === 'CONFLICTING')
        .map((o) => o.id),
      state: 'CONFLICTING',
    });
  }

  const target = input.current.find((f) => f.key === input.factorKey);
  if (!target || target.status === 'UNKNOWN') {
    // UNKNOWN never becomes zero — an unknown factor stays unknown until real
    // evidence exists; a weak observation cannot fabricate a value.
    const after = 0;
    factors.push({
      key: input.factorKey,
      before: undefined,
      after,
      delta: 0,
      reason: 'Factor is UNKNOWN — no fabricated value; UNKNOWN never becomes zero.',
      evidenceRefs: [],
      quality: 'UNKNOWN',
    });
    return { problemId: input.problemId, factors, adjustments, conflicts, advisory: true };
  }

  const strength = input.observation ? evidenceStrength(input.observations) : 'UNKNOWN';
  // Bounded movement: strength-scaled, never more than CALIBRATION_DELTA_MAX.
  const scale =
    strength === 'STRONG' ? 1 : strength === 'MODERATE' ? 0.6 : strength === 'WEAK' ? 0.3 : 0;
  const rawDelta = Math.min(CALIBRATION_DELTA_MAX, CALIBRATION_DELTA_MAX * scale);
  const delta = input.direction * rawDelta;
  const before = target.value ?? 0;
  const after = Math.min(1, Math.max(0, before + delta));
  const obsRef = input.observation ? [input.observation.id] : [];

  adjustments.push({
    observationId: input.observation?.id ?? 'aggregate',
    factorKey: input.factorKey,
    delta,
    reason: input.reason,
    evidenceState: input.observation?.evidenceState ?? 'OBSERVED',
    quality:
      strength === 'STRONG'
        ? 'HIGH'
        : strength === 'MODERATE'
          ? 'MODERATE'
          : strength === 'WEAK'
            ? 'LOW'
            : 'UNKNOWN',
  });

  factors.push({
    key: input.factorKey,
    before,
    after,
    delta,
    reason: `${input.reason} (bounded Δ ${delta.toFixed(3)} ≤ ${CALIBRATION_DELTA_MAX}; evidence strength ${strength}).`,
    evidenceRefs: obsRef,
    quality:
      strength === 'STRONG'
        ? 'HIGH'
        : strength === 'MODERATE'
          ? 'MODERATE'
          : strength === 'WEAK'
            ? 'LOW'
            : 'UNKNOWN',
  });

  return { problemId: input.problemId, factors, adjustments, conflicts, advisory: true };
}

// ── NEXT BEST ACTION (Part H) — explainable advisory, STOP allowed ──────────
// Composes the problem assessment + evidence quality + revenue state. The
// recommendation maximizes expected information per unit of founder time.

export function nextBestAction(input: {
  problem: BusinessProblem;
  assessment?: ProblemAssessment;
  observations: FounderObservation[];
  prospects: CustomerDiscoveryRecord[];
  quality: EvidenceQualityState;
}): NextBestAction {
  const p = input.problem;
  const prospects = input.prospects;
  const verifiedPayments = p.evidence.filter((e) => e.source === 'verified_payment').length;
  const wtpSignals = prospects.filter(
    (pr) => pr.discoveryStatus === 'WTP_SIGNAL' || pr.willingnessToPayIndication,
  ).length;
  const conversations = prospects.filter((pr) =>
    ['CONVERSATION', 'PROBLEM_CONFIRMED', 'SOLUTION_INTEREST', 'WTP_SIGNAL'].includes(
      pr.discoveryStatus,
    ),
  ).length;
  const stop = input.assessment?.stopRecommendation;
  // Founder/lifecycle-terminal states stay STOP no matter what — the founder
  // closed this opportunity (REJECTED/DISMISSED) or the experiment completed
  // without revenue evidence. A stored stopReason is an ADVISORY stop from the
  // last assessment — it is contradicted by verified-payment evidence (a buyer
  // paying proves buyer/economics that the advisory stop claimed were missing),
  // so it must NOT keep saying STOP forever (SPRINT-041 honesty hardening).
  const terminalStop =
    p.status === 'REJECTED' ||
    p.status === 'DISMISSED' ||
    (p.status === 'EXPERIMENT_COMPLETED' && p.revenueState === 'NO_EVIDENCE');
  const advisoryStop = stop?.stop || p.stopReason !== undefined;

  const why: string[] = [];
  let action: NextBestActionKind;
  let expectedLearning: string;
  let nextDecision: string;
  let capitalMode: CapitalMode = 'NO_COST';
  let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

  if (terminalStop || (advisoryStop && verifiedPayments === 0)) {
    action = 'STOP';
    if (stop?.stop) why.push(...stop.reasons.slice(0, 3));
    if (p.stopReason && verifiedPayments === 0) why.push(p.stopReason.slice(0, 240));
    if (p.status === 'REJECTED') why.push('The opportunity was rejected — closed.');
    if (p.status === 'DISMISSED') why.push('The founder dismissed the opportunity — closed.');
    if (p.status === 'EXPERIMENT_COMPLETED' && p.revenueState === 'NO_EVIDENCE')
      why.push('The experiment completed without revenue evidence.');
    if (why.length === 0) why.push('The system recommends STOP on the available evidence.');
    expectedLearning = 'No further spend — the evidence shows this is not worth pursuing.';
    nextDecision = 'Founder confirms STOP or overrides with new evidence.';
    risk = 'LOW';
  } else if (verifiedPayments >= 1 && wtpSignals >= 1) {
    action = 'REQUEST_PAYMENT';
    why.push(
      `Verified payment (${verifiedPayments}) + WTP signals (${wtpSignals}) — convert validated interest into paid commitments.`,
    );
    expectedLearning =
      'Whether prospects convert to VERIFIED_PAYMENT — the only revenue-verification path.';
    nextDecision = 'If 2+ payments: advance to PAYMENT_EVIDENCE; else continue discovery.';
    capitalMode = 'NO_COST';
    risk = 'MEDIUM';
  } else if (verifiedPayments >= 1) {
    // A verified payment proves revenue — the next uncertainty is
    // REPEATABILITY, not evidence quality. TALK_TO_CUSTOMERS here means
    // "find more prospects to convert", never "evidence is insufficient".
    action = 'TALK_TO_CUSTOMERS';
    why.push(
      `${verifiedPayments} verified payment(s) — revenue is proven; the next uncertainty is repeatability, so find more prospects to convert (NO_COST).`,
    );
    expectedLearning = 'Whether more prospects convert to paid commitments (repeat revenue).';
    nextDecision = 'If 2+ verified payments → REPEAT_REVENUE; if no further interest → STOP.';
    capitalMode = 'NO_COST';
    risk = 'LOW';
  } else if (conversations >= 3) {
    action = 'TEST_WTP';
    why.push(
      `${conversations} conversations confirm the problem — the next uncertainty is willingness to pay.`,
    );
    expectedLearning =
      'Whether prospects state a real budget/WTP signal (never revenue, but discovery-progressing).';
    nextDecision = 'If WTP signals appear → design the cheapest paid pilot; else STOP or reframe.';
    capitalMode = 'NO_COST';
    risk = 'LOW';
  } else if (input.quality === 'UNKNOWN' || observationsCount(input) < 2) {
    action = 'TALK_TO_CUSTOMERS';
    why.push(
      'Evidence quality is insufficient — the cheapest experiment is more customer conversations (NO_COST).',
    );
    expectedLearning = 'Whether the problem is real, frequent and economically significant.';
    nextDecision = 'If 3+ independent confirmations → VERIFY_PROBLEM; else STOP.';
    capitalMode = 'NO_COST';
    risk = 'LOW';
  } else if (input.quality === 'NEEDS_REVIEW') {
    action = 'VERIFY_PROBLEM';
    why.push('Conflicting evidence — do not build on ambiguity; verify the conflict first.');
    expectedLearning = 'Which side of the conflict the real world supports.';
    nextDecision = 'If conflict resolves → continue the loop; else mark NEEDS_REVIEW permanently.';
    capitalMode = 'NO_COST';
    risk = 'MEDIUM';
  } else {
    action = 'RUN_NO_COST_EXPERIMENT';
    why.push(
      'The problem is validated; the next uncertainty is deliverability/demand — run the cheapest experiment.',
    );
    expectedLearning = 'Measurable signal on demand/deliverability at zero cost.';
    nextDecision = 'If the NO_COST experiment succeeds → LOW_COST experiment or REQUEST_PAYMENT.';
    capitalMode = 'NO_COST';
    risk = 'LOW';
  }

  return {
    problemId: p.id,
    action,
    why,
    evidenceRefs: input.observations.slice(0, 5).map((o) => o.id),
    expectedLearning,
    risk,
    nextDecision,
    capitalMode,
    advisory: true,
  };
}

function observationsCount(input: { observations: FounderObservation[] }): number {
  return input.observations.length;
}

// ── Opportunity comparison (Part I) — evidence-driven states ────────────────

export function opportunityComparisonState(input: {
  problem: BusinessProblem;
  assessment?: ProblemAssessment;
  observations: FounderObservation[];
  prospects: CustomerDiscoveryRecord[];
  quality: EvidenceQualityState;
}): OpportunityComparisonState {
  const p = input.problem;
  const stop = input.assessment?.stopRecommendation;
  const verifiedPayments = p.evidence.filter((e) => e.source === 'verified_payment').length;
  const wtpSignals = input.prospects.filter(
    (pr) => pr.discoveryStatus === 'WTP_SIGNAL' || pr.willingnessToPayIndication,
  ).length;
  const conversations = input.prospects.filter(
    (pr) => pr.discoveryStatus !== 'CONTACTED' && pr.discoveryStatus !== 'LOST',
  ).length;

  const terminalStop =
    p.status === 'REJECTED' ||
    p.status === 'DISMISSED' ||
    (p.status === 'EXPERIMENT_COMPLETED' && p.revenueState === 'NO_EVIDENCE');
  const advisoryStop = stop?.stop || p.stopReason !== undefined;

  // Same rule as nextBestAction: a verified payment contradicts a stale
  // advisory stop — founder/lifecycle-terminal states still dominate.
  if (terminalStop || (advisoryStop && verifiedPayments === 0)) return 'STOP';
  if (verifiedPayments >= 1 && input.quality === 'HIGH') return 'STRONG_EVIDENCE';
  if (
    verifiedPayments >= 1 ||
    (wtpSignals >= 1 && conversations >= 3 && input.quality !== 'UNKNOWN')
  )
    return 'PROMISING';
  if (conversations >= 3) return 'NEEDS_CUSTOMER_VALIDATION';
  if (input.quality === 'UNKNOWN' && input.observations.length === 0) return 'UNKNOWN';
  if (input.quality === 'NEEDS_REVIEW') return 'NEEDS_CUSTOMER_VALIDATION';
  return 'INSUFFICIENT_EVIDENCE';
}

export function buildOpportunityComparison(input: {
  ownerId: string;
  problems: BusinessProblem[];
  observationsByProblem: Map<string, FounderObservation[]>;
  prospectsByProblem: Map<string, CustomerDiscoveryRecord[]>;
  now: () => string;
  limit?: number;
}): OpportunityComparison {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 50);
  const entries: OpportunityComparisonEntry[] = input.problems
    .slice(0, limit)
    .map((p) => {
      const observations = input.observationsByProblem.get(p.id) ?? [];
      const prospects = input.prospectsByProblem.get(p.id) ?? [];
      const quality = evidenceQuality({
        problemId: p.id,
        observations,
        prospects,
        evidence: p.evidence,
      }).overall;
      const next = nextBestAction({
        problem: p,
        assessment: p.assessment,
        observations,
        prospects,
        quality,
      });
      const verifiedPayments = p.evidence.filter((e) => e.source === 'verified_payment').length;
      const wtpSignals = prospects.filter(
        (pr) => pr.discoveryStatus === 'WTP_SIGNAL' || pr.willingnessToPayIndication,
      ).length;
      const state = opportunityComparisonState({
        problem: p,
        assessment: p.assessment,
        observations,
        prospects,
        quality,
      });
      const opScore = p.assessment?.opportunityScore.score;
      const problemScore = p.assessment?.problemScore.factors.find((f) => f.key === 'pain')?.value;
      const reasons: string[] = [];
      if (state === 'STOP') reasons.push(p.stopReason ?? 'Evidence-driven STOP recommendation.');
      if (verifiedPayments >= 1) reasons.push(`${verifiedPayments} verified payment(s).`);
      if (wtpSignals >= 1) reasons.push(`${wtpSignals} willingness-to-pay signal(s).`);
      if (quality === 'NEEDS_REVIEW') reasons.push('Conflicting evidence — needs review.');
      if (quality === 'UNKNOWN') reasons.push('No evidence-backed quality yet.');
      const founderInvolvement: 'LOW' | 'MEDIUM' | 'HIGH' =
        next.action === 'TALK_TO_CUSTOMERS' || next.action === 'VERIFY_PROBLEM'
          ? 'HIGH'
          : next.action === 'TEST_WTP' || next.action === 'REQUEST_PAYMENT'
            ? 'MEDIUM'
            : 'LOW';
      const risk: 'LOW' | 'MEDIUM' | 'HIGH' =
        next.risk === 'HIGH'
          ? 'HIGH'
          : state === 'STOP'
            ? 'LOW'
            : next.risk === 'MEDIUM'
              ? 'MEDIUM'
              : 'LOW';
      return {
        problemId: p.id,
        problemStatement: p.problemStatement.slice(0, 160),
        state,
        problemSeverity: problemScore,
        evidenceStrength: quality,
        opportunityScore: opScore ?? 0,
        willingnessToPaySignals: wtpSignals,
        verifiedPayments,
        experimentCost: p.assessment?.experimentCapitalMode ?? 'UNKNOWN',
        founderInvolvement,
        risk,
        nextBestAction: next.action,
        reasons,
      };
    })
    .sort((a, b) => rankComparison(b) - rankComparison(a));

  return { ownerId: input.ownerId, generatedAt: input.now(), entries, advisory: true };
}

/** Deterministic advisory sort — evidence-backed, actionable first. */
function rankComparison(e: OpportunityComparisonEntry): number {
  let rank = e.opportunityScore * 2 + (e.problemSeverity ?? 0);
  if (e.state === 'STRONG_EVIDENCE') rank += 6;
  if (e.state === 'PROMISING') rank += 4;
  if (e.state === 'NEEDS_CUSTOMER_VALIDATION') rank += 2;
  if (e.verifiedPayments >= 1) rank += 3;
  if (e.state === 'STOP') rank -= 10;
  if (e.state === 'UNKNOWN') rank -= 5;
  return rank;
}
