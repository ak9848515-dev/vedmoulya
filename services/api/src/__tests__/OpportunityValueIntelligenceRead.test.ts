// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.4 · Read-only opportunity value intelligence
//
// Proves the workspace READ counterpart of the S5.1 qualification mutation:
//   • it returns the EXISTING qualification + S6.3 value intelligence together;
//   • it performs NO lifecycle transition (safe on an already-moved record);
//   • it is owner-scoped — another user cannot read it (NOT_FOUND);
//   • it never manufactures approval (approved stays false);
//   • an unconfigured evidence source omits valueIntelligence (backwards safe);
//   • the existing S5.1 mutation behaviour is untouched.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ActiveIntelligenceControlPlane, InMemoryControlStores } from '@vedmoulya/control-plane';
import type { OpportunityLifecycleRecord, CommercialOutcomeRecord } from '@vedmoulya/control-plane';
import { InMemoryCommercialOutcomeStore } from '@vedmoulya/control-plane';
import { createControlRouter } from '../routers/ControlRouter.js';
import { createOpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { createMissionLaunchPort } from '../infrastructure/OpportunityMissionPorts.js';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';
import type { OpportunityValueEvidencePort } from '../services/OpportunityValueIntelligence.js';
import { BrainApplicationService } from '@vedmoulya/brain';
import {
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
} from '@vedmoulya/brain';

const OWNER = 'owner-1';
const OTHER = 'owner-2';
const NOW = '2026-10-06T09:00:00.000Z';

const POSTING = {
  source: 'rss-feed',
  sourceReference: 'https://board.example/jobs/77',
  title: 'Build a TypeScript SDK',
  description: 'Client needs a typed SDK for their public API.',
  requirements: ['typescript', 'api design'],
};

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

function harness(opts: { withEvidence?: boolean } = {}) {
  const brain = createBrain();
  const stores = new InMemoryControlStores();
  const plane = new ActiveIntelligenceControlPlane({
    brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
    proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
    fabric: {} as never,
    stores,
    now: () => NOW,
  });
  const outcomeStore = new InMemoryCommercialOutcomeStore();
  const evidence: OpportunityValueEvidencePort | undefined = opts.withEvidence
    ? { listCommercialOutcomes: (userId) => outcomeStore.list(userId) }
    : undefined;
  const router = createControlRouter(plane, {
    approval: createOpportunityApprovalPort(brain),
    qualify: createOpportunityQualifier({ brain, valueEvidence: evidence, now: () => NOW }).qualify,
    mission: createMissionLaunchPort({ createAndRun: async () => ({ missionId: 'm-1' }) }),
  });
  const ctx = { userId: OWNER } as never;
  return { router, plane, outcomeStore, ctx, otherCtx: { userId: OTHER } as never };
}

async function imported(h: ReturnType<typeof harness>, ref = POSTING.sourceReference) {
  const r = await h.router.importOpportunity(
    { userId: OWNER, opportunity: { ...POSTING, sourceReference: ref } },
    h.ctx,
  );
  if (!r.success) throw new Error('import failed');
  return (r.data as OpportunityLifecycleRecord).id;
}

function outcome(overrides: Partial<CommercialOutcomeRecord>): CommercialOutcomeRecord {
  return {
    outcomeId: 'co_1',
    userId: OWNER,
    missionId: 'm-1',
    objectiveId: 'o-1',
    clientId: 'client-1',
    documentId: 'doc-1',
    status: 'PAID',
    recordedBy: OWNER,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('S6.4 — read-only value intelligence', () => {
  it('1. returns qualification + value intelligence for an existing (DISCOVERED) opportunity', async () => {
    const h = harness({ withEvidence: true });
    const id = await imported(h);
    h.outcomeStore.save(outcome({ opportunityId: id, status: 'PAID' }));

    const r = await h.router.getValueIntelligence({ id, userId: OWNER }, h.ctx);
    expect(r.success).toBe(true);
    const data = r.data as {
      assessment: { score: number; authorizationRequired: true };
      inputsUsed: { requiredCapabilities: number };
      approved: false;
      authorizationRequired: true;
      valueIntelligence?: { overallAssessment: string; commercialEvidence: { paidCount: number } };
      status: string;
    };
    // The EXISTING assessment and evidence inputs are present.
    expect(data.assessment.authorizationRequired).toBe(true);
    expect(data.inputsUsed.requiredCapabilities).toBe(2);
    // The S6.3 evidence layer is present and honest.
    expect(data.valueIntelligence?.commercialEvidence.paidCount).toBe(1);
    // Never an approval.
    expect(data.approved).toBe(false);
  });

  it('2. performs NO transition — the lifecycle status is unchanged and returned as-is', async () => {
    const h = harness();
    const id = await imported(h);
    const before = h.plane.listOpportunities(OWNER).find((o) => o.id === id)?.status;
    expect(before).toBe('DISCOVERED');

    const r = await h.router.getValueIntelligence({ id, userId: OWNER }, h.ctx);
    expect(r.success).toBe(true);
    // The record is STILL DISCOVERED — the read never qualifies it.
    const after = h.plane.listOpportunities(OWNER).find((o) => o.id === id);
    expect(after?.status).toBe('DISCOVERED');
    // The returned status mirrors the stored one (never a manufactured ASSESSED).
    expect((r.data as { status: string }).status).toBe('DISCOVERED');
    // No approval was attached.
    expect(after?.approval).toBeUndefined();
  });

  it('3. is safe on an already-ASSESSED opportunity (the mutation would refuse)', async () => {
    const h = harness();
    const id = await imported(h);
    // Move the record on through the canonical transition.
    const moved = await h.router.transitionOpportunity(
      { userId: OWNER, id, to: 'ASSESSED', note: 'walk' },
      h.ctx,
    );
    expect(moved.success).toBe(true);

    // The mutation refuses a moved-on record…
    const refused = await h.router.qualifyOpportunity({ id, userId: OWNER }, h.ctx);
    expect(refused.success).toBe(false);

    // …but the read succeeds without changing anything.
    const read = await h.router.getValueIntelligence({ id, userId: OWNER }, h.ctx);
    expect(read.success).toBe(true);
    expect((read.data as { status: string }).status).toBe('ASSESSED');
    expect(h.plane.listOpportunities(OWNER).find((o) => o.id === id)?.status).toBe('ASSESSED');
  });

  it('4. is owner-scoped — another user gets NOT_FOUND', async () => {
    const h = harness();
    const id = await imported(h);
    const r = await h.router.getValueIntelligence({ id, userId: OTHER }, h.otherCtx);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.details?.opportunityCode).toBe('NOT_FOUND');
  });

  it('5. a missing opportunity is NOT_FOUND', async () => {
    const h = harness();
    const r = await h.router.getValueIntelligence({ id: 'nope', userId: OWNER }, h.ctx);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.details?.opportunityCode).toBe('NOT_FOUND');
  });

  it('6. without an evidence source, valueIntelligence is omitted (backwards compatible)', async () => {
    const h = harness({ withEvidence: false });
    const id = await imported(h);
    const r = await h.router.getValueIntelligence({ id, userId: OWNER }, h.ctx);
    expect(r.success).toBe(true);
    const data = r.data as { valueIntelligence?: unknown; approved: false };
    expect(data.valueIntelligence).toBeUndefined();
    expect(data.approved).toBe(false);
  });

  it('7. owner isolation holds for the linked evidence — User B sees no User A outcomes', async () => {
    const h = harness({ withEvidence: true });
    const id = await imported(h);
    // User A owns a paid outcome for THIS opportunity.
    h.outcomeStore.save(outcome({ userId: OWNER, opportunityId: id, status: 'PAID' }));

    const mine = await h.router.getValueIntelligence({ id, userId: OWNER }, h.ctx);
    const minePaid = (
      mine.data as { valueIntelligence?: { commercialEvidence: { paidCount: number } } }
    ).valueIntelligence?.commercialEvidence.paidCount;
    expect(minePaid).toBe(1);

    // User B cannot even resolve the record.
    const theirs = await h.router.getValueIntelligence({ id, userId: OTHER }, h.otherCtx);
    expect(theirs.success).toBe(false);
  });

  it('8. the read never creates a Mission or an approval', async () => {
    const h = harness();
    const id = await imported(h);
    await h.router.getValueIntelligence({ id, userId: OWNER }, h.ctx);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
    expect(h.plane.listOpportunities(OWNER).find((o) => o.id === id)?.approval).toBeUndefined();
  });
});
