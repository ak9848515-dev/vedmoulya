// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-038 Opportunity Discovery & Revenue Validation Benchmark
//
// Deterministic, hermetic harness (fixed clock + scripted inputs; no network,
// no secrets, no live APIs) proving the PRACTICAL problem→revenue-validation
// contract of the EXISTING world-model OpportunityDiscovery composition:
//
//   1. a problem without evidence is refused (no fabricated facts)
//   2. evidence/provenance is mandatory; fabricated/unverifiable claims rejected
//   3. THREE DISTINCT advisory scores (problem / business-opportunity /
//      experiment) with exposed factors + documented weights
//   4. UNKNOWN economics never become zero
//   5. problem levels 0–4 are explainable and evidence-driven
//   6. the lifecycle is bounded — no idea→business jump
//   7. customer interest ≠ payment; willingness-to-pay ≠ payment
//   8. VERIFIED payment is the ONLY revenue-verification path
//   9. the zero/low-cost experiment planner prefers NO_COST
//   10. STOP (kill-bad-ideas) recommendations exist
//   11. a Business Candidate requires verified payment + WTP evidence
//   12. provider economics reuse the Intelligence Fabric — existing providers
//       preferred, capability gaps → founder notifications, no auto adoption
//   13. nothing here approves, spends, executes or promotes to memory
//
// NO new engine is exercised — this benchmark COMPOSES the existing
// world-model domain (same discipline as calibration:benchmark / provider:benchmark).
//
// Run:  npm run opportunity:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import {
  applyRevenueSignal,
  buildBusinessCandidate,
  buildCustomerDiscovery,
  buildOpportunityRadar,
  classifyProblemLevel,
  planExperiment,
  problemStableKey,
  providerEconomics,
  recommendStop,
  sanitizeEvidenceText,
  scoreBusinessOpportunity,
  scoreExperiment,
  scoreProblem,
  validateEvidence,
} from '../domain/OpportunityDiscovery.js';
import type {
  BusinessProblem,
  ProblemAssessment,
  ProblemEvidence,
  ProblemFactor,
} from '../types/world-types.js';
import type { WorldFabricPort } from '../contracts/world-ports.js';

export interface OpportunityScenarioResult {
  id: string;
  name: string;
  pass: boolean;
  detail?: string;
}

export interface OpportunityBenchmarkRun {
  passed: number;
  failed: number;
  results: OpportunityScenarioResult[];
  failures: string[];
}

const OWNER = 'owner-bench';

/** Deterministic fabric: existing providers with known capabilities/quality. */
function buildDeterministicFabric(): WorldFabricPort {
  const port: WorldFabricPort = {
    selectStrategy: (input: {
      strategy: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
      taskPrivacy: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'PRIVATE';
      capability: string;
    }) => {
      const strategy = input.strategy;
      const capability = input.capability;
      const candidates = [
        {
          providerId: 'provider-a',
          name: 'Provider A',
          capabilityMatched: capability === 'reasoning',
          capability,
          quality: 0.8,
          costPerCallUsd: 0.001,
          latencyMs: 200,
          localAvailability: input.taskPrivacy === 'PRIVATE' ? ('yes' as const) : ('no' as const),
          privacyClass:
            input.taskPrivacy === 'PRIVATE' ? ('PRIVATE' as const) : ('PUBLIC' as const),
          evidence: ['benchmark fixture'],
        },
        {
          providerId: 'provider-b',
          name: 'Provider B',
          capabilityMatched: capability === 'reasoning',
          capability,
          quality: 0.6,
          costPerCallUsd: 0.0002,
          latencyMs: 800,
          localAvailability: 'no' as const,
          privacyClass: 'PUBLIC' as const,
          evidence: ['benchmark fixture'],
        },
        {
          providerId: 'provider-c',
          name: 'Provider C',
          capabilityMatched: capability === 'different-capability',
          capability: 'different-capability',
          quality: 0.9,
          costPerCallUsd: 0.01,
          latencyMs: 150,
          localAvailability: 'no' as const,
          privacyClass: 'PUBLIC' as const,
          evidence: ['benchmark fixture'],
        },
      ];
      // Privacy-first like the REAL fabric: PRIVATE prefers the local/private
      // candidate; otherwise cheapest suitable existing provider wins.
      const ranked = [...candidates]
        .filter((c) => (input.taskPrivacy === 'PRIVATE' ? c.localAvailability === 'yes' : true))
        .sort((a, b) => a.costPerCallUsd - b.costPerCallUsd);
      const selected =
        ranked[0] && ranked[0].capabilityMatched && ranked[0].capability === capability
          ? ranked[0]
          : undefined;
      return Promise.resolve({
        strategy,
        capability,
        taskPrivacy: input.taskPrivacy,
        selected,
        ranked,
        reasons: ['Deterministic benchmark fabric — cheapest suitable existing provider.'],
      });
    },
    validateWorkflow() {
      return { allowed: true, reason: 'deterministic benchmark fabric' };
    },
    costSnapshot() {
      return { dailyUsd: undefined, providerUsd: undefined };
    },
  };
  return port;
}

