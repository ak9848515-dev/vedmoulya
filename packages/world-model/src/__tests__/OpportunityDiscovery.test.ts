// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — WorldModelService SPRINT-038 opportunity discovery &
// revenue validation tests (hermetic — in-memory stores, scripted ports).
// The practical problem→revenue-validation path composed over the frozen
// estate: evidence/provenance-required problems, THREE distinct advisory
// scores, explainable levels, bounded lifecycle, verified-payment-only
// revenue states, zero/low-cost experiment planner, STOP recommendations,
// fabric-composed provider economics, business candidates, owner isolation
// and structural no-authority guarantees.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { StrategySelection } from '@vedmoulya/intelligence-fabric';
import { ActionClassPolicy } from '@vedmoulya/proactive';
import { WorldModelService } from '../application/WorldModelService.js';
import { InMemoryWorldStores } from '../infrastructure/InMemoryWorldStores.js';
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
      estimatedCost: { label: 'Unknown — depends on provider choice', status: 'UNKNOWN' },
      estimatedRevenue: { label: 'Unknown — no verified revenue data', status: 'UNKNOWN' },
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

function makeService(overrides?: Partial<WorldApprovalPort>): WorldModelService {
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
    ...(overrides ? { approval: approvalPort() } : {}),
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

function register(
  service: WorldModelService,
  statement = 'SME bookkeeping takes hours weekly and errors are costly',
) {
  return service.registerProblem({
    ownerId: 'u1',
    problemStatement: statement,
    customerOrBusiness: 'small manufacturing business',
    industry: 'manufacturing',
    workflow: 'bookkeeping',
    affectedRole: 'owner-operator',
    pain: 'manual data entry every week',
    frequency: 'weekly recurring',
    humanEffort: '4 hours per week',
    evidence: baseEvidence(),
  });
}

describe('WorldModelService — SPRINT-038 opportunity discovery & revenue validation', () => {
  it('1. evidence is REQUIRED — a problem with no evidence is refused', () => {
    const service = makeService();
    const result = service.registerProblem({
      ownerId: 'u1',
      problemStatement: 'Fabricated problem with no proof',
      evidence: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('EVIDENCE_REQUIRED');
  });

  it('2. fabricated/unverifiable claims are rejected', () => {
    const service = makeService();
    const withEmptyText = service.registerProblem({
      ownerId: 'u1',
      problemStatement: 'A claim with empty evidence text',
      evidence: [{ source: 'customer_interview', text: '   ', confidence: 'ESTIMATED' }],
    });
    expect(withEmptyText.success).toBe(false);
    if (!withEmptyText.success) expect(withEmptyText.code).toBe('EVIDENCE_REQUIRED');
  });

  it('3. missing evidence stays UNKNOWN — never fabricated', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    // No opportunity factors given → the opportunity score stays 0 with a
    // rationale that says UNKNOWN, never a fabricated number.
    const assessed = service.assessProblem({ ownerId: 'u1', problemId: reg.data.id });
    if (!assessed.success) throw new Error('assess failed');
    expect(assessed.data.opportunityScore.score).toBe(0);
    expect(assessed.data.opportunityScore.rationale.some((r) => r.includes('UNKNOWN'))).toBe(true);
  });

  it('4. three distinct advisory scores expose factors + documented weights', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const assessed = service.assessProblem({
      ownerId: 'u1',
      problemId: reg.data.id,
      problemFactors: [
        { key: 'pain', value: 0.8, status: 'ESTIMATED', evidence: ['interview-001'] },
        { key: 'frequency', value: 0.7, status: 'ESTIMATED', evidence: ['interview-001'] },
      ],
      opportunityFactors: [
        { key: 'economicValue', value: 0.8, status: 'ESTIMATED', evidence: ['interview-001'] },
        { key: 'aiFeasibility', value: 0.9, status: 'ESTIMATED', evidence: ['interview-001'] },
      ],
      experimentFactors: [
        {
          key: 'experimentCost',
          value: 0.9,
          status: 'ESTIMATED',
          evidence: ['interviews are free'],
        },
        {
          key: 'measurableOutcome',
          value: 0.8,
          status: 'ESTIMATED',
          evidence: ['interview notes'],
        },
      ],
    });
    if (!assessed.success) throw new Error('assess failed');
    expect(assessed.data.problemScore.weights.pain).toBe(1.3);
    expect(assessed.data.opportunityScore.weights.economicValue).toBe(1.4);
    expect(assessed.data.experimentScore.weights.experimentCost).toBe(1.2);
    expect(assessed.data.problemScore.factors.length).toBe(2);
    expect(assessed.data.advisory).toBe(true);
  });

  it('5. UNKNOWN economics never become zero — unknown factors contribute nothing', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const withUnknown = service.assessProblem({
      ownerId: 'u1',
      problemId: reg.data.id,
      problemFactors: [
        { key: 'pain', value: 0.8, status: 'ESTIMATED', evidence: ['a'] },
        { key: 'revenueImpact', value: undefined, status: 'UNKNOWN', evidence: [] },
        { key: 'errorImpact', value: undefined, status: 'UNKNOWN', evidence: [] },
      ],
    });
    const onlyKnown = service.assessProblem({
      ownerId: 'u1',
      problemId: reg.data.id,
      problemFactors: [{ key: 'pain', value: 0.8, status: 'ESTIMATED', evidence: ['a'] }],
    });
    if (!withUnknown.success || !onlyKnown.success) throw new Error('assess failed');
    expect(withUnknown.data.problemScore.score).toBe(onlyKnown.data.problemScore.score);
  });

  it('6. problem level 0–4 is explainable and evidence-driven', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const missionCritical = service.assessProblem({
      ownerId: 'u1',
      problemId: reg.data.id,
      problemFactors: [
        { key: 'errorImpact', value: 0.9, status: 'ESTIMATED', evidence: ['compliance risk'] },
      ],
    });
    if (!missionCritical.success) throw new Error('assess failed');
    expect(missionCritical.data.level).toBe(4);
    expect(missionCritical.data.levelLabel).toBe('MISSION_CRITICAL');
    expect(missionCritical.data.levelReasons.length).toBeGreaterThan(0);
  });

  it('7. lifecycle is bounded — no idea→business jump; transitions validated', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const jump = service.advanceProblem({
      ownerId: 'u1',
      problemId: reg.data.id,
      to: 'BUSINESS_CANDIDATE',
    });
    expect(jump.success).toBe(false);
    // OBSERVED must pass through PROBLEM first — a bounded chain, no skipping.
    const toProblem = service.advanceProblem({
      ownerId: 'u1',
      problemId: reg.data.id,
      to: 'PROBLEM',
    });
    expect(toProblem.success).toBe(true);
    const valid = service.advanceProblem({
      ownerId: 'u1',
      problemId: reg.data.id,
      to: 'VALIDATED_PROBLEM',
    });
    expect(valid.success).toBe(true);
  });

  it('8. customer interest ≠ payment; WTP ≠ payment; verified payment → REVENUE_VERIFIED', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const interest = service.recordCustomerSignal({
      ownerId: 'u1',
      problemId: reg.data.id,
      signal: 'INTEREST',
      text: 'This sounds useful.',
    });
    if (!interest.success) throw new Error('signal failed');
    expect(interest.data.revenueState).toBe('INTEREST');
    const wtp = service.recordCustomerSignal({
      ownerId: 'u1',
      problemId: reg.data.id,
      signal: 'WILLINGNESS_TO_PAY',
      text: 'I would pay ₹5,000/mo.',
    });
    if (!wtp.success) throw new Error('signal failed');
    expect(wtp.data.revenueState).toBe('PAYING_INTEREST');
    expect(wtp.data.willingnessToPayEvidence.length).toBe(1);
    const paid = service.recordVerifiedPayment({
      ownerId: 'u1',
      problemId: reg.data.id,
      text: 'First month paid ₹5,000 (UPI reference).',
    });
    if (!paid.success) throw new Error('payment failed');
    expect(paid.data.revenueState).toBe('REVENUE_VERIFIED');
  });

  it('9. repeated verified payments accumulate to REPEAT_REVENUE / REPEATABLE_BUSINESS', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    service.recordVerifiedPayment({ ownerId: 'u1', problemId: reg.data.id, text: 'Payment 1' });
    const second = service.recordVerifiedPayment({
      ownerId: 'u1',
      problemId: reg.data.id,
      text: 'Payment 2',
    });
    if (!second.success) throw new Error('payment failed');
    expect(second.data.revenueState).toBe('REPEAT_REVENUE');
    const third = service.recordVerifiedPayment({
      ownerId: 'u1',
      problemId: reg.data.id,
      text: 'Payment 3',
    });
    if (!third.success) throw new Error('payment failed');
    expect(third.data.revenueState).toBe('REPEATABLE_BUSINESS');
  });

  it('10. failed experiment → STOP/REVIEW recommendation', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    for (const to of [
      'PROBLEM',
      'VALIDATED_PROBLEM',
      'ECONOMIC_OPPORTUNITY',
      'AI_FEASIBLE',
      'EXPERIMENT_CANDIDATE',
      'EXPERIMENT_APPROVAL_REQUIRED',
      'EXPERIMENT_RUNNING',
      'EXPERIMENT_COMPLETED',
    ] as const) {
      const advanced = service.advanceProblem({ ownerId: 'u1', problemId: reg.data.id, to });
      if (!advanced.success) throw new Error(`advance to ${to} failed`);
    }
    const assessed = service.assessProblem({
      ownerId: 'u1',
      problemId: reg.data.id,
      problemFactors: [
        { key: 'pain', value: 0.2, status: 'ESTIMATED', evidence: ['weak interview'] },
      ],
      opportunityFactors: [
        { key: 'economicValue', value: 0.2, status: 'ESTIMATED', evidence: ['no demand'] },
      ],
    });
    if (!assessed.success) throw new Error('assess failed');
    expect(assessed.data.stopRecommendation?.stop).toBe(true);
  });

  it('11. cheap experiment preferred over expensive — planner prefers NO_COST and flags approval', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const noCost = service.planProblemExperiment({
      ownerId: 'u1',
      problemId: reg.data.id,
      hypothesis: 'SME owners would pay for automated bookkeeping',
      targetCustomer: 'small manufacturers',
      problemUnderTest: 'manual bookkeeping cost',
      objective: 'validate the problem is real',
      minimumRequiredData: ['interview notes'],
      actions: ['conduct 5 interviews'],
      successCriteria: ['3/5 confirm'],
      failureCriteria: ['no confirmation'],
      stopConditions: ['no confirmation after 5'],
      measurementMethod: 'interview notes',
    });
    if (!noCost.success) throw new Error('plan failed');
    expect(noCost.data.capitalMode).toBe('NO_COST');
    expect(noCost.data.approvalRequired).toBe(false);
    const paid = service.planProblemExperiment({
      ownerId: 'u1',
      problemId: reg.data.id,
      hypothesis: 'SME owners would pay',
      targetCustomer: 'small manufacturers',
      problemUnderTest: 'bookkeeping cost',
      objective: 'validate demand',
      minimumRequiredData: ['interview notes'],
      actions: ['run a paid ad campaign'],
      maxBudget: { value: 50, status: 'ESTIMATED', evidence: ['operator cap'] },
      capitalBudgetInr: 5000,
      successCriteria: ['signal'],
      failureCriteria: ['no signal'],
      stopConditions: ['budget reached'],
      measurementMethod: 'clicks',
    });
    if (!paid.success) throw new Error('plan failed');
    expect(paid.data.capitalMode).toBe('LOW_COST');
    expect(paid.data.approvalRequired).toBe(true);
  });

  it('12. customer discovery is preparation only — never a fabricated result', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const plan = service.customerDiscovery({ ownerId: 'u1', problemId: reg.data.id });
    if (!plan.success) throw new Error('discovery failed');
    expect(plan.data.interviewPlan.length).toBeGreaterThanOrEqual(5);
    expect(plan.data.willingnessToPayQuestions.length).toBeGreaterThanOrEqual(3);
    expect(plan.data.advisory).toBe(true);
  });

  it('13. provider economics reuses the Intelligence Fabric — existing provider preferred', async () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const economics = await service.problemProviderEconomics({
      ownerId: 'u1',
      problemId: reg.data.id,
      requiredCapabilities: ['research'],
    });
    if (!economics.success) throw new Error('economics failed');
    expect(economics.data.selections.length).toBe(1);
    expect(economics.data.selections[0]?.preferredExisting).toBe(true);
    expect(economics.data.capabilityGaps.length).toBe(0);
  });

  it('14. capability gap → founder notification, no automatic paid-provider adoption', async () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const economics = await service.problemProviderEconomics({
      ownerId: 'u1',
      problemId: reg.data.id,
      requiredCapabilities: ['some-missing-capability'],
    });
    if (!economics.success) throw new Error('economics failed');
    expect(economics.data.capabilityGaps.length).toBe(1);
    expect(economics.data.capabilityGaps[0]?.founderApprovalRequired).toBe(true);
    expect(economics.data.selections.length).toBe(0);
  });

  it('15. Business Candidate requires verified payment + WTP evidence', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const refused = service.businessCandidate({
      ownerId: 'u1',
      problemId: reg.data.id,
      serviceDefinition: 'bookkeeping automation service',
      targetCustomer: 'small manufacturers',
      deliveryWorkflow: ['onboard', 'automate', 'verify'],
      providerStrategy: 'BALANCED',
      mvpScope: ['automated ledger'],
      risks: [],
    });
    expect(refused.success).toBe(false);
    if (!refused.success) expect(refused.code).toBe('REVENUE_NOT_VERIFIED');
    service.recordCustomerSignal({
      ownerId: 'u1',
      problemId: reg.data.id,
      signal: 'WILLINGNESS_TO_PAY',
      text: 'I would pay ₹5,000/mo.',
    });
    service.recordVerifiedPayment({
      ownerId: 'u1',
      problemId: reg.data.id,
      text: 'Paid ₹5,000 for month one.',
    });
    const allowed = service.businessCandidate({
      ownerId: 'u1',
      problemId: reg.data.id,
      serviceDefinition: 'bookkeeping automation service',
      targetCustomer: 'small manufacturers',
      deliveryWorkflow: ['onboard', 'automate', 'verify'],
      providerStrategy: 'BALANCED',
      mvpScope: ['automated ledger'],
      risks: [],
    });
    expect(allowed.success).toBe(true);
    if (allowed.success) expect(allowed.data.advisory).toBe(true);
  });

  it('16. owner isolation — cross-owner reads/writes rejected (IDOR)', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    expect(service.getProblem('u2', reg.data.id).success).toBe(false);
    expect(
      service.addProblemEvidence({
        ownerId: 'u2',
        problemId: reg.data.id,
        source: 'customer_interview',
        text: 'foreign write attempt',
        confidence: 'ESTIMATED',
      }).success,
    ).toBe(false);
    expect(service.opportunityRadar('u2').entries.length).toBe(0);
  });

  it('17. stable-key idempotency — re-register never duplicates', () => {
    const service = makeService();
    const first = register(service);
    const second = register(service);
    if (!first.success || !second.success) throw new Error('register failed');
    expect(second.data.id).toBe(first.data.id);
    expect(service.listProblems('u1').data?.length).toBe(1);
  });

  it('18. bounded records — evidence per problem is capped', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    for (let i = 0; i < 30; i += 1) {
      service.addProblemEvidence({
        ownerId: 'u1',
        problemId: reg.data.id,
        source: 'direct_observation',
        text: `observation ${i}`,
        confidence: 'ESTIMATED',
      });
    }
    const final = service.getProblem('u1', reg.data.id);
    if (!final.success) throw new Error('get failed');
    expect(final.data.evidence.length).toBeLessThanOrEqual(20);
  });

  it('19. Opportunity Radar is bounded and honestly staged', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const radar = service.opportunityRadar('u1');
    expect(radar.entries.length).toBe(1);
    expect(radar.counts.newProblems).toBe(1);
    expect(radar.entries[0]?.hasVerifiedPayment).toBe(false);
    expect(radar.advisory).toBe(true);
  });

  it('20. external evidence can never grant authority (structural)', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    service.recordVerifiedPayment({ ownerId: 'u1', problemId: reg.data.id, text: 'Payment.' });
    const problem = service.getProblem('u1', reg.data.id);
    if (!problem.success) throw new Error('get failed');
    expect(problem.data.revenueState).toBe('REVENUE_VERIFIED');
    expect('approvedBy' in problem.data).toBe(false);
    expect('executed' in problem.data).toBe(false);
  });

  it('21. voice can never approve an experiment (no voice surface on problems)', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    // The problem domain has no approve/execute/authorize surface at all —
    // structurally there is nothing for voice (or any caller) to invoke.
    const problem = service.getProblem('u1', reg.data.id);
    if (!problem.success) throw new Error('get failed');
    expect('approve' in problem.data).toBe(false);
    expect('execute' in problem.data).toBe(false);
  });

  it('22. opportunity cannot execute itself — no execution surface on the radar/problem', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const radar = service.opportunityRadar('u1');
    const entry = radar.entries[0];
    expect(entry?.nextAction).toBeDefined();
    // Advisory next-action text only — no executable reference.
    expect(entry?.nextAction?.toLowerCase().includes('execute')).toBe(false);
  });

  it('23. malformed source data is rejected (sanitization + validation)', () => {
    const service = makeService();
    const reg = register(service);
    if (!reg.success) throw new Error('register failed');
    const malicious = service.addProblemEvidence({
      ownerId: 'u1',
      problemId: reg.data.id,
      source: 'customer_interview',
      text: '<script>alert("x")</script> Owner pays ₹5,000/mo',
      confidence: 'ESTIMATED',
    });
    if (!malicious.success) throw new Error('evidence failed');
    const stored = service.getProblem('u1', reg.data.id);
    if (!stored.success) throw new Error('get failed');
    const last = stored.data.evidence[stored.data.evidence.length - 1];
    expect(last?.text.includes('<')).toBe(false);
    expect(last?.text.includes('>')).toBe(false);
    expect(last?.text.includes('Owner pays')).toBe(true);
  });

  it('24. source unavailable handled honestly — no fabricated success', async () => {
    // The signal port reports UNAVAILABLE; the world model never fabricates.
    const service = makeService();
    const fetched = await service.listSignals('u1');
    expect(fetched.success).toBe(true);
    if (fetched.success) {
      expect(fetched.data.every((s) => s.status === 'UNAVAILABLE')).toBe(true);
    }
  });
});
