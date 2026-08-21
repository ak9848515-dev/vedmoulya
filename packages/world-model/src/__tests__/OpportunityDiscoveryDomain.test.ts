// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — OpportunityDiscovery domain branch coverage (SPRINT-038).
// Direct deterministic coverage of the advisory domain: quality-gap paths,
// every STOP reason, every lifecycle status in the radar/next-action,
// revenue-signal ladder branches, transition justifications and the
// experiment planner edge cases. All hermetic — no network, no secrets.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  applyRevenueSignal,
  buildOpportunityRadar,
  canTransition,
  classifyProblemLevel,
  planExperiment,
  problemStableKey,
  providerEconomics,
  recommendStop,
  sanitizeEvidenceText,
  scoreBusinessOpportunity,
  scoreProblem,
  transitionReason,
  validateEvidence,
} from '../domain/OpportunityDiscovery.js';
import type { BusinessProblem, ProblemAssessment, ProblemEvidence } from '../types/world-types.js';
import type { WorldFabricPort } from '../contracts/world-ports.js';

const OWNER = 'owner-cover';
const now = (): string => '2026-08-15T10:00:00.000Z';

function fabricWith(
  options: {
    matchedQuality?: number;
    capabilityMatched?: boolean;
    throwError?: boolean;
  } = {},
): WorldFabricPort {
  return {
    selectStrategy: async () => {
      if (options.throwError) throw new Error('fabric down');
      const selected = {
        providerId: 'provider-x',
        name: 'Provider X',
        capabilityMatched: options.capabilityMatched ?? true,
        quality: options.matchedQuality ?? 0.5,
        costPerCallUsd: 0.01,
        latencyMs: 100,
        localAvailability: 'no' as const,
        privacyClass: 'PUBLIC' as const,
        evidence: ['fixture'],
      };
      return {
        strategy: 'CHEAP' as const,
        selected,
        ranked: [selected],
        reasons: ['fixture reason'],
      };
    },
    validateWorkflow: () => ({ allowed: true, reason: 'fixture' }),
    costSnapshot: () => ({}),
  } as unknown as WorldFabricPort;
}

