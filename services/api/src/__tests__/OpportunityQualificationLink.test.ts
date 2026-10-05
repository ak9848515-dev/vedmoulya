// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S5.1 — Qualification + Opportunity↔Mission association
//
// These drive the REAL router handlers over the REAL control plane, the REAL
// canonical assessor, the REAL Brain approval authority and the REAL Mission
// seam. Only the Mission *engine* is stubbed at the injected port boundary —
// which is exactly the boundary the architecture constrains.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeEach } from 'vitest';
import { ActiveIntelligenceControlPlane, InMemoryControlStores } from '@vedmoulya/control-plane';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import { createControlRouter } from '../routers/ControlRouter.js';
import { createOpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { createMissionLaunchPort } from '../infrastructure/OpportunityMissionPorts.js';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';
import { BrainApplicationService } from '@vedmoulya/brain';
import {
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
} from '@vedmoulya/brain';

// ── harness ────────────────────────────────────────────────────────────────
const OWNER = 'owner-1';
const OTHER = 'owner-2';

function createBrain(): BrainApplicationService {
  return new BrainApplicationService({
    plan: async () => ({ steps: [], rationale: '' }),
    candidates: async () => [],
    execution: async () => ({ output: '', success: true }),
    context: { assemble: async () => 'context' },
    preference: { record: async () => {} },
    tasks: new InMemoryBrainTaskStore(),
    decisions: new InMemoryBrainDecisionStore(),
    clock: { now: () => new Date(1_700_000_000_000).toISOString() },
    budget: { maxTokens: 10_000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 1000 },
    opportunities: new InMemoryOpportunityStore(),
  });
}

const POSTING = {
  source: 'rss-feed',
  sourceReference: 'https://board.example/jobs/77',
  title: 'Build a TypeScript SDK',
  description: 'Client needs a typed SDK for their public API.',
  requirements: ['typescript', 'api design'],
};

function harness(
  opts: {
    missionFails?: boolean;
    missionThrows?: boolean;
    sharePlane?: ActiveIntelligenceControlPlane;
    shareStores?: InMemoryControlStores;
  } = {},
) {
  const brain = createBrain();
  const stores = opts.shareStores ?? new InMemoryControlStores();
  const plane =
    opts.sharePlane ??
    new ActiveIntelligenceControlPlane({
      brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
      proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
      fabric: {} as never,
      stores,
      now: () => '2026-10-05T00:00:00.000Z',
    });
  const launched: Array<{ userId: string; title: string }> = [];
  let n = 0;
  const mission = createMissionLaunchPort({
    createAndRun: async (userId, input) => {
      launched.push({ userId, title: input.title });
      if (opts.missionThrows) throw new Error('engine exploded');
      if (opts.missionFails) return { error: 'budget exhausted' };
      return { missionId: `mission-${++n}` };
    },
  });
  const router = createControlRouter(plane, {
    approval: createOpportunityApprovalPort(brain),
    qualify: createOpportunityQualifier({ brain, now: () => '2026-10-05T00:00:00.000Z' }).qualify,
    mission,
  });
  const ctx = { userId: OWNER } as never;
  return { router, plane, stores, launched, ctx, otherCtx: { userId: OTHER } as never };
}

/** Import + walk the lifecycle to APPROVED, using only real transitions. */
async function approvedOpportunity(
  h: ReturnType<typeof harness>,
  ctx: never = h.ctx as never,
  ref = POSTING.sourceReference,
) {
  const imported = await h.router.importOpportunity(
    { userId: OWNER, opportunity: { ...POSTING, sourceReference: ref } },
    ctx,
  );
  if (!imported.success) throw new Error('import failed');
  const id = (imported.data as OpportunityLifecycleRecord).id;
  for (const to of ['ASSESSED', 'SHORTLISTED', 'PRESENTED'] as const) {
    const r = await h.router.transitionOpportunity({ userId: OWNER, id, to, note: 'walk' }, ctx);
    if (!r.success) throw new Error(`transition ${to} failed`);
  }
  const req = await h.router.requestOpportunityApproval({ userId: OWNER, opportunityId: id }, ctx);
  if (!req.success) throw new Error('approval request failed');
  const taskId = (req.data as { taskId: string }).taskId;
  const approved = await h.router.transitionOpportunity(
    { userId: OWNER, id, to: 'APPROVED', note: 'human approved', approvalTaskId: taskId },
    ctx,
  );
  if (!approved.success) throw new Error(`approval failed: ${JSON.stringify(approved.error)}`);
  return id;
}

// ── tests ──────────────────────────────────────────────────────────────────
describe('S5.1 — qualification', () => {
  it('1. qualifies a valid DISCOVERED opportunity using the canonical assessor', async () => {
    const h = harness();
    const imported = await h.router.importOpportunity(
      { userId: OWNER, opportunity: POSTING },
      h.ctx,
    );
    expect(imported.success).toBe(true);
    const id = (imported.data as OpportunityLifecycleRecord).id;

    const q = await h.router.qualifyOpportunity({ id, userId: OWNER }, h.ctx);
    expect(q.success).toBe(true);
    const data = q.data as {
      assessment: { score: number; evidence: string[]; authorizationRequired: true };
      inputsUsed: { requiredCapabilities: number };
      status: string;
      approved: false;
    };
    // The EXISTING assessment type, with its real evidence trail.
    expect(data.assessment.authorizationRequired).toBe(true);
    expect(Array.isArray(data.assessment.evidence)).toBe(true);
    // requiredCapabilities came from the source's stated requirements.
    expect(data.inputsUsed.requiredCapabilities).toBe(2);
  });

  it('2. qualification is user-scoped — another user cannot qualify it', async () => {
    const h = harness();
    const imported = await h.router.importOpportunity(
      { userId: OWNER, opportunity: POSTING },
      h.ctx,
    );
    const id = (imported.data as OpportunityLifecycleRecord).id;
    const q = await h.router.qualifyOpportunity({ id, userId: OTHER }, h.otherCtx);
    expect(q.success).toBe(false);
    if (q.success) return;
    expect(q.error.details?.opportunityCode).toBe('NOT_FOUND');
  });

  it('3. qualification does NOT approve and lands on ASSESSED', async () => {
    const h = harness();
    const imported = await h.router.importOpportunity(
      { userId: OWNER, opportunity: POSTING },
      h.ctx,
    );
    const id = (imported.data as OpportunityLifecycleRecord).id;
    const q = await h.router.qualifyOpportunity({ id, userId: OWNER }, h.ctx);
    expect((q.data as { approved: false }).approved).toBe(false);
    const stored = h.plane.listOpportunities(OWNER).find((o) => o.id === id);
    expect(stored?.status).toBe('ASSESSED');
    // No approval was attached, so the lifecycle cannot proceed on a score.
    expect(stored?.approval).toBeUndefined();
  });

  it('4. qualification creates no Mission', async () => {
    const h = harness();
    const imported = await h.router.importOpportunity(
      { userId: OWNER, opportunity: POSTING },
      h.ctx,
    );
    const id = (imported.data as OpportunityLifecycleRecord).id;
    await h.router.qualifyOpportunity({ id, userId: OWNER }, h.ctx);
    expect(h.launched).toHaveLength(0);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
  });
});

describe('S5.1 — approved opportunity → Mission', () => {
  it('5. an APPROVED opportunity starts a Mission through the existing path', async () => {
    const h = harness();
    const id = await approvedOpportunity(h);
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(true);
    expect(h.launched).toHaveLength(1);
    expect(h.launched[0]?.userId).toBe(OWNER);
  });

  it('6. the association is persisted and resolvable both ways', async () => {
    const h = harness();
    const id = await approvedOpportunity(h);
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    const missionId = (started.data as { missionId: string }).missionId;

    const byOpp = await h.router.getMissionForOpportunity(
      { opportunityId: id, userId: OWNER },
      h.ctx,
    );
    expect((byOpp.data as { missionId: string }).missionId).toBe(missionId);
    const byMission = await h.router.getOpportunityForMission({ missionId, userId: OWNER }, h.ctx);
    expect((byMission.data as { opportunityId: string }).opportunityId).toBe(id);
  });

  it('7. the association is idempotent — no duplicate Mission', async () => {
    const h = harness();
    const id = await approvedOpportunity(h);
    const first = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    const second = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    // The Mission engine was invoked exactly ONCE.
    expect(h.launched).toHaveLength(1);
    expect((first.data as { missionId: string }).missionId).toBe(
      (second.data as { missionId: string }).missionId,
    );
    expect((second.data as { alreadyLinked: boolean }).alreadyLinked).toBe(true);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(1);
  });

  it('8. different opportunities get independent Missions', async () => {
    const h = harness();
    const a = await approvedOpportunity(h, h.ctx as never, 'ref-a');
    const b = await approvedOpportunity(h, h.ctx as never, 'ref-b');
    await h.router.startMissionForOpportunity({ id: a, userId: OWNER }, h.ctx);
    await h.router.startMissionForOpportunity({ id: b, userId: OWNER }, h.ctx);
    expect(h.launched).toHaveLength(2);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(2);
  });

  it('9. different users are isolated', async () => {
    const h = harness();
    const a = await approvedOpportunity(h, h.ctx as never, 'shared-ref');
    await h.router.startMissionForOpportunity({ id: a, userId: OWNER }, h.ctx);

    // Owner-2 imports the SAME source reference and gets its own record.
    const otherImport = await h.router.importOpportunity(
      { userId: OTHER, opportunity: { ...POSTING, sourceReference: 'shared-ref' } },
      h.otherCtx,
    );
    expect(otherImport.success).toBe(true);
    const otherId = (otherImport.data as OpportunityLifecycleRecord).id;
    expect(otherId).not.toBe(a);

    // Owner-2 cannot see or start owner-1's Mission.
    const peek = await h.router.getMissionForOpportunity(
      { opportunityId: a, userId: OTHER },
      h.otherCtx,
    );
    expect(peek.data).toBeNull();
    const steal = await h.router.startMissionForOpportunity({ id: a, userId: OTHER }, h.otherCtx);
    expect(steal.success).toBe(false);
    expect(h.plane.listOpportunityMissionLinks(OTHER)).toHaveLength(0);
  });

  it('12. an UNAPPROVED opportunity cannot create a Mission', async () => {
    const h = harness();
    const imported = await h.router.importOpportunity(
      { userId: OWNER, opportunity: POSTING },
      h.ctx,
    );
    const id = (imported.data as OpportunityLifecycleRecord).id;
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(false);
    if (started.success) return;
    expect(started.error.details?.opportunityCode).toBe('APPROVAL_REQUIRED');
    expect(h.launched).toHaveLength(0);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
  });

  it('13. Mission creation failure produces NO association', async () => {
    const h = harness({ missionFails: true });
    const id = await approvedOpportunity(h);
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(false);
    if (started.success) return;
    expect(started.error.details?.opportunityCode).toBe('MISSION_CREATION_FAILED');
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
  });

  it('13b. a thrown Mission error is also an honest failure with no association', async () => {
    const h = harness({ missionThrows: true });
    const id = await approvedOpportunity(h);
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(false);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
  });

  it('14. association failure after retry is reported honestly', async () => {
    const h = harness();
    const id = await approvedOpportunity(h);
    // Break the store AFTER approval, so the Mission is created but the link
    // cannot be written. The response must say exactly that.
    Object.defineProperty(h.stores.opportunityMissionLinks, 'save', {
      value: () => {
        throw new Error('store offline');
      },
    });
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(false);
    if (started.success) return;
    expect(started.error.details?.opportunityCode).toBe('ASSOCIATION_PERSIST_FAILED');
    // The Mission really was created, and the error says so rather than
    // claiming a linkage that does not exist.
    expect(h.launched).toHaveLength(1);
    expect(started.error.message).toMatch(/was created but/);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
  });

  it('14b. transient association failure is absorbed by the idempotent retry', async () => {
    const h = harness();
    const id = await approvedOpportunity(h);
    let saveCalls = 0;
    const realSave = h.stores.opportunityMissionLinks.save.bind(h.stores.opportunityMissionLinks);
    Object.defineProperty(h.stores.opportunityMissionLinks, 'save', {
      value: (link: {
        userId: string;
        opportunityId: string;
        missionId: string;
        createdAt: string;
      }) => {
        saveCalls++;
        if (saveCalls === 1) throw new Error('store offline');
        return realSave(link);
      },
    });
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    // The first save failed, but the retry succeeded — honest success.
    expect(started.success).toBe(true);
    const data = started.data as { missionId: string; created: boolean; alreadyLinked: boolean };
    expect(data.created).toBe(true);
    expect(data.alreadyLinked).toBe(false);
    expect(saveCalls).toBe(2);
    // Exactly one Mission was created.
    expect(h.launched).toHaveLength(1);
    // Exactly one association exists, bound to the launched Mission.
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(1);
    expect(h.plane.getMissionForOpportunity(OWNER, id)?.missionId).toBe(data.missionId);
  });
}); // end S5.1 — association is idempotent, user-isolated, honest

// ─────────────────────────────────────────────────────────────────────────────
// S5.2 — Opportunity → Mission reliability hardening
// ─────────────────────────────────────────────────────────────────────────────

describe('S5.2 — Opportunity → Mission reliability hardening', () => {
  it('S5.2-1. sequential duplicate launch → one Mission, one association', async () => {
    const h = harness();
    const id = await approvedOpportunity(h);
    const first = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(first.success).toBe(true);
    const missionId1 = (first.data as { missionId: string }).missionId;
    const second = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(second.success).toBe(true);
    const data2 = second.data as { missionId: string; alreadyLinked: boolean };
    expect(data2.missionId).toBe(missionId1);
    expect(data2.alreadyLinked).toBe(true);
    expect(h.launched).toHaveLength(1);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(1);
  });

  it('S5.2-2. concurrent duplicate launch → one Mission, one association', async () => {
    const h = harness();
    const id = await approvedOpportunity(h);
    // Two concurrent launches share one in-process execution; both callers
    // receive the SAME response object, one Mission, one association.
    const [a, b] = await Promise.all([
      h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx),
      h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx),
    ]);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    const ma = (a.data as { missionId: string }).missionId;
    const mb = (b.data as { missionId: string }).missionId;
    expect(ma).toBe(mb);
    expect(h.launched).toHaveLength(1);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(1);
  });

  it('S5.2-3. association retry reuses the existing Mission', async () => {
    const h = harness();
    const id = await approvedOpportunity(h);
    let calls = 0;
    const realSave = h.stores.opportunityMissionLinks.save.bind(h.stores.opportunityMissionLinks);
    Object.defineProperty(h.stores.opportunityMissionLinks, 'save', {
      value: (link: {
        userId: string;
        opportunityId: string;
        missionId: string;
        createdAt: string;
      }) => {
        calls++;
        if (calls === 1) throw new Error('transient');
        return realSave(link);
      },
    });
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(true);
    const data = started.data as { missionId: string };
    expect(h.launched).toHaveLength(1);
    expect(h.plane.getMissionForOpportunity(OWNER, id)?.missionId).toBe(data.missionId);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(1);
  });

  it('S5.2-4. different opportunities → independent Missions', async () => {
    const h = harness();
    const id1 = await approvedOpportunity(h, h.ctx as never, 'ref-1');
    const id2 = await approvedOpportunity(h, h.ctx as never, 'ref-2');
    const m1 = await h.router.startMissionForOpportunity({ id: id1, userId: OWNER }, h.ctx);
    const m2 = await h.router.startMissionForOpportunity({ id: id2, userId: OWNER }, h.ctx);
    expect(m1.success).toBe(true);
    expect(m2.success).toBe(true);
    const id1m = (m1.data as { missionId: string }).missionId;
    const id2m = (m2.data as { missionId: string }).missionId;
    expect(id1m).not.toBe(id2m);
    expect(h.launched).toHaveLength(2);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(2);
  });

  it('S5.2-5. different users → isolated Missions and associations', async () => {
    const h = harness();
    const idA = await approvedOpportunity(h, h.ctx as never, 'user-a-ref');
    const mA = await h.router.startMissionForOpportunity({ id: idA, userId: OWNER }, h.ctx);
    expect(mA.success).toBe(true);
    const missionA = (mA.data as { missionId: string }).missionId;

    const otherImport = await h.router.importOpportunity(
      { userId: OTHER, opportunity: { ...POSTING, sourceReference: 'user-a-ref' } },
      h.otherCtx,
    );
    expect(otherImport.success).toBe(true);
    const idB = (otherImport.data as OpportunityLifecycleRecord).id;
    for (const to of ['ASSESSED', 'SHORTLISTED', 'PRESENTED'] as const) {
      const r = await h.router.transitionOpportunity(
        { userId: OTHER, id: idB, to, note: 'walk' },
        h.otherCtx,
      );
      expect(r.success).toBe(true);
    }
    const req = await h.router.requestOpportunityApproval(
      { userId: OTHER, opportunityId: idB },
      h.otherCtx,
    );
    const taskId = (req.data as { taskId: string }).taskId;
    const approved = await h.router.transitionOpportunity(
      { userId: OTHER, id: idB, to: 'APPROVED', note: 'ok', approvalTaskId: taskId },
      h.otherCtx,
    );
    expect(approved.success).toBe(true);
    const mB = await h.router.startMissionForOpportunity({ id: idB, userId: OTHER }, h.otherCtx);
    expect(mB.success).toBe(true);
    const missionB = (mB.data as { missionId: string }).missionId;
    expect(missionA).not.toBe(missionB);
    expect(h.plane.getMissionForOpportunity(OTHER, idA)).toBeUndefined();
    expect(h.plane.getOpportunityForMission(OTHER, missionA)).toBeUndefined();
    expect(h.plane.listOpportunityMissionLinks(OTHER)).toHaveLength(1);
  });

  it('S5.2-6. unapproved opportunity → no Mission', async () => {
    const h = harness();
    const imported = await h.router.importOpportunity(
      { userId: OWNER, opportunity: POSTING },
      h.ctx,
    );
    expect(imported.success).toBe(true);
    const id = (imported.data as OpportunityLifecycleRecord).id;
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(false);
    expect(h.launched).toHaveLength(0);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
  });

  it('S5.2-7. mission engine failure → no association, honest error', async () => {
    const h = harness({ missionFails: true });
    const id = await approvedOpportunity(h);
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(false);
    if (started.success) return;
    expect(started.error.details?.opportunityCode).toBe('MISSION_CREATION_FAILED');
    // The engine was invoked once; no association was persisted for a
    // Mission that does not exist.
    expect(h.launched).toHaveLength(1);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
  });

  it('S5.2-8. interrupted claim (PLANNED, no link) is reclaimed, not refused', async () => {
    // First attempt fails AFTER the APPROVED → PLANNED claim was taken.
    const failing = harness({ missionFails: true });
    const id = await approvedOpportunity(failing);
    const failed = await failing.router.startMissionForOpportunity(
      { id, userId: OWNER },
      failing.ctx,
    );
    expect(failed.success).toBe(false);
    expect(failing.plane.getMissionForOpportunity(OWNER, id)).toBeUndefined();
    // Engine recovers. A fresh router over the SAME plane + stores reclaims
    // the durable interrupted claim and launches exactly one Mission.
    const recovered = harness({ sharePlane: failing.plane, shareStores: failing.stores });
    const retry = await recovered.router.startMissionForOpportunity(
      { id, userId: OWNER },
      recovered.ctx,
    );
    expect(retry.success).toBe(true);
    const data = retry.data as { missionId: string; created: boolean; alreadyLinked: boolean };
    expect(data.created).toBe(true);
    expect(data.alreadyLinked).toBe(false);
    expect(recovered.launched).toHaveLength(1);
    expect(recovered.plane.getMissionForOpportunity(OWNER, id)?.missionId).toBe(data.missionId);
    expect(recovered.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(1);
  });
});

