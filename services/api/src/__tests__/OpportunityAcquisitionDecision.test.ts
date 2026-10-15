// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S9 · Adaptive work-acquisition decision
//
// Proves the acquisition verdict is COMPOSITION over evidence that already
// exists, and that it distinguishes the four required outcomes:
//
//   RECOMMEND  — evidence supports prioritizing the opportunity.
//   DEFER      — evidence or a dependency is missing.
//   REJECT     — the candidate is unsuitable / fails a substantive requirement.
//   INELIGIBLE — a mandatory risk or budget gate blocks acquisition.
//
// The qualification is the REAL canonical qualifier (`BusinessOpportunityAssessor`
// behind `createOpportunityQualifier`) and the valuation is the REAL Sprint 016
// shape. Nothing here is a fake mission, a fake approval or a fake assessor.
// The decision holds no authority: it can never approve or launch.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ActiveIntelligenceControlPlane, InMemoryControlStores } from '@vedmoulya/control-plane';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import {
  BrainApplicationService,
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
} from '@vedmoulya/brain';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';
import {
  decideAcquisition,
  type AcquisitionValuation,
} from '../services/OpportunityAcquisitionDecision.js';
import {
  RECOMMENDATION_SCORE_THRESHOLD,
  rankOpportunities,
} from '../services/OpportunityRecommendation.js';
import { createControlRouter } from '../routers/ControlRouter.js';
import { createOpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { createMissionLaunchPort } from '../infrastructure/OpportunityMissionPorts.js';

const OWNER = 'owner-s9';
const NOW = '2026-10-13T09:00:00.000Z';

function createBrain(): BrainApplicationService {
  return new BrainApplicationService({
    plan: async () => ({ steps: [], rationale: '' }),
    candidates: async () => [],
    execution: async () => ({ output: '', success: true }),
    context: { assemble: async () => 'context' },
    preference: { record: async () => {} },
    tasks: new InMemoryBrainTaskStore(),
    decisions: new InMemoryBrainDecisionStore(),
    clock: { now: () => NOW },
    budget: { maxTokens: 10_000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 1000 },
    opportunities: new InMemoryOpportunityStore(),
  });
}

function harness() {
  const brain = createBrain();
  const plane = new ActiveIntelligenceControlPlane({
    brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
    proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
    fabric: {} as never,
    stores: new InMemoryControlStores(),
    now: () => NOW,
  });
  const qualifier = createOpportunityQualifier({ brain, now: () => NOW });
  return { brain, plane, qualifier };
}

/** Discover one canonical opportunity through the EXISTING lifecycle. */
function discover(
  plane: ActiveIntelligenceControlPlane,
  input: {
    reference: string;
    title: string;
    requiredCapabilities: string[];
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  },
): OpportunityLifecycleRecord {
  return plane.discoverOpportunityWithResult({
    ownerId: OWNER,
    title: input.title,
    description: `${input.title} description`,
    category: 'fixed',
    evidence: [{ label: 'Discovered via freelancer', status: 'VERIFIED' }],
    riskLevel: input.riskLevel ?? 'UNKNOWN',
    automationPotential: 'UNKNOWN',
    sourceRef: { source: 'freelancer', sourceReference: input.reference },
    requiredCapabilities: input.requiredCapabilities,
  }).record;
}

/** A complete Sprint 016 valuation shape, as the pipeline exposes it. */
const VALUATION: AcquisitionValuation = {
  expectedValue: { value: 1200, status: 'VERIFIED', evidence: ['invoice-1'] },
  expectedCost: { value: 300, status: 'VERIFIED', evidence: ['cost-1'] },
  expectedMargin: 0.75,
  expectedRoi: 3,
  rankScore: 9,
  valuationProvenance: 'OUTCOME_EVIDENCE',
  reasoning: ['Valuation derives from 1 owner-verified delivery.'],
};

describe('S9 — adaptive acquisition decision', () => {
  it('1. RECOMMEND: evidence supports prioritizing, and the S8 valuation is surfaced', () => {
    const h = harness();
    h.brain.createTask(OWNER, 'typescript cli node tooling');
    const record = discover(h.plane, {
      reference: 'project:1',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript', 'cli', 'node'],
    });

    const decision = decideAcquisition({
      record,
      qualification: h.qualifier.qualify(record),
      valuation: VALUATION,
      scoreThreshold: RECOMMENDATION_SCORE_THRESHOLD,
    });

    expect(decision.state).toBe('RECOMMEND');
    // Every published figure traces back to the valuation — nothing invented.
    expect(decision.reasons.some((r) => r.includes('$1200'))).toBe(true);
    expect(decision.reasons.some((r) => r.includes('$300'))).toBe(true);
    expect(decision.reasons.some((r) => r.includes('rank 9'))).toBe(true);
    expect(decision.reasons.some((r) => r.includes('verified outcome evidence'))).toBe(true);
  });

  it('2. DEFER: a required capability has no demonstrable owner evidence', () => {
    const h = harness(); // owner has performed no work at all
    const record = discover(h.plane, {
      reference: 'project:2',
      title: 'Rust kernel work',
      requiredCapabilities: ['rust', 'asm'],
    });

    const decision = decideAcquisition({
      record,
      qualification: h.qualifier.qualify(record),
      scoreThreshold: RECOMMENDATION_SCORE_THRESHOLD,
    });

    expect(decision.state).toBe('DEFER');
    expect(decision.missingEvidence.some((m) => m.includes('capability'))).toBe(true);
    expect(decision.changeConditions.length).toBeGreaterThan(0);
    // A missing valuation is stated as UNKNOWN, never as a zero-valued figure.
    expect(decision.missingEvidence.some((m) => m.includes('UNKNOWN'))).toBe(true);
    expect(decision.reasons.join(' ')).not.toMatch(/\$\d/);
  });

  it('3. REJECT: sufficient evidence, but the candidate does not match the work', () => {
    const h = harness();
    h.brain.createTask(OWNER, 'typescript cli node tooling');
    const record = discover(h.plane, {
      reference: 'project:3',
      title: 'Rust kernel work',
      requiredCapabilities: ['rust', 'asm'],
    });

    const decision = decideAcquisition({
      record,
      qualification: h.qualifier.qualify(record),
      scoreThreshold: RECOMMENDATION_SCORE_THRESHOLD,
    });

    expect(decision.state).toBe('REJECT');
    expect(decision.reasons.some((r) => r.includes('below the recommendation threshold'))).toBe(
      true,
    );
  });

  it('4. REJECT: verified outcome evidence shows a negative ROI', () => {
    const h = harness();
    h.brain.createTask(OWNER, 'typescript cli node tooling');
    const record = discover(h.plane, {
      reference: 'project:4',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript', 'cli', 'node'],
    });

    const decision = decideAcquisition({
      record,
      qualification: h.qualifier.qualify(record),
      valuation: {
        ...VALUATION,
        expectedRoi: -0.4,
        expectedMargin: -0.2,
      },
      scoreThreshold: RECOMMENDATION_SCORE_THRESHOLD,
    });

    expect(decision.state).toBe('REJECT');
    expect(decision.reasons.some((r) => r.includes('negative ROI'))).toBe(true);
  });

  it('5. INELIGIBLE: the persisted HIGH risk gate blocks acquisition', () => {
    const h = harness();
    h.brain.createTask(OWNER, 'typescript cli node tooling');
    const record = discover(h.plane, {
      reference: 'project:5',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript', 'cli', 'node'],
      riskLevel: 'HIGH',
    });

    const decision = decideAcquisition({
      record,
      qualification: h.qualifier.qualify(record),
      valuation: VALUATION,
      scoreThreshold: RECOMMENDATION_SCORE_THRESHOLD,
    });

    // A gate is decided BEFORE merit: an otherwise perfect candidate is blocked.
    expect(decision.state).toBe('INELIGIBLE');
    expect(decision.reasons.some((r) => r.includes('risk gate'))).toBe(true);
  });

  it('6. INELIGIBLE: a mandatory budget gate blocks acquisition', () => {
    const h = harness();
    h.brain.createTask(OWNER, 'typescript cli node tooling');
    const record = discover(h.plane, {
      reference: 'project:6',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript', 'cli', 'node'],
    });

    const decision = decideAcquisition({
      record,
      qualification: h.qualifier.qualify(record),
      valuation: VALUATION,
      budget: { availableUsd: 100 },
      scoreThreshold: RECOMMENDATION_SCORE_THRESHOLD,
    });

    expect(decision.state).toBe('INELIGIBLE');
    expect(decision.reasons.some((r) => r.includes('budget'))).toBe(true);
  });

  it('7. is deterministic, owner-scoped and never fabricates a figure', () => {
    const h = harness();
    h.brain.createTask(OWNER, 'typescript cli node tooling');
    const record = discover(h.plane, {
      reference: 'project:7',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript', 'cli', 'node'],
    });
    const qualification = h.qualifier.qualify(record);

    const once = decideAcquisition({ record, qualification, scoreThreshold: 0.5 });
    const twice = decideAcquisition({
      record,
      qualification: h.qualifier.qualify(record),
      scoreThreshold: 0.5,
    });
    expect(once).toEqual(twice);

    // No valuation ⇒ no numeric claim anywhere in the reasons.
    const noValuation = decideAcquisition({ record, qualification, scoreThreshold: 0.5 });
    expect(noValuation.reasons.join(' ')).not.toMatch(/\$\d/);
    expect(noValuation.missingEvidence.some((m) => m.includes('UNKNOWN'))).toBe(true);
  });

  it('8. composes into the EXISTING S7.1 ranking without changing its order', () => {
    const h = harness();
    h.brain.createTask(OWNER, 'typescript cli node tooling');
    const strong = discover(h.plane, {
      reference: 'project:8',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript', 'cli', 'node'],
    });
    discover(h.plane, {
      reference: 'project:9',
      title: 'Rust kernel work',
      requiredCapabilities: ['rust', 'asm'],
    });

    const valuations = new Map<string, AcquisitionValuation>([[strong.id, VALUATION]]);
    const ranked = rankOpportunities(h.plane.listOpportunities(OWNER), h.qualifier.qualify, {
      valuationsByOpportunityId: valuations,
    });

    expect(ranked[0]?.opportunityId).toBe(strong.id);
    expect(ranked[0]?.decision).toBe('RECOMMEND');
    expect(ranked[0]?.recommended).toBe(true);
    expect(ranked[1]?.decision).toBe('REJECT');
    // Advisory only — the ranking still cannot approve anything.
    expect(ranked.every((r) => r.authorizationRequired && r.approved === false)).toBe(true);
  });

  it('9. the router reports whether the S8 valuation was available', async () => {
    const h = harness();
    h.brain.createTask(OWNER, 'typescript cli node tooling');
    const record = discover(h.plane, {
      reference: 'project:10',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript', 'cli', 'node'],
    });

    const qualify = h.qualifier.qualify;
    const deps = {
      approval: createOpportunityApprovalPort(h.brain),
      qualify,
      mission: createMissionLaunchPort({ createAndRun: async () => ({ missionId: 'm-1' }) }),
      listValuations: () => new Map<string, AcquisitionValuation>([[record.id, VALUATION]]),
    };

    const wired = createControlRouter(h.plane, deps).getRankedOpportunities(
      { userId: OWNER } as never,
      { userId: OWNER } as never,
    );
    const wiredBody = (await wired).data as {
      recommendations: { decision: string }[];
      valuationAvailable: boolean;
    };
    expect(wiredBody.valuationAvailable).toBe(true);
    expect(wiredBody.recommendations[0]?.decision).toBe('RECOMMEND');

    // Without the port the decision is still honest — UNKNOWN valuation only.
    const bare = createControlRouter(h.plane, {
      ...deps,
      listValuations: undefined,
    }).getRankedOpportunities({ userId: OWNER } as never, { userId: OWNER } as never);
    const bareBody = (await bare).data as { valuationAvailable: boolean };
    expect(bareBody.valuationAvailable).toBe(false);
  });
});