function problem(overrides: Partial<BusinessProblem> = {}): BusinessProblem {
  const evidence: ProblemEvidence[] = [
    {
      id: 'ev-1',
      ownerId: OWNER,
      source: 'customer_interview',
      observedAt: now(),
      text: 'owner statement',
      confidence: 'VERIFIED',
      evidenceOnly: true,
    },
  ];
  return {
    id: 'p-1',
    ownerId: OWNER,
    stableKey: problemStableKey(OWNER, 'problem'),
    problemStatement: 'A problem statement',
    evidence,
    willingnessToPayEvidence: [],
    confidence: 'VERIFIED',
    status: 'OBSERVED',
    revenueState: 'NO_EVIDENCE',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

function assessment(overrides: Partial<ProblemAssessment> = {}): ProblemAssessment {
  return {
    problemScore: scoreProblem([]),
    opportunityScore: scoreBusinessOpportunity([]),
    experimentScore: { score: 0, factors: [], weights: {}, rationale: ['none'], advisory: true },
    level: 0,
    levelLabel: 'INTERESTING',
    levelReasons: [],
    experimentCapitalMode: 'NO_COST',
    advisory: true,
    ...overrides,
  };
}

describe('OpportunityDiscovery domain — branch coverage (SPRINT-038)', () => {
  it('providerEconomics: quality-gap and no-match branches produce founder notifications', async () => {
    // Quality below requirement → gap with quality reason.
    const lowQuality = await providerEconomics({
      ownerId: OWNER,
      problemId: 'p-1',
      requiredCapabilities: ['reasoning'],
      qualityRequirement: [{ capability: 'reasoning', quality: 0.9 }],
      fabric: fabricWith({ matchedQuality: 0.5 }),
      privacy: 'INTERNAL',
      strategy: 'CHEAP',
    });
    expect(lowQuality.selections.length).toBe(0);
    expect(lowQuality.capabilityGaps.length).toBe(1);
    expect(lowQuality.capabilityGaps[0]?.whyInsufficient[0]).toContain('below the required');

    // No capability match → gap with no-match reason.
    const noMatch = await providerEconomics({
      ownerId: OWNER,
      problemId: 'p-1',
      requiredCapabilities: ['telepathy'],
      fabric: fabricWith({ capabilityMatched: false }),
      privacy: 'INTERNAL',
      strategy: 'CHEAP',
    });
    expect(noMatch.capabilityGaps.length).toBe(1);
    expect(
      noMatch.capabilityGaps[0]?.whyInsufficient.some((w) =>
        w.includes('No existing provider matched'),
      ),
    ).toBe(true);

    // Fabric throws → gap with availability reason (never fabricated selection).
    const down = await providerEconomics({
      ownerId: OWNER,
      problemId: 'p-1',
      requiredCapabilities: ['reasoning'],
      fabric: fabricWith({ throwError: true }),
      privacy: 'INTERNAL',
      strategy: 'CHEAP',
    });
    expect(down.selections.length).toBe(0);
    expect(down.capabilityGaps[0]?.whyInsufficient[0]).toContain('unavailable');
  });

  it('providerEconomics: PRIVATE privacy implication is exposed on gaps', async () => {
    const result = await providerEconomics({
      ownerId: OWNER,
      problemId: 'p-1',
      requiredCapabilities: ['reasoning'],
      fabric: fabricWith({ capabilityMatched: false }),
      privacy: 'PRIVATE',
      strategy: 'PRIVATE',
    });
    expect(result.capabilityGaps[0]?.privacyImplications).toContain('PRIVATE');
    expect(result.capabilityGaps[0]?.founderApprovalRequired).toBe(true);
  });

  it('recommendStop: every evidence-driven STOP reason fires independently', () => {
    const cases: Array<[string, BusinessProblem, ProblemAssessment]> = [
      [
        'insufficient pain',
        problem(),
        assessment({
          problemScore: scoreProblem([
            { key: 'pain', value: 0.2, status: 'ESTIMATED', evidence: ['a'] },
          ]),
        }),
      ],
      [
        'insufficient economics',
        problem(),
        assessment({
          opportunityScore: scoreBusinessOpportunity([
            { key: 'economicValue', value: 0.2, status: 'ESTIMATED', evidence: ['a'] },
          ]),
        }),
      ],
      [
        'poor AI feasibility',
        problem(),
        assessment({
          opportunityScore: scoreBusinessOpportunity([
            { key: 'aiFeasibility', value: 0.2, status: 'ESTIMATED', evidence: ['a'] },
          ]),
        }),
      ],
      [
        'excessive competition',
        problem(),
        assessment({
          opportunityScore: scoreBusinessOpportunity([
            { key: 'competition', value: 0.9, status: 'ESTIMATED', evidence: ['a'] },
          ]),
        }),
      ],
      [
        'no buyer',
        problem({ buyer: undefined }),
        assessment({ opportunityScore: scoreBusinessOpportunity([]) }),
      ],
      [
        'excessive complexity',
        problem(),
        assessment({
          opportunityScore: scoreBusinessOpportunity([
            { key: 'implementationComplexity', value: 0.9, status: 'ESTIMATED', evidence: ['a'] },
          ]),
        }),
      ],
      [
        'poor margin',
        problem(),
        assessment({
          opportunityScore: scoreBusinessOpportunity([
            { key: 'expectedMargin', value: 0.1, status: 'ESTIMATED', evidence: ['a'] },
          ]),
        }),
      ],
      [
        'experiment without revenue',
        problem({ status: 'EXPERIMENT_COMPLETED', revenueState: 'NO_EVIDENCE' }),
        assessment(),
      ],
      ['already rejected', problem({ status: 'REJECTED' }), assessment()],
    ];
    for (const [name, p, a] of cases) {
      const stop = recommendStop({ problem: p, assessment: a });
      expect(stop.stop).toBe(true);
      expect(stop.reasons.length).toBeGreaterThan(0);
      expect(stop.reasons[0]).toBeTruthy();
    }
  });

  it('recommendStop: a healthy problem with revenue evidence is NOT stopped', () => {
    const p = problem({
      status: 'PAYMENT_EVIDENCE',
      revenueState: 'REVENUE_VERIFIED',
      buyer: 'the operations manager',
    });
    const a = assessment({
      problemScore: scoreProblem([
        { key: 'pain', value: 0.8, status: 'VERIFIED', evidence: ['a'] },
      ]),
      opportunityScore: scoreBusinessOpportunity([
        { key: 'economicValue', value: 0.8, status: 'VERIFIED', evidence: ['a'] },
      ]),
    });
    const stop = recommendStop({ problem: p, assessment: a });
    expect(stop.stop).toBe(false);
    expect(stop.reasons.length).toBe(0);
  });

  it('lifecycle: every valid transition has a justification; invalid ones are explained', () => {
    expect(canTransition('OBSERVED', 'PROBLEM')).toBe(true);
    expect(canTransition('PROBLEM', 'VALIDATED_PROBLEM')).toBe(true);
    expect(canTransition('EXPERIMENT_RUNNING', 'EXPERIMENT_COMPLETED')).toBe(true);
    expect(canTransition('PAYMENT_EVIDENCE', 'BUSINESS_CANDIDATE')).toBe(true);
    expect(canTransition('BUSINESS_CANDIDATE', 'BUILD_RECOMMENDED')).toBe(true);
    expect(canTransition('OBSERVED', 'BUSINESS_CANDIDATE')).toBe(false);
    expect(transitionReason('OBSERVED', 'BUSINESS_CANDIDATE')).toContain('not allowed');
    expect(transitionReason('EXPERIMENT_RUNNING', 'EXPERIMENT_COMPLETED')).toContain('experiment');
    expect(transitionReason('OBSERVED', 'OBSERVED')).toContain('already in');
  });

  it('classifyProblemLevel: all five levels have distinct evidence triggers', () => {
    expect(
      classifyProblemLevel(
        scoreProblem([{ key: 'urgency', value: 0.8, status: 'ESTIMATED', evidence: ['a'] }]),
        scoreBusinessOpportunity([]),
      ).level,
    ).toBe(4);
    expect(
      classifyProblemLevel(
        scoreProblem([{ key: 'revenueImpact', value: 0.6, status: 'ESTIMATED', evidence: ['a'] }]),
        scoreBusinessOpportunity([]),
      ).level,
    ).toBe(3);
    expect(
      classifyProblemLevel(
        scoreProblem([{ key: 'humanEffort', value: 0.7, status: 'ESTIMATED', evidence: ['a'] }]),
        scoreBusinessOpportunity([]),
      ).level,
    ).toBe(2);
    expect(
      classifyProblemLevel(
        scoreProblem([{ key: 'pain', value: 0.5, status: 'ESTIMATED', evidence: ['a'] }]),
        scoreBusinessOpportunity([]),
      ).level,
    ).toBe(1);
    const l0 = classifyProblemLevel(scoreProblem([]), scoreBusinessOpportunity([]));
    expect(l0.level).toBe(0);
    expect(l0.reasons[0]).toContain('INTERESTING');
  });

  it('revenue signals: every ladder branch returns an honest state', () => {
    expect(applyRevenueSignal('NO_EVIDENCE', 'INTEREST', 0).state).toBe('INTEREST');
    expect(applyRevenueSignal('INTEREST', 'PROBLEM_CONFIRMED', 0).state).toBe('PROBLEM_CONFIRMED');
    expect(applyRevenueSignal('PROBLEM_CONFIRMED', 'EXPERIMENT_SUCCESS', 0).state).toBe(
      'EXPERIMENT_SUCCESS',
    );
    expect(applyRevenueSignal('EXPERIMENT_SUCCESS', 'WILLINGNESS_TO_PAY', 0).state).toBe(
      'PAYING_INTEREST',
    );
    expect(applyRevenueSignal('PAYING_INTEREST', 'VERIFIED_PAYMENT', 1).state).toBe(
      'REVENUE_VERIFIED',
    );
    expect(applyRevenueSignal('REVENUE_VERIFIED', 'REPEAT_PAYMENT', 2).state).toBe(
      'REPEAT_REVENUE',
    );
    expect(applyRevenueSignal('REPEAT_REVENUE', 'REPEATABLE', 3).state).toBe('REPEATABLE_BUSINESS');
  });

  it('experiment planner: cheaper-alternative advisory is produced for paid experiments', () => {
    const plan = planExperiment(
      {
        ownerId: OWNER,
        problemId: 'p-1',
        hypothesis: 'h',
        targetCustomer: 'c',
        problemUnderTest: 'p',
        objective: 'o',
        minimumRequiredData: ['public market data'],
        actions: ['buy a dataset'],
        maxBudget: { value: 100, status: 'ESTIMATED', evidence: ['operator cap'] },
        capitalBudgetInr: 10000,
        successCriteria: ['s'],
        failureCriteria: ['f'],
        stopConditions: ['x'],
        measurementMethod: 'm',
      },
      now,
    );
    expect(plan.capitalMode).toBe('LOW_COST');
    expect(plan.cheaperAlternative).toContain('NO_COST');
  });

  it('radar: every lifecycle status maps to a next action and counts correctly', () => {
    const statuses: Array<[BusinessProblem['status'], string]> = [
      ['OBSERVED', 'Add the problem statement'],
      ['PROBLEM', 'Collect more evidence'],
      ['VALIDATED_PROBLEM', 'Assess the business opportunity'],
      ['ECONOMIC_OPPORTUNITY', 'Evidence AI suitability'],
      ['AI_FEASIBLE', 'Design the cheapest validation experiment'],
      ['EXPERIMENT_CANDIDATE', 'Request approval'],
      ['EXPERIMENT_APPROVAL_REQUIRED', 'requires the existing approval authority'],
      ['EXPERIMENT_RUNNING', 'Run the experiment'],
      ['EXPERIMENT_COMPLETED', 'seek VERIFIED payment evidence'],
      ['PAYMENT_EVIDENCE', 'BUSINESS_CANDIDATE'],
      ['BUSINESS_CANDIDATE', 'Prepare the service definition'],
      ['BUILD_RECOMMENDED', 'Advisory ceiling reached'],
      ['REJECTED', 'Closed'],
      ['DISMISSED', 'Closed'],
      ['NEEDS_REVIEW', 'human must review'],
    ];
    const problems = statuses.map(([status, expected], i) => {
      const p = problem({
        id: `p-${i}`,
        status,
        revenueState: status === 'PAYMENT_EVIDENCE' ? 'REVENUE_VERIFIED' : 'NO_EVIDENCE',
      });
      return p;
    });
    const radar = buildOpportunityRadar({ ownerId: OWNER, problems, now });
    expect(radar.entries.length).toBe(statuses.length);
    for (const [status, fragment] of statuses) {
      const entry = radar.entries.find((e) => e.status === status);
      expect(entry).toBeDefined();
      if (entry) expect(entry.nextAction).toContain(fragment);
    }
    // A NO_COST experiment candidate recommends starting the experiment.
    const noCostCandidate = problem({ id: 'p-nc', status: 'EXPERIMENT_CANDIDATE' });
    const withAssessment = {
      ...noCostCandidate,
      assessment: assessment({ experimentCapitalMode: 'NO_COST' }),
    };
    const radar2 = buildOpportunityRadar({ ownerId: OWNER, problems: [withAssessment], now });
    expect(radar2.entries[0]?.nextAction).toContain('Start the NO_COST experiment');
  });

  it('sanitization strips markup and control characters; empty input yields empty', () => {
    expect(sanitizeEvidenceText('<script>alert(1)</script>text')).not.toContain('<');
    expect(sanitizeEvidenceText('a\u0000b')).not.toContain('\u0000');
    expect(sanitizeEvidenceText('   ')).toBe('');
  });

  it('validateEvidence refuses empty text but accepts provenance-required records', () => {
    const bad = validateEvidence(
      { ownerId: OWNER, source: 'customer_interview', text: '  ', confidence: 'ESTIMATED' },
      now,
    );
    expect(bad.success).toBe(false);
    const good = validateEvidence(
      {
        ownerId: OWNER,
        source: 'customer_interview',
        text: 'owner said x',
        confidence: 'VERIFIED',
      },
      now,
    );
    expect(good.success).toBe(true);
    if (good.success) {
      expect(good.data.evidenceOnly).toBe(true);
      expect(good.data.ownerId).toBe(OWNER);
    }
  });
});
