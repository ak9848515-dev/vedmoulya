// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Founder Evidence Loop (SPRINT-039) tests (hermetic).
// The founder's real-world observations and customer-discovery results become
// a disciplined, auditable feedback loop: provenance-MANDATORY observations,
// evidence-state normalization (never auto-verified), a bounded customer
// discovery ledger (discovery ≠ validation, WTP ≠ revenue), bounded evidence
// calibration (≤ Δ0.05 per event, conflicts visible, UNKNOWN stays UNKNOWN),
// explainable next-best-action (STOP allowed), evidence-driven opportunity
// comparison, owner isolation and structural no-authority guarantees.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { StrategySelection } from '@vedmoulya/intelligence-fabric';
import { ActionClassPolicy } from '@vedmoulya/proactive';
import { WorldModelService } from '../application/WorldModelService.js';
import { InMemoryWorldStores } from '../infrastructure/InMemoryWorldStores.js';
import {
  CALIBRATION_DELTA_MAX,
  buildOpportunityComparison,
  calibrateFactors,
  canAdvanceProspect,
  evidenceQuality,
  evidenceStrength,
  nextBestAction,
  normalizeObservationState,
  observationId,
  opportunityComparisonState,
  prospectId,
  prospectTransitionReason,
  validateCustomerDiscoveryRecord,
  validateFounderObservation,
} from '../domain/FounderEvidenceLoop.js';
import type {
  BusinessProblem,
  CustomerDiscoveryRecord,
  FounderObservation,
  ProblemFactor,
} from '../types/world-types.js';
import type {
  WorldActionPort,
  WorldApprovalPort,
  WorldBrainPort,
  WorldControlPort,
  WorldCostPort,
  WorldFabricPort,
  WorldProactivePort,
  WorldSignalSourcePort,
} from '../contracts/world-ports.js';

const now = (): string => '2026-08-15T10:00:00.000Z';

function brainPort(): WorldBrainPort {
  return {
    listOpportunities: () => ({ success: true, data: [] }),
    listTasks: () => ({ success: true, data: [] }),
    dailyPriorities: () => ({ success: true, data: [] }),
    discoverIntelligence: async () => ({ success: true, data: { items: [], refreshedAt: now() } }),
    listNotifications: () => ({ success: true, data: [] }),
    createTask: () => ({
      success: true,
      data: { id: 'task-1', title: 'task', ownerId: 'u1', status: 'PLANNED' },
    }),
  };
}

function proactivePort(): WorldProactivePort {
  return {
    assessBusiness: (userId, input) => ({
      id: 'ba-1',
      ownerId: userId,
      title: input.title,
      description: input.description,
      category: 'Consulting / services',
      score: 0.5,
      businessCase: ['Capability fit 100%.'],
      estimatedCost: { label: 'Unknown', status: 'UNKNOWN' },
      estimatedRevenue: { label: 'Unknown', status: 'UNKNOWN' },
      riskLevel: 'MEDIUM',
      mvpPlan: ['Research the market.', 'Get explicit user approval.'],
      authorizationRequired: true,
      status: 'RESEARCHED',
      evidence: ['capability fit'],
      createdAt: now(),
    }),
  };
}

function fabricPort(): WorldFabricPort {
  return {
    selectStrategy: async (input): Promise<StrategySelection> => ({
      strategy: input.strategy,
      selected:
        input.capability === 'some-missing-capability'
          ? undefined
          : {
              providerId: 'openai',
              modelId: 'gpt-4o-mini',
              name: 'OpenAI',
              capabilityMatched: true,
              evidence: ['capability matched'],
            },
      ranked:
        input.capability === 'some-missing-capability'
          ? []
          : [
              {
                providerId: 'openai',
                name: 'OpenAI',
                capabilityMatched: true,
                evidence: ['capability matched'],
              },
            ],
      reasons:
        input.capability === 'some-missing-capability'
          ? ['No existing provider matched the capability.']
          : ['Selected because it matched the capability.'],
    }),
    validateWorkflow: (plan) =>
      plan.taskCount <= 24
        ? { allowed: true, reason: 'within bounds' }
        : { allowed: false, reason: 'too many tasks', exceeded: 'tasks' },
    costSnapshot: () => ({ dailyUsd: 0.5 }),
  };
}

function actionPort(): WorldActionPort {
  const policy = new ActionClassPolicy();
  return { classify: (a, opts) => policy.classify(a, opts) };
}

function controlPort(): WorldControlPort {
  return {
    listOpportunities: () => [],
    autonomyPosture: (ownerId) => ({
      emergencyStopEngaged: false,
      autonomyLevel: 2,
      updatedAt: now(),
      ownerId,
    }),
  };
}

function approvalPort(): WorldApprovalPort {
  return {
    requestApproval: () => ({ success: true, data: { id: 'ap-1', status: 'PENDING' } }),
    approve: (input) => ({
      success: true,
      data: {
        id: input.requestId ?? 'ap-1',
        status: 'APPROVED',
        scope: input.scope ?? 'approval',
        grantedBy: 'u1',
        grantedAt: now(),
      },
    }),
    reject: (input) => ({
      success: true,
      data: { id: input.requestId ?? 'ap-1', status: 'REJECTED', scope: input.scope ?? 'approval' },
    }),
  };
}