describe('S5.1 — complete controlled flow', () => {
  it('IMPORT → QUALIFY → APPROVE → MISSION → LINK, all governed', async () => {
    const h = harness();

    // IMPORT
    const imported = await h.router.importOpportunity(
      { userId: OWNER, opportunity: POSTING },
      h.ctx,
    );
    expect(imported.success).toBe(true);
    const id = (imported.data as OpportunityLifecycleRecord).id;
    expect((imported.data as OpportunityLifecycleRecord).status).toBe('DISCOVERED');

    // QUALIFY — advisory only
    const q = await h.router.qualifyOpportunity({ id, userId: OWNER }, h.ctx);
    expect((q.data as { status: string }).status).toBe('ASSESSED');

    // Shortlist + present (still no approval)
    for (const to of ['SHORTLISTED', 'PRESENTED'] as const) {
      const r = await h.router.transitionOpportunity(
        { userId: OWNER, id, to, note: 'walk' },
        h.ctx,
      );
      expect(r.success).toBe(true);
    }
    // A Mission is still impossible before human approval.
    const early = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(early.success).toBe(false);

    // HUMAN APPROVAL via the Brain authority
    const req = await h.router.requestOpportunityApproval(
      { userId: OWNER, opportunityId: id },
      h.ctx,
    );
    const taskId = (req.data as { taskId: string }).taskId;
    // Self-asserted approval is impossible — only a task id is accepted.
    const forged = await h.router.transitionOpportunity(
      { userId: OWNER, id, to: 'APPROVED', note: 'forged' } as never,
      h.ctx,
    );
    expect(forged.success).toBe(false);
    const approved = await h.router.transitionOpportunity(
      { userId: OWNER, id, to: 'APPROVED', note: 'human approved', approvalTaskId: taskId },
      h.ctx,
    );
    expect(approved.success).toBe(true);

    // MISSION + LINK
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(true);
    const missionId = (started.data as { missionId: string }).missionId;
    expect(h.launched).toHaveLength(1);
    expect(h.plane.getMissionForOpportunity(OWNER, id)?.missionId).toBe(missionId);
    expect(h.plane.getOpportunityForMission(OWNER, missionId)?.opportunityId).toBe(id);
  });
});

describe('S5.1 — World approval security audit', () => {
  it('15/16. World surfaces take no approval object and cannot grant APPROVED', () => {
    // Static contract assertion: the World schemas expose no approval field,
    // so no caller can satisfy a commitment guard through the World router.
    const fs = require('fs') as typeof import('fs');
    const src = fs.readFileSync(require.resolve('../routers/WorldRouter.ts'), 'utf8');
    const evaluate = src.slice(src.indexOf('evaluateOpportunity: z.object('));
    const block = evaluate.slice(0, evaluate.indexOf('}),'));
    expect(block).not.toMatch(/approval\s*:/i);
    const pipeline = src.slice(src.indexOf('pipeline: z.object('));
    const pblock = pipeline.slice(0, pipeline.indexOf('}),'));
    expect(pblock).not.toMatch(/approval/i);
    // The World router never calls the control-plane transition at all.
    expect(src).not.toMatch(/transitionOpportunity/);
    expect(src).not.toMatch(/linkOpportunityToMission/);
  });
});
