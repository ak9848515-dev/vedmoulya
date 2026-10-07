// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S7.1 · Ranking / recommendation + proposal DRAFT
//
// Proves the last two steps of the monitoring flow are composition, not new
// intelligence, and that the human boundary is structural:
//
//   QUALIFY (existing) → RANK/RECOMMEND → DRAFT (existing AI) → HUMAN REVIEW
//
// The ranking is measured against the REAL canonical qualifier. The proposal
// port is measured against a fake ORCHESTRATOR (the provider boundary) — never
// a live model, and never a fake mission/approval/qualification.
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
import {
  RECOMMENDATION_SCORE_THRESHOLD,
  rankOpportunities,
} from '../services/OpportunityRecommendation.js';
import {
  buildProposalUserInput,
  createOpportunityProposalPort,
  type OpportunityProposalOrchestrator,
} from '../infrastructure/OpportunityProposalPorts.js';
import { createControlRouter } from '../routers/ControlRouter.js';
import { createOpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { createMissionLaunchPort } from '../infrastructure/OpportunityMissionPorts.js';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';

const OWNER = 'owner-a';
const OTHER = 'owner-b';
const NOW = '2026-10-07T09:00:00.000Z';

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

function harness(options: { orchestrator?: OpportunityProposalOrchestrator } = {}) {
  const brain = createBrain();
  const plane = new ActiveIntelligenceControlPlane({
    brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
    proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
    fabric: {} as never,
    stores: new InMemoryControlStores(),
    now: () => NOW,
  });
  const qualify = createOpportunityQualifier({ brain, now: () => NOW }).qualify;
  const router = createControlRouter(plane, {
    approval: createOpportunityApprovalPort(brain),
    qualify,
    mission: createMissionLaunchPort({ createAndRun: async () => ({ missionId: 'm-1' }) }),
    proposal: createOpportunityProposalPort(options.orchestrator),
  });
  return { brain, plane, qualify, router, ctx: { userId: OWNER } as never };
}

/** Discover one canonical opportunity directly (the S7.1 monitor's own write). */
function discover(
  plane: ActiveIntelligenceControlPlane,
  input: { reference: string; title: string; requiredCapabilities: string[] },
): OpportunityLifecycleRecord {
  return plane.discoverOpportunityWithResult({
    ownerId: OWNER,
    title: input.title,
    description: `${input.title} description`,
    category: 'fixed',
    evidence: [{ label: 'Discovered via freelancer', status: 'VERIFIED' }],
    riskLevel: 'UNKNOWN',
    automationPotential: 'UNKNOWN',
    sourceRef: { source: 'freelancer', sourceReference: input.reference },
    requiredCapabilities: input.requiredCapabilities,
  }).record;
}

/** Give the owner demonstrable capabilities (the EXISTING evidence source). */
function withCapabilities(brain: BrainApplicationService, objective: string): void {
  brain.createTask(OWNER, objective);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — ranking / recommendation over the EXISTING verdicts', () => {
  it('1. a strong match is RECOMMENDED and a poor match is not (same existing score)', () => {
    const h = harness();
    withCapabilities(h.brain, 'typescript cli node tooling');
    discover(h.plane, {
      reference: 'project:1',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript', 'cli', 'node'],
    });
    discover(h.plane, {
      reference: 'project:2',
      title: 'Rust kernel work',
      requiredCapabilities: ['rust', 'asm'],
    });

    const ranked = rankOpportunities(h.plane.listOpportunities(OWNER), h.qualify);
    expect(ranked).toHaveLength(2);
    // Strong match first (the existing assessor's score dominates).
    expect(ranked[0]?.opportunityId).toBe(h.plane.listOpportunities(OWNER)[0]?.id);
    expect(ranked[0]?.recommended).toBe(true);
    expect(ranked[0]?.score).toBeGreaterThanOrEqual(RECOMMENDATION_SCORE_THRESHOLD);
    expect(ranked[1]?.recommended).toBe(false);
  });

  it('2. reasons are the EXISTING assessor evidence lines, and provenance is preserved', () => {
    const h = harness();
    withCapabilities(h.brain, 'typescript cli node tooling');
    discover(h.plane, {
      reference: 'project:1',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript', 'cli'],
    });
    const ranked = rankOpportunities(h.plane.listOpportunities(OWNER), h.qualify);
    const top = ranked[0]!;
    expect(top.reasons.join(' ')).toMatch(/capability fit/i);
    expect(top.source).toBe('freelancer');
    expect(top.sourceReference).toBe('project:1');
    expect(top.status).toBe('DISCOVERED');
    // Structural: ranking can never approve.
    expect(top.authorizationRequired).toBe(true);
    expect(top.approved).toBe(false);
  });

  it('3. a HIGH-risk opportunity is never presented as recommended', () => {
    const ranked = rankOpportunities(
      [
        {
          id: 'opp-high',
          ownerId: OWNER,
          stableKey: 'k',
          title: 'x',
          description: 'y',
          category: 'fixed',
          status: 'DISCOVERED',
          evidence: [],
          riskLevel: 'HIGH',
          automationPotential: 'UNKNOWN',
          transitions: [],
          createdAt: NOW,
          updatedAt: NOW,
        } as OpportunityLifecycleRecord,
      ],
      () =>
        ({
          assessment: { score: 0.99, businessCase: [], riskLevel: 'HIGH', evidence: ['e'] },
          inputsUsed: {
            requiredCapabilities: 0,
            availableCapabilities: 0,
            relatedWork: 0,
            marketSignals: 0,
          },
          authorizationRequired: true,
          approved: false,
        }) as never,
    );
    expect(ranked[0]?.score).toBe(0.99);
    expect(ranked[0]?.recommended).toBe(false);
  });

  it('4. terminal records are excluded and the order is deterministic', () => {
    const h = harness();
    withCapabilities(h.brain, 'typescript cli node tooling');
    const kept = discover(h.plane, {
      reference: 'project:1',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript'],
    });
    const dropped = discover(h.plane, {
      reference: 'project:2',
      title: 'Rejected work',
      requiredCapabilities: ['typescript'],
    });
    h.plane.transitionOpportunity({
      ownerId: OWNER,
      id: dropped.id,
      to: 'REJECTED',
      note: 'human rejected',
    });

    const once = rankOpportunities(h.plane.listOpportunities(OWNER), h.qualify);
    const twice = rankOpportunities(h.plane.listOpportunities(OWNER).slice().reverse(), h.qualify);
    expect(once.map((r) => r.opportunityId)).toEqual([kept.id]);
    expect(twice.map((r) => r.opportunityId)).toEqual(once.map((r) => r.opportunityId));
  });

  it('5. the ranked read is owner-scoped and never leaks another owner’s records', async () => {
    const h = harness();
    withCapabilities(h.brain, 'typescript cli node tooling');
    discover(h.plane, {
      reference: 'project:1',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript'],
    });
    const mine = await h.router.getRankedOpportunities({ userId: OWNER }, h.ctx);
    const theirs = await h.router.getRankedOpportunities({ userId: OTHER }, h.ctx);
    expect(mine.success).toBe(true);
    expect((mine.data as { recommendations: unknown[] }).recommendations).toHaveLength(1);
    expect((theirs.data as { recommendations: unknown[] }).recommendations).toHaveLength(0);
    expect((mine.data as { authorizationRequired: boolean }).authorizationRequired).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S7.1 — proposal DRAFT (preparation only, human-reviewed)', () => {
  const OPPORTUNITY = {
    opportunityId: 'opp-1',
    title: 'TypeScript reporting CLI',
    description: 'Recursive directory report.',
    category: 'fixed',
    requiredCapabilities: ['typescript'],
    evidence: ['Discovered via freelancer (VERIFIED)'],
    estimatedValue: { label: '500-1000 USD', status: 'ESTIMATED' },
    riskLevel: 'LOW',
  };

  it('6. with no orchestrator configured the draft is honestly UNAVAILABLE', async () => {
    const port = createOpportunityProposalPort(undefined);
    const result = await port.draft({ userId: OWNER, opportunity: OPPORTUNITY });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('PROPOSAL_DRAFT_UNAVAILABLE');
    // And the router maps it onto an honest failure envelope (503).
    const h = harness();
    discover(h.plane, {
      reference: 'project:1',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript'],
    });
    const id = h.plane.listOpportunities(OWNER)[0]!.id;
    const response = await h.router.generateProposalDraft({ id, userId: OWNER }, h.ctx);
    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error.details?.opportunityCode).toBe('PROPOSAL_DRAFT_UNAVAILABLE');
    expect(response.error.statusCode).toBe(503);
  });

  it('7. a draft is produced from canonical data and is NEVER submitted', async () => {
    const requests: unknown[] = [];
    const h = harness({
      orchestrator: {
        orchestrate: async (request) => {
          requests.push(request);
          return { content: '# Draft proposal', provider: 'fake', model: 'fake-1' };
        },
      },
    });
    discover(h.plane, {
      reference: 'project:1',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript'],
    });
    const id = h.plane.listOpportunities(OWNER)[0]!.id;
    const response = await h.router.generateProposalDraft({ id, userId: OWNER }, h.ctx);
    expect(response.success).toBe(true);
    const data = response.data as {
      document: string;
      submitted: false;
      authorizationRequired: true;
      status: string;
    };
    expect(data.document).toBe('# Draft proposal');
    // Structural: the draft is never submitted and always needs the human.
    expect(data.submitted).toBe(false);
    expect(data.authorizationRequired).toBe(true);
    expect(data.status).toBe('DISCOVERED');
    // The EXISTING orchestrator was called with the canonical opportunity data.
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0])).toContain('TypeScript CLI');
  });

  it('8. the prompt never invents a price: with no stated budget it asks the human', () => {
    const prompt = buildProposalUserInput({ ...OPPORTUNITY, estimatedValue: undefined });
    expect(prompt).toMatch(/NOT STATED BY THE SOURCE/i);
    expect(prompt).toMatch(/ask the human to set the price/i);
  });

  it('9. a source-stated budget is referenced AS the client-stated budget', () => {
    const prompt = buildProposalUserInput(OPPORTUNITY);
    expect(prompt).toContain('500-1000 USD');
    expect(prompt).toMatch(/as stated by the source/i);
    expect(prompt).toMatch(/evidence status/i);
  });

  it('10. an empty generation is a FAILURE, never a deliverable draft', async () => {
    const port = createOpportunityProposalPort({
      orchestrate: async () => ({ content: '   ' }),
    });
    const result = await port.draft({ userId: OWNER, opportunity: OPPORTUNITY });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('PROPOSAL_DRAFT_FAILED');
  });

  it('11. an orchestrator failure is reported honestly, never as a draft', async () => {
    const port = createOpportunityProposalPort({
      orchestrate: async () => {
        throw new Error('provider unavailable');
      },
    });
    const result = await port.draft({ userId: OWNER, opportunity: OPPORTUNITY });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('PROPOSAL_DRAFT_FAILED');
    expect(result.message).toContain('provider unavailable');
  });

  it('12. drafting another owner’s opportunity resolves as NOT_FOUND', async () => {
    const h = harness({
      orchestrator: { orchestrate: async () => ({ content: '# Draft' }) },
    });
    discover(h.plane, {
      reference: 'project:1',
      title: 'TypeScript CLI',
      requiredCapabilities: ['typescript'],
    });
    const id = h.plane.listOpportunities(OWNER)[0]!.id;
    const response = await h.router.generateProposalDraft({ id, userId: OTHER }, h.ctx);
    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error.details?.opportunityCode).toBe('NOT_FOUND');
  });

  it('13. the port exposes ONLY drafting — it has no submission capability', () => {
    const port = createOpportunityProposalPort(undefined) as unknown as Record<string, unknown>;
    expect(Object.keys(port)).toEqual(['draft']);
    for (const forbidden of ['submit', 'send', 'bid', 'publish', 'contact']) {
      expect(port[forbidden]).toBeUndefined();
    }
  });
});