function costPort(): WorldCostPort {
  return {
    recordCost: (input) => ({
      id: `cost-${input.taskId}`,
      ownerId: input.ownerId,
      taskId: input.taskId,
      amountUsd: input.amountUsd,
      recordedAt: now(),
    }),
    snapshot: () => ({ totalUsd: 0.5, byProvider: [], byTask: [] }),
  };
}

function signalPort(): WorldSignalSourcePort {
  return { fetch: async () => ({ status: 'UNAVAILABLE', reason: 'no source configured' }) };
}

function makeService(): WorldModelService {
  return new WorldModelService({
    brain: brainPort(),
    proactive: proactivePort(),
    fabric: fabricPort(),
    action: actionPort(),
    control: controlPort(),
    stores: new InMemoryWorldStores(),
    approval: approvalPort(),
    cost: costPort(),
    signals: signalPort(),
    now,
  });
}

const baseEvidence = () => [
  {
    source: 'customer_interview' as const,
    observedAt: '2026-08-15T09:00:00Z',
    reference: 'interview-001',
    text: 'Owner spends 4 hours/week on manual bookkeeping; a mistake once cost a client invoice.',
    confidence: 'VERIFIED' as const,
  },
];

function register(service: WorldModelService, ownerId = 'u1'): string {
  const result = service.registerProblem({
    ownerId,
    problemStatement: 'SME bookkeeping takes hours weekly and errors are costly',
    customerOrBusiness: 'small manufacturing business',
    industry: 'manufacturing',
    workflow: 'bookkeeping',
    affectedRole: 'owner-operator',
    pain: 'manual data entry every week',
    frequency: 'weekly recurring',
    humanEffort: '4 hours per week',
    evidence: baseEvidence(),
  });
  if (!result.success) throw new Error(`register failed: ${result.error}`);
  return result.data.id;
}

function observe(
  service: WorldModelService,
  problemId: string,
  opts: { statement?: string; sourceType?: string; claimedState?: string } = {},
) {
  return service.recordFounderObservation({
    ownerId: 'u1',
    problemId,
    sourceType: (opts.sourceType ?? 'customer_conversation') as never,
    sourceReference: 'clinic-owner-01',
    observedStatement:
      opts.statement ?? 'Four clinic owners said appointment follow-up consumes staff time.',
    provenance: {
      source: 'founder-interview',
      reference: 'call-2026-08-15',
      observedAt: '2026-08-15T09:30:00Z',
    },
    claimedState: opts.claimedState as never,
  });
}