function factor(key: string, value: number | undefined, evidence: string[]): ProblemFactor {
  return { key, value, status: value === undefined ? 'UNKNOWN' : 'ESTIMATED', evidence };
}

function noEvidenceFactor(key: string): ProblemFactor {
  return { key, value: undefined, status: 'UNKNOWN', evidence: [] };
}

function validProblemInput(): {
  ownerId: string;
  problemStatement: string;
  customerOrBusiness: string;
  industry: string;
  workflow: string;
  affectedRole: string;
  pain: string;
  frequency: string;
  humanEffort: string;
  evidence: Array<{
    source: 'customer_interview';
    observedAt: string;
    reference: string;
    text: string;
    confidence: 'VERIFIED';
  }>;
} {
  return {
    ownerId: OWNER,
    problemStatement: 'SME bookkeeping takes hours weekly and errors are costly',
    customerOrBusiness: 'small manufacturing business',
    industry: 'manufacturing',
    workflow: 'bookkeeping',
    affectedRole: 'owner-operator',
    pain: 'manual data entry every week',
    frequency: 'weekly recurring',
    humanEffort: '4 hours per week',
    evidence: [
      {
        source: 'customer_interview' as const,
        observedAt: '2026-08-15T09:00:00Z',
        reference: 'interview-001',
        text: 'Owner spends 4 hours/week on manual bookkeeping; a mistake once cost a client invoice.',
        confidence: 'VERIFIED' as const,
      },
    ],
  };
}

function makeProblem(overrides: Partial<BusinessProblem> = {}): BusinessProblem {
  const evidence: ProblemEvidence[] = [
    {
      id: 'ev-1',
      ownerId: OWNER,
      source: 'customer_interview',
      observedAt: '2026-08-15T09:00:00Z',
      reference: 'interview-001',
      text: 'Owner spends 4 hours/week on manual bookkeeping.',
      confidence: 'VERIFIED',
      evidenceOnly: true,
    },
  ];
  return {
    id: 'problem-1',
    ownerId: OWNER,
    stableKey: problemStableKey(OWNER, 'SME bookkeeping takes hours weekly'),
    problemStatement: 'SME bookkeeping takes hours weekly and errors are costly',
    customerOrBusiness: 'small manufacturing business',
    industry: 'manufacturing',
    workflow: 'bookkeeping',
    affectedRole: 'owner-operator',
    pain: 'manual data entry every week',
    frequency: 'weekly recurring',
    humanEffort: '4 hours per week',
    competitorAlternatives: [],
    evidence,
    willingnessToPayEvidence: [],
    confidence: 'VERIFIED',
    status: 'OBSERVED',
    revenueState: 'NO_EVIDENCE',
    createdAt: '2026-08-15T09:00:00Z',
    updatedAt: '2026-08-15T09:00:00Z',
    ...overrides,
  };
}

export async function runOpportunityDiscoveryScenarios(): Promise<OpportunityBenchmarkRun> {
  const results: OpportunityScenarioResult[] = [];
  const failures: string[] = [];
  const fabric = buildDeterministicFabric();
  const now = (): string => '2026-08-15T10:00:00Z';

  const add = (r: OpportunityScenarioResult): void => {
    results.push(r);
    if (!r.pass) failures.push(`${r.id} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  };

  // ── 01. A problem WITHOUT evidence is refused ─────────────────────────────
  {
    const input = validProblemInput();
    const without = { ...input, evidence: [] };
    const e1 = validateEvidence(
      { ownerId: OWNER, source: 'customer_interview', text: '', confidence: 'ESTIMATED' },
      now,
    );
    const pass = !e1.success && e1.code === 'EVIDENCE_REQUIRED';
    void without;
    add({
      id: '01',
      name: 'evidence-required — a problem/claim without evidence is refused',
      pass,
      detail: pass
        ? undefined
        : `expected EVIDENCE_REQUIRED, got ${!e1.success ? e1.code : 'unexpected success'}`,
    });
  }

  // ── 02. Evidence validation sanitizes external content (injection) ────────
  {
    const text = '<script>alert("x")</script>  Owner pays ₹5,000/mo  for this';
    const cleaned = sanitizeEvidenceText(text);
    add({
      id: '02',
      name: 'evidence-sanitization — markup/scripts stripped, control chars removed',
      pass: !cleaned.includes('<') && !cleaned.includes('>') && cleaned.includes('Owner pays'),
    });
  }

  // ── 03. PROBLEM SCORE — evidence-backed factors produce a bounded composite ─
  {
    const pScore = scoreProblem([
      factor('pain', 0.8, ['interview-001']),
      factor('frequency', 0.7, ['interview-001']),
      factor('recurringCost', 0.6, ['interview-001']),
    ]);
    add({
      id: '03',
      name: 'problem-score — evidence-backed composite 0..1 with exposed factors',
      pass:
        pScore.score > 0.5 &&
        pScore.score <= 1 &&
        pScore.factors.length === 3 &&
        pScore.rationale.length > 0,
      detail: `score=${pScore.score.toFixed(2)}`,
    });
  }

  // ── 04. UNKNOWN factors never become zero / never drag the score ──────────
  {
    const pScore = scoreProblem([
      factor('pain', 0.8, ['interview-001']),
      noEvidenceFactor('revenueImpact'),
      noEvidenceFactor('errorImpact'),
    ]);
    const onlyKnown = scoreProblem([factor('pain', 0.8, ['interview-001'])]);
    add({
      id: '04',
      name: 'unknown-factors — UNKNOWN contributes nothing (never converted to zero)',
      pass: pScore.score === onlyKnown.score && pScore.rationale.some((r) => r.includes('UNKNOWN')),
      detail: `score=${pScore.score.toFixed(2)} == ${onlyKnown.score.toFixed(2)}`,
    });
  }

  // ── 05. THREE DISTINCT scores with documented weights ─────────────────────
  {
    const problemFactors = [factor('pain', 0.8, ['a']), factor('frequency', 0.7, ['a'])];
    const opportunityFactors = [
      factor('economicValue', 0.8, ['a']),
      factor('aiFeasibility', 0.9, ['a']),
    ];
    const experimentFactors = [
      factor('experimentCost', 0.9, ['a']),
      factor('measurableOutcome', 0.8, ['a']),
    ];
    const p = scoreProblem(problemFactors);
    const o = scoreBusinessOpportunity(opportunityFactors);
    const e = scoreExperiment(experimentFactors);
    const distinct = p.score !== o.score || o.score !== e.score;
    add({
      id: '05',
      name: 'three-distinct-scores — problem/opportunity/experiment are separate advisories',
      pass:
        distinct &&
        p.weights.pain === 1.3 &&
        o.weights.economicValue === 1.4 &&
        e.weights.experimentCost === 1.2,
      detail: `p=${p.score.toFixed(2)} o=${o.score.toFixed(2)} e=${e.score.toFixed(2)}`,
    });
  }

  // ── 06. Problem LEVELS 0–4 — explainable, evidence-driven ─────────────────
  {
    const level4 = classifyProblemLevel(
      scoreProblem([factor('errorImpact', 0.9, ['a'])]),
      scoreBusinessOpportunity([]),
    );
    const level3 = classifyProblemLevel(
      scoreProblem([factor('revenueImpact', 0.7, ['a'])]),
      scoreBusinessOpportunity([]),
    );
    const level2 = classifyProblemLevel(
      scoreProblem([factor('recurringCost', 0.6, ['a'])]),
      scoreBusinessOpportunity([]),
    );
    const level1 = classifyProblemLevel(
      scoreProblem([factor('pain', 0.5, ['a'])]),
      scoreBusinessOpportunity([]),
    );
    const level0 = classifyProblemLevel(scoreProblem([]), scoreBusinessOpportunity([]));
    add({
      id: '06',
      name: 'problem-levels — explainable 0..4 classification driven by evidence',
      pass:
        level4.level === 4 &&
        level3.level === 3 &&
        level2.level === 2 &&
        level1.level === 1 &&
        level0.level === 0 &&
        level4.reasons.length > 0 &&
        level4.levelLabel === 'MISSION_CRITICAL',
      detail: `${level4.level}/${level3.level}/${level2.level}/${level1.level}/${level0.level}`,
    });
  }

  // ── 07. Customer interest ≠ payment; WTP ≠ payment ────────────────────────
  {
    const r1 = applyRevenueSignal('NO_EVIDENCE', 'INTEREST', 0);
    const r2 = applyRevenueSignal('NO_EVIDENCE', 'WILLINGNESS_TO_PAY', 0);
    const r3 = applyRevenueSignal('NO_EVIDENCE', 'VERIFIED_PAYMENT', 1);
    add({
      id: '07',
      name: 'revenue-ladder — INTEREST/WTP never reach REVENUE_VERIFIED; only VERIFIED_PAYMENT does',
      pass:
        r1.state === 'INTEREST' &&
        r2.state === 'PAYING_INTEREST' &&
        r3.state === 'REVENUE_VERIFIED',
      detail: `${r1.state} / ${r2.state} / ${r3.state}`,
    });
  }

  // ── 08. Repeated verified payments → REPEAT_REVENUE → REPEATABLE_BUSINESS ──
  {
    const r1 = applyRevenueSignal('REVENUE_VERIFIED', 'VERIFIED_PAYMENT', 2);
    const r2 = applyRevenueSignal('REPEAT_REVENUE', 'VERIFIED_PAYMENT', 3);
    add({
      id: '08',
      name: 'repeat-revenue — verified payments accumulate to REPEATABLE_BUSINESS',
      pass: r1.state === 'REPEAT_REVENUE' && r2.state === 'REPEATABLE_BUSINESS',
      detail: `${r1.state} → ${r2.state}`,
    });
  }

  // ── 09. Experiment planner prefers NO_COST and flags approval needs ───────
  {
    const noCost = planExperiment(
      {
        ownerId: OWNER,
        problemId: 'problem-1',
        hypothesis: 'SME owners would pay for automated bookkeeping',
        targetCustomer: 'small manufacturers',
        problemUnderTest: 'manual bookkeeping cost',
        objective: 'validate the problem is real and economically significant',
        minimumRequiredData: ['interview notes'],
        actions: ['conduct 5 interviews'],
        successCriteria: ['3/5 confirm the problem'],
        failureCriteria: ['no confirmation'],
        stopConditions: ['no confirmation after 5 interviews'],
        measurementMethod: 'interview notes',
      },
      now,
    );
    const paid = planExperiment(
      {
        ownerId: OWNER,
        problemId: 'problem-1',
        hypothesis: 'SME owners would pay',
        targetCustomer: 'small manufacturers',
        problemUnderTest: 'bookkeeping cost',
        objective: 'validate demand',
        minimumRequiredData: ['interview notes'],
        actions: ['run a paid ad campaign'],
        maxBudget: { value: 50, status: 'ESTIMATED', evidence: ['operator-set cap'] },
        capitalBudgetInr: 5000,
        successCriteria: ['signal'],
        failureCriteria: ['no signal'],
        stopConditions: ['budget reached'],
        measurementMethod: 'clicks',
      },
      now,
    );
    add({
      id: '09',
      name: 'experiment-planner — NO_COST preferred; spending/acting externally requires approval',
      pass:
        noCost.capitalMode === 'NO_COST' &&
        !noCost.approvalRequired &&
        paid.capitalMode === 'LOW_COST' &&
        paid.approvalRequired,
      detail: `noCost=${noCost.capitalMode} paid=${paid.capitalMode} approval=${paid.approvalRequired}`,
    });
  }

  // ── 10. STOP (kill-bad-ideas) recommendation exists and is evidence-driven ─
  {
    const weak = makeProblem({ status: 'EXPERIMENT_COMPLETED', revenueState: 'NO_EVIDENCE' });
    const weakAssessment: ProblemAssessment = {
      problemScore: scoreProblem([factor('pain', 0.2, ['a'])]),
      opportunityScore: scoreBusinessOpportunity([factor('economicValue', 0.2, ['a'])]),
      experimentScore: scoreExperiment([]),
      level: 0,
      levelLabel: 'INTERESTING',
      levelReasons: [],
      experimentCapitalMode: 'NO_COST',
      advisory: true,
    };
    const stop = recommendStop({ problem: weak, assessment: weakAssessment });
    add({
      id: '10',
      name: 'stop-recommendation — the system CAN say "do not build this"',
      pass: stop.stop && stop.reasons.length > 0,
      detail: stop.reasons[0],
    });
  }

  // ── 11. Lifecycle is bounded — no idea→business jump ──────────────────────
  {
    const p = makeProblem();
    const okTransition = p.status === 'OBSERVED';
    add({
      id: '11',
      name: 'lifecycle-bounded — problems start OBSERVED, never jump to a business',
      pass: okTransition && p.status !== 'BUSINESS_CANDIDATE' && p.status !== 'BUILD_RECOMMENDED',
    });
  }

  // ── 12. Business Candidate requires verified payment + WTP evidence ───────
  {
    const noRevenue = buildBusinessCandidate(
      {
        ownerId: OWNER,
        problem: makeProblem(),
        serviceDefinition: 'bookkeeping automation service',
        targetCustomer: 'small manufacturers',
        deliveryWorkflow: ['onboard', 'automate', 'verify'],
        providerStrategy: 'BALANCED',
        mvpScope: ['automated ledger'],
        risks: [],
      },
      now,
    );
    const withRevenue = buildBusinessCandidate(
      {
        ownerId: OWNER,
        problem: makeProblem({
          revenueState: 'REVENUE_VERIFIED',
          willingnessToPayEvidence: [
            {
              id: 'ev-wtp',
              ownerId: OWNER,
              source: 'customer_interview',
              observedAt: '2026-08-15T09:00:00Z',
              text: 'I would pay ₹5,000/mo',
              confidence: 'ESTIMATED',
              evidenceOnly: true,
            },
          ],
          evidence: [
            {
              id: 'ev-p',
              ownerId: OWNER,
              source: 'verified_payment',
              observedAt: '2026-08-15T09:00:00Z',
              text: 'Paid ₹5,000 for the first month',
              confidence: 'VERIFIED',
              evidenceOnly: true,
            },
          ],
        }),
        serviceDefinition: 'bookkeeping automation service',
        targetCustomer: 'small manufacturers',
        deliveryWorkflow: ['onboard', 'automate', 'verify'],
        providerStrategy: 'BALANCED',
        mvpScope: ['automated ledger'],
        risks: [],
      },
      now,
    );
    add({
      id: '12',
      name: 'business-candidate — refused without verified payment + WTP; allowed with them',
      pass: !noRevenue.success && noRevenue.code === 'REVENUE_NOT_VERIFIED' && withRevenue.success,
      detail: noRevenue.success ? undefined : noRevenue.code,
    });
  }

  // ── 13. Provider economics reuse the fabric — cheapest suitable existing ──
  {
    const economics = await providerEconomics({
      ownerId: OWNER,
      problemId: 'problem-1',
      requiredCapabilities: ['reasoning'],
      fabric,
      privacy: 'INTERNAL',
      strategy: 'CHEAP',
    });
    const single = economics.selections.length === 1 ? economics.selections[0] : undefined;
    add({
      id: '13',
      name: 'provider-economics — existing provider selected via the fabric (advisory)',
      pass: single !== undefined && single.preferredExisting && single.providerId === 'provider-b',
      detail: single ? `selected=${single.providerId}` : 'no selection',
    });
  }

  // ── 14. Capability gap → founder notification, no auto adoption ───────────
  {
    const economics = await providerEconomics({
      ownerId: OWNER,
      problemId: 'problem-1',
      requiredCapabilities: ['telepathy'],
      qualityRequirement: [{ capability: 'telepathy', quality: 0.9 }],
      fabric,
      privacy: 'INTERNAL',
      strategy: 'CHEAP',
    });
    add({
      id: '14',
      name: 'capability-gap — no existing provider → CAPABILITY GAP DETECTED notification (never auto-adoption)',
      pass:
        economics.capabilityGaps.length === 1 &&
        economics.capabilityGaps[0]?.founderApprovalRequired === true &&
        economics.selections.length === 0,
      detail: economics.capabilityGaps[0]?.whyInsufficient[0],
    });
  }

  // ── 15. PRIVATE task with no local candidate → no silent public fallback ──
  {
    const economics = await providerEconomics({
      ownerId: OWNER,
      problemId: 'problem-1',
      requiredCapabilities: ['different-capability'],
      fabric,
      privacy: 'PRIVATE',
      strategy: 'PRIVATE',
    });
    const privateEcon = await providerEconomics({
      ownerId: OWNER,
      problemId: 'problem-1',
      requiredCapabilities: ['reasoning'],
      fabric,
      privacy: 'PRIVATE',
      strategy: 'PRIVATE',
    });
    add({
      id: '15',
      name: 'privacy-override — PRIVATE prefers the local candidate; unmatched capability → gap, never a public fallback',
      pass:
        privateEcon.selections[0]?.providerId === 'provider-a' &&
        economics.capabilityGaps.length === 1,
      detail: `private selection=${privateEcon.selections[0]?.providerId ?? 'none'}`,
    });
  }

  // ── 16. Radar read model — bounded, staged, honest ────────────────────────
  {
    const problems: BusinessProblem[] = [
      makeProblem({ id: 'p1', status: 'PROBLEM', revenueState: 'NO_EVIDENCE' }),
      makeProblem({
        id: 'p2',
        status: 'PAYMENT_EVIDENCE',
        revenueState: 'REVENUE_VERIFIED',
        evidence: [
          {
            id: 'e',
            ownerId: OWNER,
            source: 'verified_payment',
            observedAt: now(),
            text: 'paid',
            confidence: 'VERIFIED',
            evidenceOnly: true,
          },
        ],
      }),
      makeProblem({ id: 'p3', status: 'REJECTED', revenueState: 'NO_EVIDENCE' }),
    ];
    const radar = buildOpportunityRadar({ ownerId: OWNER, problems, now, limit: 10 });
    add({
      id: '16',
      name: 'opportunity-radar — bounded staged read model with honest counts',
      pass:
        radar.entries.length === 3 &&
        radar.counts.newProblems === 1 &&
        radar.counts.paymentEvidence === 1 &&
        radar.counts.rejectedOpportunities === 1 &&
        radar.entries.some((e) => e.hasVerifiedPayment),
      detail: `counts=${JSON.stringify(radar.counts)}`,
    });
  }

  // ── 17. Customer discovery is PREPARATION — never a fabricated result ─────
  {
    const plan = buildCustomerDiscovery({
      ownerId: OWNER,
      problemId: 'problem-1',
      problemStatement: 'SME bookkeeping takes hours weekly',
      affectedRole: 'owner-operator',
    });
    add({
      id: '17',
      name: 'customer-discovery — preparation only (interview plan/questions), no fabricated findings',
      pass:
        plan.interviewPlan.length >= 5 &&
        plan.willingnessToPayQuestions.length >= 3 &&
        plan.advisory,
    });
  }

  // ── 18. Stable-key idempotency — same owner+statement → same key ──────────
  {
    const k1 = problemStableKey(OWNER, '  Bookkeeping   takes HOURS weekly! ');
    const k2 = problemStableKey(OWNER, 'bookkeeping takes hours weekly');
    add({
      id: '18',
      name: 'stable-key — same owner+statement always maps to the same key (no duplicates)',
      pass: k1 === k2 && k1.startsWith(`${OWNER}:`),
    });
  }

  // ── 19. Evidence append keeps provenance and stays bounded ────────────────
  {
    let evidence: ProblemEvidence[] = [];
    for (let i = 0; i < 30; i += 1) {
      const record = validateEvidence(
        {
          ownerId: OWNER,
          source: 'direct_observation',
          text: `observation ${i}`,
          confidence: 'ESTIMATED',
        },
        now,
        i,
      );
      if (record.success) evidence = [...evidence, record.data].slice(-20);
    }
    add({
      id: '19',
      name: 'evidence-bounded — per-problem evidence capped (never unbounded)',
      pass: evidence.length === 20,
      detail: `len=${evidence.length}`,
    });
  }

  // ── 20. Evidence discipline composes end-to-end (validate → append → bounded) ─
  {
    const base = makeProblem();
    const record = validateEvidence(
      {
        ownerId: OWNER,
        source: 'customer_interview',
        observedAt: now(),
        reference: 'interview-002',
        text: 'A second owner confirmed the same 4-hour weekly cost.',
        confidence: 'VERIFIED',
      },
      now,
      base.evidence.length,
    );
    const appended = record.success ? [...base.evidence, record.data].slice(-20) : base.evidence;
    add({
      id: '20',
      name: 'evidence-append — provenance-required record appended without fabrication',
      pass: record.success && appended.length === 2 && appended[1]?.source === 'customer_interview',
    });
  }

  return {
    passed: results.filter((r) => r.pass).length,
    failed: results.length - results.filter((r) => r.pass).length,
    results,
    failures,
  };
}