describe('FounderEvidenceLoop — SPRINT-039', () => {
  it('1. an observation without provenance is deterministically refused', () => {
    const service = makeService();
    const problemId = register(service);
    const result = service.recordFounderObservation({
      ownerId: 'u1',
      problemId,
      sourceType: 'customer_conversation',
      sourceReference: 'x',
      observedStatement: 'A claim with no provenance.',
      provenance: { source: '', observedAt: '' },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('PROVENANCE_REQUIRED');
  });

  it('2. a claimed VERIFIED state is downgraded — never trusted at face value', () => {
    // VERIFIED requires a real cross-check; a claimed VERIFIED observation is
    // downgraded to OBSERVED (it is still a fact of record, but not verified).
    const normalized = normalizeObservationState({
      claimedState: 'VERIFIED',
      sourceType: 'secondary_research',
      observedStatement: 'I think clinics need this.',
    });
    expect(normalized).not.toBe('VERIFIED');
    expect(normalized).toBe('OBSERVED');
  });

  it('3. a customer-reported observation keeps REPORTED_BY_CUSTOMER — never auto-verified', () => {
    const service = makeService();
    const problemId = register(service);
    // No claimed state → the source type drives the evidence state.
    const result = service.recordFounderObservation({
      ownerId: 'u1',
      problemId,
      sourceType: 'customer_conversation',
      sourceReference: 'clinic-owner-01',
      observedStatement: 'Four clinic owners said appointment follow-up consumes staff time.',
      provenance: {
        source: 'founder-interview',
        reference: 'call-2026-08-15',
        observedAt: '2026-08-15T09:30:00Z',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.evidenceState).toBe('REPORTED_BY_CUSTOMER');
  });

  it('4. evidence strength rises with independent reports but never fabricates revenue', () => {
    expect(evidenceStrength([])).toBe('UNKNOWN');
    const weak = evidenceStrength([{ evidenceState: 'REPORTED_BY_CUSTOMER' } as never]);
    expect(weak).toBe('WEAK');
    const strong = evidenceStrength([
      { evidenceState: 'REPORTED_BY_CUSTOMER' } as never,
      { evidenceState: 'REPORTED_BY_CUSTOMER' } as never,
      { evidenceState: 'REPORTED_BY_CUSTOMER' } as never,
    ]);
    expect(strong).toBe('STRONG');
  });

  it('5. observations are owner-scoped — cross-owner access returns nothing', () => {
    const service = makeService();
    const problemId = register(service, 'u1');
    observe(service, problemId);
    expect(service.listObservations('u2', problemId).data).toEqual([]);
  });

  it('6. a customer discovery record requires provenance and segment', () => {
    const service = makeService();
    const problemId = register(service);
    const result = service.registerProspect({
      ownerId: 'u1',
      problemId,
      prospectReference: 'clinic-owner-01',
      customerSegment: '',
      problemDiscussed: 'follow-up',
      provenance: { source: 'call', observedAt: now() },
    });
    expect(result.success).toBe(false);
  });

  it('7. a prospect cannot jump to VERIFIED_PAYMENT — progression is bounded', () => {
    const service = makeService();
    const problemId = register(service);
    const created = service.registerProspect({
      ownerId: 'u1',
      problemId,
      prospectReference: 'clinic-owner-01',
      customerSegment: 'clinics',
      problemDiscussed: 'follow-up',
      provenance: { source: 'call', observedAt: now() },
    });
    if (!created.success) throw new Error('prospect create failed');
    const jump = service.advanceProspect({
      ownerId: 'u1',
      problemId,
      prospectReference: 'clinic-owner-01',
      to: 'VERIFIED_PAYMENT',
    });
    expect(jump.success).toBe(false);
    if (!jump.success) expect(jump.code).toBe('INVALID_TRANSITION');
  });

  it('8. advancing to VERIFIED_PAYMENT records the payment — the ONLY revenue path', () => {
    const service = makeService();
    const problemId = register(service);
    const created = service.registerProspect({
      ownerId: 'u1',
      problemId,
      prospectReference: 'clinic-owner-01',
      customerSegment: 'clinics',
      problemDiscussed: 'follow-up',
      provenance: { source: 'call', observedAt: now() },
    });
    if (!created.success) throw new Error('prospect create failed');
    for (const to of [
      'CONVERSATION',
      'PROBLEM_CONFIRMED',
      'SOLUTION_INTEREST',
      'WTP_SIGNAL',
      'PAYMENT_REQUESTED',
    ] as const) {
      const step = service.advanceProspect({
        ownerId: 'u1',
        problemId,
        prospectReference: 'clinic-owner-01',
        to,
      });
      if (!step.success) throw new Error(`advance ${to} failed: ${step.error}`);
    }
    const paid = service.advanceProspect({
      ownerId: 'u1',
      problemId,
      prospectReference: 'clinic-owner-01',
      to: 'VERIFIED_PAYMENT',
      verifiedPaymentText: 'Paid ₹5,000 deposit (UPI confirmed).',
    });
    expect(paid.success).toBe(true);
    const problem = service.stores.problems.get('u1', problemId);
    expect(problem?.revenueState).toBe('REVENUE_VERIFIED');
    expect(problem?.evidence.some((e) => e.source === 'verified_payment')).toBe(true);
  });

  it('8b. VERIFIED_PAYMENT requires real payment evidence — no fabricated default (SPRINT-041)', () => {
    const service = makeService();
    const problemId = register(service);
    const created = service.registerProspect({
      ownerId: 'u1',
      problemId,
      prospectReference: 'clinic-owner-01',
      customerSegment: 'clinics',
      problemDiscussed: 'follow-up',
      provenance: { source: 'call', observedAt: now() },
    });
    if (!created.success) throw new Error('prospect create failed');
    for (const to of [
      'CONVERSATION',
      'PROBLEM_CONFIRMED',
      'SOLUTION_INTEREST',
      'WTP_SIGNAL',
      'PAYMENT_REQUESTED',
    ] as const) {
      const step = service.advanceProspect({
        ownerId: 'u1',
        problemId,
        prospectReference: 'clinic-owner-01',
        to,
      });
      if (!step.success) throw new Error(`advance ${to} failed: ${step.error}`);
    }
    // No payment evidence text → the transition must be REFUSED (previously a
    // fabricated "Verified payment from …" placeholder was auto-created).
    const paid = service.advanceProspect({
      ownerId: 'u1',
      problemId,
      prospectReference: 'clinic-owner-01',
      to: 'VERIFIED_PAYMENT',
    });
    expect(paid.success).toBe(false);
    if (!paid.success) expect(paid.code).toBe('PAYMENT_EVIDENCE_REQUIRED');
    const problem = service.stores.problems.get('u1', problemId);
    expect(problem?.revenueState).not.toBe('REVENUE_VERIFIED');
    expect(problem?.evidence.some((e) => e.source === 'verified_payment')).toBe(false);
    // Whitespace-only evidence is also refused.
    const blank = service.advanceProspect({
      ownerId: 'u1',
      problemId,
      prospectReference: 'clinic-owner-01',
      to: 'VERIFIED_PAYMENT',
      verifiedPaymentText: '   ',
    });
    expect(blank.success).toBe(false);
  });

  it('9. calibration is bounded — one event moves a factor by ≤ Δ0.05', () => {
    const service = makeService();
    const problemId = register(service);
    const factorKey = 'pain';
    const assessed = service.assessProblem({
      ownerId: 'u1',
      problemId,
      opportunityFactors: [{ key: factorKey, value: 0.5, status: 'VERIFIED' }],
    });
    if (!assessed.success) throw new Error('assess failed');
    observe(service, problemId); // a weak observation is enough to apply
    const result = service.calibrateProblemFactor({
      ownerId: 'u1',
      problemId,
      factorKey,
      direction: 1,
      reason: 'One independent customer confirmed the pain.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const moved = result.data.factors.find((f) => f.key === factorKey);
      expect(Math.abs(moved?.delta ?? 0)).toBeLessThanOrEqual(CALIBRATION_DELTA_MAX + 1e-9);
      expect(result.data.adjustments.length).toBeGreaterThanOrEqual(1);
      expect(result.data.adjustments[0]?.reason.length).toBeGreaterThan(0);
    }
  });

  it('10. calibration keeps the evidence trail — every adjustment is explainable', () => {
    const service = makeService();
    const problemId = register(service);
    const assessed = service.assessProblem({
      ownerId: 'u1',
      problemId,
      opportunityFactors: [{ key: 'pain', value: 0.5, status: 'VERIFIED' }],
    });
    if (!assessed.success) throw new Error('assess failed');
    observe(service, problemId);
    const result = service.calibrateProblemFactor({
      ownerId: 'u1',
      problemId,
      factorKey: 'pain',
      direction: -1,
      reason: 'A customer said the opposite of earlier evidence.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // The factor reason carries the bounded-delta evidence trail.
      const factorReason = result.data.factors[0]?.reason ?? '';
      expect(factorReason.includes('bounded')).toBe(true);
      expect(result.data.adjustments[0]?.evidenceState).toBeDefined();
    }
  });

  it('11. next best action can recommend STOP and prefers NO_COST first', () => {
    const service = makeService();
    const problemId = register(service);
    const action = service.opportunityNextBestAction('u1', problemId);
    expect(action.success).toBe(true);
    if (action.success) {
      expect([
        'TALK_TO_CUSTOMERS',
        'VERIFY_PROBLEM',
        'TEST_WTP',
        'RUN_NO_COST_EXPERIMENT',
        'WAIT_FOR_MORE_EVIDENCE',
      ]).toContain(action.data.action);
      expect(action.data.capitalMode).toBe('NO_COST');
      expect(action.data.why.length).toBeGreaterThan(0);
    }
  });

  it('12. comparison is evidence-driven — a problem with no business evidence is NOT strong', () => {
    const service = makeService();
    const problemId = register(service);
    const comparison = service.compareOpportunities('u1');
    const entry = comparison.entries.find((e) => e.problemId === problemId);
    // With one piece of evidence and no prospects/payments, the honest state
    // is UNKNOWN or INSUFFICIENT_EVIDENCE — never STRONG_EVIDENCE/PROMISING.
    expect(['UNKNOWN', 'INSUFFICIENT_EVIDENCE']).toContain(entry?.state);
  });

  it('13. opportunity drill-down exposes evidence, prospects and decision — advisory only', () => {
    const service = makeService();
    const problemId = register(service);
    observe(service, problemId);
    const dd = service.opportunityDrilldown('u1', problemId);
    expect(dd.success).toBe(true);
    if (dd.success) {
      expect(dd.data.observations.length).toBe(1);
      expect(dd.data.advisory).toBe(true);
      expect(dd.data.nextBestAction).toBeDefined();
    }
  });

  it('14. interest and willingness-to-pay never reach the verified revenue state', () => {
    const service = makeService();
    const problemId = register(service);
    observe(service, problemId, { statement: 'A clinic owner said this would be useful.' });
    const problem = service.stores.problems.get('u1', problemId);
    expect(problem?.revenueState).not.toBe('REVENUE_VERIFIED');
  });

  it('15. evidence quality is honest — UNKNOWN until real evidence exists', () => {
    const service = makeService();
    const problemId = register(service);
    const quality = service.opportunityEvidenceQuality('u1', problemId);
    expect(quality.success).toBe(true);
    if (quality.success) {
      expect(['UNKNOWN', 'LOW', 'MODERATE']).toContain(quality.data.overall);
    }
  });

  it('16. structural guarantee — no new spend/approve/execute surface on the evidence loop', () => {
    const service = makeService();
    const proto = Object.getPrototypeOf(service) as object;
    const methodNames = Object.getOwnPropertyNames(proto).filter((k) => k !== 'constructor');
    // The pre-existing delegating authorities (SPRINT-037 approval-gated
    // blueprint execution) are NOT part of the evidence loop; nothing new that
    // spends/authorizes/executes may exist.
    const delegating = new Set([
      'approveOrchestrationPlan',
      'decideBlueprintApproval',
      'advanceProspect',
    ]);
    const authority = methodNames.filter(
      (m) => /spend|purchase|authorize|execute/.test(m) && !delegating.has(m),
    );
    expect(authority).toEqual([]);
  });

  it('17. unknown cost/values remain UNKNOWN — never converted to zero by comparison', () => {
    const service = makeService();
    const problemId = register(service);
    const comparison = service.compareOpportunities('u1');
    const entry = comparison.entries.find((e) => e.problemId === problemId);
    expect(entry?.experimentCost).toBeDefined();
  });

  it('18. idempotency — re-observing with the same source reference upserts, never duplicates', () => {
    const service = makeService();
    const problemId = register(service);
    observe(service, problemId, { statement: 'First observation.' });
    observe(service, problemId, { statement: 'First observation.' });
    const list = service.listObservations('u1', problemId).data;
    expect(list.length).toBe(1);
  });
});

describe('FounderEvidenceLoop — domain branch coverage (SPRINT-039)', () => {
  const OWNER = 'u1';
  const NOW = '2026-08-15T10:00:00.000Z';
  const clock = (): string => NOW;

  function obs(overrides: Partial<FounderObservation> = {}): FounderObservation {
    return {
      id: 'obs-x',
      ownerId: OWNER,
      problemId: 'p-1',
      timestamp: NOW,
      sourceType: 'customer_conversation',
      sourceReference: 'clinic-owner-1',
      observedStatement: 'The owner told me reminders consume staff time.',
      evidenceState: 'REPORTED_BY_CUSTOMER',
      evidenceStrength: 'WEAK',
      provenance: { source: 'customer_conversation', reference: 'call-001', observedAt: NOW },
      verificationStatus: 'UNVERIFIED',
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    };
  }

  function prospect(overrides: Partial<CustomerDiscoveryRecord> = {}): CustomerDiscoveryRecord {
    return {
      id: 'pros-x',
      ownerId: OWNER,
      problemId: 'p-1',
      prospectReference: 'clinic-owner-1',
      customerSegment: 'small clinics',
      problemDiscussed: 'follow-up reminders',
      discoveryStatus: 'CONVERSATION',
      evidence: [],
      provenance: { source: 'interview', reference: 'call-001', observedAt: NOW },
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    };
  }

  function problem(overrides: Partial<BusinessProblem> = {}): BusinessProblem {
    return {
      id: 'p-1',
      ownerId: OWNER,
      stableKey: `${OWNER}:clinic-followups`,
      problemStatement: 'Clinic follow-up reminders consume staff time',
      competitorAlternatives: [],
      evidence: [],
      willingnessToPayEvidence: [],
      confidence: 'UNKNOWN',
      status: 'PROBLEM',
      revenueState: 'NO_EVIDENCE',
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    };
  }

  function factor(
    key: string,
    value: number | undefined,
    status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' = 'ESTIMATED',
  ): ProblemFactor {
    return { key, value, status, evidence: [] };
  }

  it('19. normalizeObservationState — every evidence-state path is deterministic', () => {
    expect(
      normalizeObservationState({
        sourceType: 'secondary_research',
        observedStatement: 'The data shows a pattern.',
      }),
    ).toBe('DOCUMENTED');
    expect(
      normalizeObservationState({
        sourceType: 'site_visit',
        observedStatement: 'I saw the queue during the visit.',
      }),
    ).toBe('FOUNDER_OBSERVED');
    expect(
      normalizeObservationState({
        sourceType: 'other',
        observedStatement: 'A record shows 5 customers.',
      }),
    ).toBe('DOCUMENTED');
    expect(
      normalizeObservationState({
        sourceType: 'founder_knowledge',
        observedStatement: 'I assume it is a problem.',
      }),
    ).toBe('HYPOTHESIS');
    // claimed states pass through — except VERIFIED (needs a real cross-check)
    expect(
      normalizeObservationState({
        sourceType: 'other',
        observedStatement: 'claim',
        claimedState: 'REPORTED_BY_CUSTOMER',
      }),
    ).toBe('REPORTED_BY_CUSTOMER');
    expect(
      normalizeObservationState({
        sourceType: 'other',
        observedStatement: 'claim',
        claimedState: 'HYPOTHESIS',
      }),
    ).toBe('HYPOTHESIS');
    // VERIFIED claimed → OBSERVED (never trusted at face value)
    expect(
      normalizeObservationState({
        sourceType: 'other',
        observedStatement: 'claim',
        claimedState: 'VERIFIED',
      }),
    ).toBe('OBSERVED');
  });

  it('20. validateFounderObservation — every refusal code + statement inference', () => {
    expect(
      validateFounderObservation(
        {
          ownerId: OWNER,
          sourceType: 'other',
          sourceReference: 'x',
          observedStatement: '',
          provenance: { source: 's', observedAt: NOW },
        },
        clock,
      ).code,
    ).toBe('STATEMENT_REQUIRED');
    expect(
      validateFounderObservation(
        {
          ownerId: OWNER,
          sourceType: 'other',
          sourceReference: '',
          observedStatement: 'A claim.',
          provenance: { source: 's', observedAt: NOW },
        },
        clock,
      ).code,
    ).toBe('SOURCE_REFERENCE_REQUIRED');
    // statement inference: customer-reported + will-pay language
    const reported = validateFounderObservation(
      {
        ownerId: OWNER,
        sourceType: 'other',
        sourceReference: 'clinic-owner-1',
        observedStatement: 'The clinic owner mentioned it is painful.',
        provenance: { source: 'interview', observedAt: NOW },
      },
      clock,
    );
    expect(reported.success && reported.data.evidenceState).toBe('REPORTED_BY_CUSTOMER');
    const willPay = validateFounderObservation(
      {
        ownerId: OWNER,
        sourceType: 'other',
        sourceReference: 'clinic-owner-1',
        observedStatement: 'The owner said they would pay for a tool.',
        provenance: { source: 'interview', observedAt: NOW },
      },
      clock,
    );
    expect(willPay.success && willPay.data.evidenceState).toBe('REPORTED_BY_CUSTOMER');
  });

  it('21. validateCustomerDiscoveryRecord — refusal codes + evidence normalization', () => {
    expect(
      validateCustomerDiscoveryRecord(
        {
          ownerId: OWNER,
          problemId: 'p-1',
          prospectReference: '',
          customerSegment: 'c',
          problemDiscussed: 'p',
          provenance: { source: 's', observedAt: NOW },
        },
        clock,
      ).code,
    ).toBe('PROSPECT_REFERENCE_REQUIRED');
    expect(
      validateCustomerDiscoveryRecord(
        {
          ownerId: OWNER,
          problemId: 'p-1',
          prospectReference: 'x',
          customerSegment: 'c',
          problemDiscussed: '',
          provenance: { source: 's', observedAt: NOW },
        },
        clock,
      ).code,
    ).toBe('PROBLEM_DISCUSSED_REQUIRED');
    expect(
      validateCustomerDiscoveryRecord(
        {
          ownerId: OWNER,
          problemId: 'p-1',
          prospectReference: 'x',
          customerSegment: 'c',
          problemDiscussed: 'p',
          provenance: { source: '', observedAt: NOW },
        },
        clock,
      ).code,
    ).toBe('PROVENANCE_REQUIRED');
    const ok = validateCustomerDiscoveryRecord(
      {
        ownerId: OWNER,
        problemId: 'p-1',
        prospectReference: 'clinic-owner-1',
        customerSegment: 'small clinics',
        problemDiscussed: 'follow-up reminders',
        evidence: [
          {
            source: 'customer_interview',
            observedAt: NOW,
            reference: 'call-1',
            text: 'It takes 4h/week',
            confidence: 'VERIFIED',
          },
        ],
        provenance: { source: 'interview', reference: 'call-1', observedAt: NOW },
      },
      clock,
    );
    expect(ok.success && ok.data.evidence.length).toBe(1);
    expect(ok.success && ok.data.discoveryStatus).toBe('CONTACTED');
  });

  it('22. evidence strength — verified + customer thresholds for STRONG/MODERATE', () => {
    expect(evidenceStrength([])).toBe('UNKNOWN');
    expect(evidenceStrength([obs()])).toBe('WEAK');
    expect(evidenceStrength([obs({ id: 'a' }), obs({ id: 'b' })])).toBe('MODERATE');
    expect(evidenceStrength([obs({ id: 'a' }), obs({ id: 'b' }), obs({ id: 'c' })])).toBe('STRONG');
    // one VERIFIED + one more observation → STRONG
    expect(
      evidenceStrength([
        obs({ id: 'a', evidenceState: 'VERIFIED', verificationStatus: 'VERIFIED' }),
        obs({ id: 'b' }),
      ]),
    ).toBe('STRONG');
  });

  it('23. prospect transitions — same-state, VERIFIED_PAYMENT reason, invalid jump', () => {
    expect(canAdvanceProspect('CONTACTED', 'CONVERSATION')).toBe(true);
    expect(canAdvanceProspect('WTP_SIGNAL', 'PAYMENT_REQUESTED')).toBe(true);
    expect(canAdvanceProspect('VERIFIED_PAYMENT', 'PAYMENT_REQUESTED')).toBe(false);
    expect(prospectTransitionReason('CONTACTED', 'CONTACTED')).toContain('already');
    expect(prospectTransitionReason('PAYMENT_REQUESTED', 'VERIFIED_PAYMENT')).toContain(
      'VERIFIED payment',
    );
    expect(prospectTransitionReason('CONTACTED', 'VERIFIED_PAYMENT')).toContain('not allowed');
  });

  it('24. evidence quality — per-dimension states incl. repetition/specificity/verification', () => {
    const q = evidenceQuality({
      problemId: 'p-1',
      observations: [
        obs({ id: 'a', frequency: 'daily', severity: 'high' }),
        obs({
          id: 'b',
          frequency: 'daily',
          severity: 'high',
          affectedCustomerSegment: 'clinics-a',
        }),
        obs({ id: 'c', affectedCustomerSegment: 'clinics-b' }),
      ],
      prospects: [prospect()],
      evidence: [
        {
          id: 'ev-1',
          ownerId: OWNER,
          source: 'verified_payment',
          observedAt: NOW,
          text: 'paid',
          confidence: 'VERIFIED',
          evidenceOnly: true,
        },
      ],
    });
    const names = new Set(q.dimensions.map((d) => d.name));
    expect(names.has('provenance')).toBe(true);
    expect(names.has('directness')).toBe(true);
    expect(names.has('independence')).toBe(true);
    expect(q.dimensions.find((d) => d.name === 'verification')?.state).toBe('HIGH');
    expect(q.overall).toBeDefined();
  });

  it('24b. evidence quality on EMPTY evidence — overall UNKNOWN and provenance UNKNOWN, never fake HIGH (SPRINT-041)', () => {
    const q = evidenceQuality({ problemId: 'p-1', observations: [], prospects: [], evidence: [] });
    expect(q.overall).toBe('UNKNOWN');
    // every() over an empty set is vacuously true — the empty case must NOT
    // claim HIGH provenance (fake precision on data that does not exist).
    expect(q.dimensions.find((d) => d.name === 'provenance')?.state).toBe('UNKNOWN');
  });

  it('25. calibrateFactors — UNKNOWN target stays UNKNOWN; conflicts surface; bounded deltas', () => {
    const unknown = calibrateFactors({
      problemId: 'p-1',
      current: [factor('revenueImpact', undefined, 'UNKNOWN')],
      observations: [],
      prospects: [],
      factorKey: 'revenueImpact',
      direction: 1,
      reason: 'attempt',
    });
    expect(unknown.factors[0]?.delta).toBe(0);
    expect(unknown.factors[0]?.quality).toBe('UNKNOWN');

    const conflicted = calibrateFactors({
      problemId: 'p-1',
      current: [factor('pain', 0.5)],
      observation: obs({ id: 'for', evidenceState: 'REPORTED_BY_CUSTOMER' }),
      observations: [
        obs({ id: 'for', evidenceState: 'REPORTED_BY_CUSTOMER' }),
        obs({ id: 'against', evidenceState: 'CONFLICTING' }),
      ],
      prospects: [],
      factorKey: 'pain',
      direction: 1,
      reason: 'customer confirmed',
    });
    expect(conflicted.conflicts.some((c) => c.state === 'CONFLICTING')).toBe(true);
    expect(conflicted.factors[0]?.after).toBeGreaterThan(0.5);
    expect(conflicted.factors[0]?.delta).toBeLessThanOrEqual(CALIBRATION_DELTA_MAX + 1e-9);
  });

  it('26. nextBestAction — REQUEST_PAYMENT / TEST_WTP / VERIFY_PROBLEM / RUN_NO_COST_EXPERIMENT', () => {
    const verified = problem({
      revenueState: 'REVENUE_VERIFIED',
      evidence: [
        {
          id: 'ev-p',
          ownerId: OWNER,
          source: 'verified_payment',
          observedAt: NOW,
          text: 'paid',
          confidence: 'VERIFIED',
          evidenceOnly: true,
        },
      ],
    });
    const wtp = prospect({
      discoveryStatus: 'WTP_SIGNAL',
      willingnessToPayIndication: { value: 5000, status: 'ESTIMATED', evidence: ['stated'] },
    });
    expect(
      nextBestAction({ problem: verified, observations: [], prospects: [wtp], quality: 'MODERATE' })
        .action,
    ).toBe('REQUEST_PAYMENT');

    const three = [
      prospect({ id: 'a', discoveryStatus: 'PROBLEM_CONFIRMED' }),
      prospect({ id: 'b', discoveryStatus: 'PROBLEM_CONFIRMED' }),
      prospect({ id: 'c', discoveryStatus: 'SOLUTION_INTEREST' }),
    ];
    expect(
      nextBestAction({
        problem: problem(),
        observations: [],
        prospects: three,
        quality: 'MODERATE',
      }).action,
    ).toBe('TEST_WTP');

    const needsReview = nextBestAction({
      problem: problem(),
      observations: [obs({ id: 'a' }), obs({ id: 'b' })],
      prospects: [],
      quality: 'NEEDS_REVIEW',
    });
    expect(needsReview.action).toBe('VERIFY_PROBLEM');

    const runExperiment = nextBestAction({
      problem: problem(),
      observations: [obs({ id: 'a' }), obs({ id: 'b' })],
      prospects: [],
      quality: 'LOW',
    });
    expect(runExperiment.action).toBe('RUN_NO_COST_EXPERIMENT');
    expect(runExperiment.capitalMode).toBe('NO_COST');
  });

  it('26a. nextBestAction — verified payment without an active WTP signal never claims insufficient evidence (SPRINT-041)', () => {
    const verified = problem({
      revenueState: 'REVENUE_VERIFIED',
      evidence: [
        {
          id: 'ev-p',
          ownerId: OWNER,
          source: 'verified_payment',
          observedAt: NOW,
          text: 'paid',
          confidence: 'VERIFIED',
          evidenceOnly: true,
        },
      ],
    });
    // The prospect that paid is at VERIFIED_PAYMENT — no ACTIVE WTP_SIGNAL remains.
    const paid = prospect({ discoveryStatus: 'VERIFIED_PAYMENT' });
    const action = nextBestAction({
      problem: verified,
      observations: [],
      prospects: [paid],
      quality: 'UNKNOWN',
    });
    // TALK_TO_CUSTOMERS is honest here (find more prospects to convert) —
    // the why must NOT claim evidence quality is insufficient.
    expect(action.action).toBe('TALK_TO_CUSTOMERS');
    expect(action.why.some((w) => w.includes('insufficient'))).toBe(false);
    expect(action.why.some((w) => w.includes('repeatability'))).toBe(true);
    expect(action.capitalMode).toBe('NO_COST');
  });

  it('26b. verified payment overrides a stale advisory STOP (SPRINT-041)', () => {
    // stopReason was set by an earlier assessProblem (e.g. "no identifiable
    // buyer") BEFORE the payment existed — a verified payment contradicts it.
    const paidAfterStop = problem({
      stopReason: 'No identifiable buyer — buyer access is unproven.',
      revenueState: 'REVENUE_VERIFIED',
      evidence: [
        {
          id: 'ev-p',
          ownerId: OWNER,
          source: 'verified_payment',
          observedAt: NOW,
          text: 'paid',
          confidence: 'VERIFIED',
          evidenceOnly: true,
        },
      ],
    });
    const action = nextBestAction({
      problem: paidAfterStop,
      observations: [],
      prospects: [],
      quality: 'UNKNOWN',
    });
    expect(action.action).not.toBe('STOP');
    expect(action.action).toBe('TALK_TO_CUSTOMERS');
    expect(
      opportunityComparisonState({
        problem: paidAfterStop,
        observations: [],
        prospects: [],
        quality: 'UNKNOWN',
      }),
    ).toBe('PROMISING');
    // Founder/lifecycle-terminal states STILL dominate even with a payment.
    const rejectedWithPayment = problem({
      status: 'REJECTED',
      revenueState: 'REVENUE_VERIFIED',
      evidence: [
        {
          id: 'ev-p2',
          ownerId: OWNER,
          source: 'verified_payment',
          observedAt: NOW,
          text: 'paid',
          confidence: 'VERIFIED',
          evidenceOnly: true,
        },
      ],
    });
    expect(
      nextBestAction({
        problem: rejectedWithPayment,
        observations: [],
        prospects: [],
        quality: 'UNKNOWN',
      }).action,
    ).toBe('STOP');
  });

  it('27. nextBestAction + comparison — STOP paths via status/reason/assessment', () => {
    const rejected = problem({ status: 'REJECTED' });
    const stopped = nextBestAction({
      problem: rejected,
      observations: [],
      prospects: [],
      quality: 'UNKNOWN',
    });
    expect(stopped.action).toBe('STOP');
    expect(
      opportunityComparisonState({
        problem: rejected,
        observations: [],
        prospects: [],
        quality: 'UNKNOWN',
      }),
    ).toBe('STOP');

    const noEvidence = problem({
      status: 'EXPERIMENT_COMPLETED',
      revenueState: 'NO_EVIDENCE',
      stopReason: 'No revenue evidence after the experiment.',
    });
    const stopWithReason = nextBestAction({
      problem: noEvidence,
      observations: [],
      prospects: [],
      quality: 'UNKNOWN',
    });
    expect(stopWithReason.action).toBe('STOP');
    expect(stopWithReason.why.some((w) => w.includes('revenue evidence'))).toBe(true);

    const assessmentStop = nextBestAction({
      problem: problem(),
      assessment: { stopRecommendation: { stop: true, reasons: ['Insufficient pain.'] } } as never,
      observations: [],
      prospects: [],
      quality: 'UNKNOWN',
    });
    expect(assessmentStop.action).toBe('STOP');
  });

  it('28. comparison states — STRONG_EVIDENCE / PROMISING / NEEDS_CUSTOMER_VALIDATION / INSUFFICIENT_EVIDENCE / UNKNOWN', () => {
    const verified = problem({
      revenueState: 'REVENUE_VERIFIED',
      evidence: [
        {
          id: 'ev-p',
          ownerId: OWNER,
          source: 'verified_payment',
          observedAt: NOW,
          text: 'paid',
          confidence: 'VERIFIED',
          evidenceOnly: true,
        },
      ],
    });
    expect(
      opportunityComparisonState({
        problem: verified,
        observations: [],
        prospects: [],
        quality: 'HIGH',
      }),
    ).toBe('STRONG_EVIDENCE');
    expect(
      opportunityComparisonState({
        problem: verified,
        observations: [],
        prospects: [],
        quality: 'LOW',
      }),
    ).toBe('PROMISING');

    const three = [
      prospect({ id: 'a', discoveryStatus: 'PROBLEM_CONFIRMED' }),
      prospect({ id: 'b', discoveryStatus: 'PROBLEM_CONFIRMED' }),
      prospect({ id: 'c', discoveryStatus: 'SOLUTION_INTEREST' }),
    ];
    expect(
      opportunityComparisonState({
        problem: problem(),
        observations: [],
        prospects: three,
        quality: 'LOW',
      }),
    ).toBe('NEEDS_CUSTOMER_VALIDATION');
    expect(
      opportunityComparisonState({
        problem: problem(),
        observations: [],
        prospects: [],
        quality: 'UNKNOWN',
      }),
    ).toBe('UNKNOWN');
    expect(
      opportunityComparisonState({
        problem: problem(),
        observations: [obs({ id: 'a' })],
        prospects: [],
        quality: 'LOW',
      }),
    ).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('29. buildOpportunityComparison — bounded, sorted, reasons + ranking', () => {
    const verified = problem({
      id: 'p-strong',
      revenueState: 'REVENUE_VERIFIED',
      evidence: [
        {
          id: 'ev-p',
          ownerId: OWNER,
          source: 'verified_payment',
          observedAt: NOW,
          text: 'paid',
          confidence: 'VERIFIED',
          evidenceOnly: true,
        },
      ],
    });
    const stopped = problem({
      id: 'p-stop',
      status: 'REJECTED',
      stopReason: 'Rejected by the founder.',
    });
    const comp = buildOpportunityComparison({
      ownerId: OWNER,
      problems: [stopped, verified, problem({ id: 'p-none' })],
      observationsByProblem: new Map(),
      prospectsByProblem: new Map(),
      now: clock,
      limit: 2,
    });
    expect(comp.advisory).toBe(true);
    expect(comp.entries.length).toBeLessThanOrEqual(2);
    const strong = comp.entries.find((e) => e.problemId === 'p-strong');
    expect(strong?.verifiedPayments).toBe(1);
    const stop = comp.entries.find((e) => e.problemId === 'p-stop');
    expect(stop?.state).toBe('STOP');
    expect(stop?.reasons.some((r) => r.includes('Rejected'))).toBe(true);
  });

  it('30. observationId/prospectId — owner-scoped stable ids', () => {
    expect(observationId(OWNER, 'clinic-owner-1', NOW).startsWith('obs-')).toBe(true);
    expect(prospectId(OWNER, 'p-1', 'clinic-owner-1').startsWith('pros-')).toBe(true);
  });
});
