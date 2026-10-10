// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S7.2 · APPROVED opportunity → DERIVED Mission objective
//
// Proves the exact boundary S7.2 closes: an APPROVED opportunity starts exactly
// one Mission whose bounded objective ACTUALLY describes the client opportunity
// (title, description, stated required capabilities, provenance and evidence),
// while missing information is represented HONESTLY rather than invented.
//
// The Mission engine is stubbed at the injected port boundary — the exact
// boundary the architecture constrains. Everything else (control plane, the
// canonical assessor, the Brain approval authority, the guarded launch claim)
// is real.
//
//   • a non-APPROVED opportunity cannot start a Mission
//   • the derived objective preserves title/description/capabilities/provenance
//   • missing data is stated honestly (never invented)
//   • the derivation is bounded (no unbounded "do whatever it takes")
//   • an already-linked opportunity returns the existing Mission
//   • concurrent starts create exactly ONE Mission
//   • Mission creation failure / provider failure are HONEST
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ActiveIntelligenceControlPlane, InMemoryControlStores } from '@vedmoulya/control-plane';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import { createControlRouter } from '../routers/ControlRouter.js';
import { createOpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import {
  createMissionLaunchPort,
  deriveOpportunityMissionObjective,
} from '../infrastructure/OpportunityMissionPorts.js';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';
import { BrainApplicationService } from '@vedmoulya/brain';
import {
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
} from '@vedmoulya/brain';

const OWNER = 'owner-1';
const OTHER = 'owner-2';
const NOW = '2026-10-07T00:00:00.000Z';

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

const POSTING = {
  source: 'manual-import',
  sourceReference: 'https://board.example/jobs/s72-1',
  title: 'Build a TypeScript SDK',
  description: 'Client needs a typed SDK for their public API.',
  requirements: ['typescript', 'api design'],
};

interface LaunchedMission {
  userId: string;
  title: string;
  objective?: string;
  initialObjectives?: string[];
}

function harness(): {
  router: ReturnType<typeof createControlRouter>;
  plane: ActiveIntelligenceControlPlane;
  stores: InMemoryControlStores;
  launched: LaunchedMission[];
  ctx: never;
  otherCtx: never;
} {
  const brain = createBrain();
  const stores = new InMemoryControlStores();
  const plane = new ActiveIntelligenceControlPlane({
    brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
    proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
    fabric: {} as never,
    stores,
    now: () => NOW,
  });
  const launched: LaunchedMission[] = [];
  const mission = createMissionLaunchPort({
    createAndRun: async (userId, input) => {
      launched.push({
        userId,
        title: input.title,
        ...(input.objective !== undefined ? { objective: input.objective } : {}),
        ...(input.initialObjectives !== undefined
          ? { initialObjectives: input.initialObjectives }
          : {}),
      });
      return { missionId: `mission-${launched.length}` };
    },
  });
  const router = createControlRouter(plane, {
    approval: createOpportunityApprovalPort(brain),
    qualify: createOpportunityQualifier({ brain, now: () => NOW }).qualify,
    mission,
  });
  return {
    router,
    plane,
    stores,
    launched,
    ctx: { userId: OWNER } as never,
    otherCtx: { userId: OTHER } as never,
  };
}

/** Import + walk the lifecycle to a chosen state, using only real transitions. */
async function walk(
  h: ReturnType<typeof harness>,
  ctx: never,
  upTo: 'DISCOVERED' | 'PRESENTED' | 'APPROVED',
): Promise<string> {
  const imported = await h.router.importOpportunity(
    { userId: OWNER, opportunity: { ...POSTING } },
    ctx,
  );
  if (!imported.success) throw new Error('import failed');
  const id = (imported.data as OpportunityLifecycleRecord).id;
  if (upTo === 'DISCOVERED') return id;
  for (const to of ['ASSESSED', 'SHORTLISTED', 'PRESENTED'] as const) {
    const r = await h.router.transitionOpportunity({ userId: OWNER, id, to, note: 'walk' }, ctx);
    if (!r.success) throw new Error(`transition ${to} failed`);
  }
  if (upTo === 'PRESENTED') return id;
  const req = await h.router.requestOpportunityApproval({ userId: OWNER, opportunityId: id }, ctx);
  if (!req.success) throw new Error('approval request failed');
  const taskId = (req.data as { taskId: string }).taskId;
  const approved = await h.router.transitionOpportunity(
    { userId: OWNER, id, to: 'APPROVED', note: 'human approved', approvalTaskId: taskId },
    ctx,
  );
  if (!approved.success) throw new Error('approval failed');
  return id;
}

// ── pure derivation ─────────────────────────────────────────────────────────

describe('S7.2 — deriveOpportunityMissionObjective', () => {
  it('preserves title, description, capabilities and provenance', () => {
    const { objective, initialObjectives } = deriveOpportunityMissionObjective({
      title: 'Build a TypeScript SDK',
      description: 'Client needs a typed SDK for their public API.',
      requiredCapabilities: ['typescript', 'api design'],
      sourceRef: { source: 'manual-import', sourceReference: 'https://board.example/1' },
      evidence: [{ label: 'Client verified', status: 'VERIFIED' }],
      qualificationScore: 0.62,
      approvalScope: 'opportunity:s72-1',
    });
    expect(objective).toContain('Build a TypeScript SDK');
    expect(objective).toContain('Client needs a typed SDK for their public API.');
    expect(objective).toContain('typescript, api design');
    expect(objective).toContain('manual-import (https://board.example/1)');
    expect(objective).toContain('Client verified (VERIFIED)');
    expect(objective).toContain('0.62');
    expect(objective).toContain('opportunity:s72-1');
    expect(initialObjectives).toEqual([
      'Satisfy the stated capability requirement: typescript',
      'Satisfy the stated capability requirement: api design',
    ]);
  });

  it('represents MISSING information honestly — never invents requirements', () => {
    const { objective, initialObjectives } = deriveOpportunityMissionObjective({
      title: 'Unknown-scope task',
    });
    expect(objective).toContain('No description was provided by the opportunity source.');
    expect(objective).toContain('No required capabilities were stated by the opportunity source.');
    expect(objective).toContain('No external source/provenance was recorded');
    // No fabricated capability checklist when none was stated.
    expect(initialObjectives).toEqual([]);
  });

  it('is BOUNDED and verifiable — no unbounded instruction', () => {
    const { objective } = deriveOpportunityMissionObjective({ title: 'T' });
    expect(objective).toContain('Deliverable:');
    expect(objective).toContain('Verification:');
    expect(objective).toContain('NOT to be invented');
    expect(objective).toContain('Human verification and external submission remain HUMAN actions');
    expect(objective).not.toMatch(/however necessary|do whatever|by any means/i);
  });
});

// ── router boundary ─────────────────────────────────────────────────────────

describe('S7.2 — APPROVED opportunity → derived Mission', () => {
  it('1. a RECOMMENDED (non-APPROVED) opportunity cannot start a Mission', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'PRESENTED');
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(false);
    if (started.success) return;
    expect(started.error.details?.opportunityCode).toBe('APPROVAL_REQUIRED');
    expect(h.launched).toHaveLength(0);
  });

  it('2. an APPROVED opportunity can start a Mission', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(true);
    expect(h.launched).toHaveLength(1);
  });

  it('3. the Mission is owner-scoped (other owner refused)', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');
    const stolen = await h.router.startMissionForOpportunity({ id, userId: OTHER }, h.otherCtx);
    expect(stolen.success).toBe(false);
    expect(h.launched).toHaveLength(0);
  });

  it('4. the Mission objective derives title/description/capabilities correctly', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');
    await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(h.launched).toHaveLength(1);
    const objective = h.launched[0]?.objective ?? '';
    expect(h.launched[0]?.title).toBe(POSTING.title);
    expect(objective).toContain(POSTING.title);
    expect(objective).toContain(POSTING.description);
    expect(objective).toContain('typescript, api design');
    expect(h.launched[0]?.initialObjectives).toEqual([
      'Satisfy the stated capability requirement: typescript',
      'Satisfy the stated capability requirement: api design',
    ]);
  });

  it('5. provenance is preserved in the derived objective', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');
    await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    const objective = h.launched[0]?.objective ?? '';
    expect(objective).toContain('manual-import');
    expect(objective).toContain(POSTING.sourceReference);
  });

  it('6. required capabilities are preserved (and omitted honestly when absent)', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');
    await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(h.launched[0]?.objective).toContain('typescript, api design');

    // A second opportunity with NO stated requirements derives honestly.
    const h2 = harness();
    const imported = await h2.router.importOpportunity(
      {
        userId: OWNER,
        opportunity: {
          source: 'manual-import',
          sourceReference: 'https://board.example/jobs/no-reqs',
          title: 'No stated requirements',
          description: 'A client request whose capabilities were not stated by the source.',
        },
      },
      h2.ctx,
    );
    expect(imported.success).toBe(true);
    const id2 = (imported.data as OpportunityLifecycleRecord).id;
    for (const to of ['ASSESSED', 'SHORTLISTED', 'PRESENTED'] as const) {
      await h2.router.transitionOpportunity({ userId: OWNER, id: id2, to, note: 'walk' }, h2.ctx);
    }
    const req = await h2.router.requestOpportunityApproval(
      { userId: OWNER, opportunityId: id2 },
      h2.ctx,
    );
    const taskId = (req.data as { taskId: string }).taskId;
    await h2.router.transitionOpportunity(
      { userId: OWNER, id: id2, to: 'APPROVED', note: 'ok', approvalTaskId: taskId },
      h2.ctx,
    );
    await h2.router.startMissionForOpportunity({ id: id2, userId: OWNER }, h2.ctx);
    const objective2 = h2.launched[0]?.objective ?? '';
    expect(objective2).toContain('No required capabilities were stated by the opportunity source.');
    // No fabricated capability checklist when none was stated.
    expect(h2.launched[0]?.initialObjectives).toBeUndefined();
  });

  it('7. duplicate start is idempotent — no second Mission', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');
    const first = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    const second = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect((second.data as { alreadyLinked: boolean }).alreadyLinked).toBe(true);
    expect(h.launched).toHaveLength(1);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(1);
  });

  it('8. concurrent start creates ONLY one Mission', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');
    const [a, b] = await Promise.all([
      h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx),
      h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx),
    ]);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect((a.data as { missionId: string }).missionId).toBe(
      (b.data as { missionId: string }).missionId,
    );
    expect(h.launched).toHaveLength(1);
    expect(h.plane.listOpportunityMissionLinks(OWNER)).toHaveLength(1);
  });

  it('9. failed Mission creation is HONEST (no association, explicit code)', async () => {
    const brain = createBrain();
    const plane = new ActiveIntelligenceControlPlane({
      brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
      proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
      fabric: {} as never,
      stores: new InMemoryControlStores(),
      now: () => NOW,
    });
    const router = createControlRouter(plane, {
      approval: createOpportunityApprovalPort(brain),
      qualify: createOpportunityQualifier({ brain, now: () => NOW }).qualify,
      mission: createMissionLaunchPort({
        createAndRun: async () => ({ error: 'provider unavailable' }),
      }),
    });
    const ctx = { userId: OWNER } as never;
    const imported = await router.importOpportunity(
      { userId: OWNER, opportunity: { ...POSTING } },
      ctx,
    );
    const id = (imported.data as OpportunityLifecycleRecord).id;
    for (const to of ['ASSESSED', 'SHORTLISTED', 'PRESENTED'] as const) {
      await router.transitionOpportunity({ userId: OWNER, id, to, note: 'walk' }, ctx);
    }
    const req = await router.requestOpportunityApproval({ userId: OWNER, opportunityId: id }, ctx);
    const taskId = (req.data as { taskId: string }).taskId;
    await router.transitionOpportunity(
      { userId: OWNER, id, to: 'APPROVED', note: 'ok', approvalTaskId: taskId },
      ctx,
    );
    const started = await router.startMissionForOpportunity({ id, userId: OWNER }, ctx);
    expect(started.success).toBe(false);
    if (started.success) return;
    expect(started.error.details?.opportunityCode).toBe('MISSION_CREATION_FAILED');
    expect(started.error.message).toContain('provider unavailable');
    // No association was persisted for a Mission that does not exist.
    expect(plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
  });

  it('10. a provider-unavailable (thrown) failure is HONEST', async () => {
    const brain = createBrain();
    const plane = new ActiveIntelligenceControlPlane({
      brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
      proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
      fabric: {} as never,
      stores: new InMemoryControlStores(),
      now: () => NOW,
    });
    const router = createControlRouter(plane, {
      approval: createOpportunityApprovalPort(brain),
      qualify: createOpportunityQualifier({ brain, now: () => NOW }).qualify,
      mission: createMissionLaunchPort({
        createAndRun: async () => {
          throw new Error('no provider is currently available');
        },
      }),
    });
    const ctx = { userId: OWNER } as never;
    const imported = await router.importOpportunity(
      { userId: OWNER, opportunity: { ...POSTING } },
      ctx,
    );
    const id = (imported.data as OpportunityLifecycleRecord).id;
    for (const to of ['ASSESSED', 'SHORTLISTED', 'PRESENTED'] as const) {
      await router.transitionOpportunity({ userId: OWNER, id, to, note: 'walk' }, ctx);
    }
    const req = await router.requestOpportunityApproval({ userId: OWNER, opportunityId: id }, ctx);
    const taskId = (req.data as { taskId: string }).taskId;
    await router.transitionOpportunity(
      { userId: OWNER, id, to: 'APPROVED', note: 'ok', approvalTaskId: taskId },
      ctx,
    );
    const started = await router.startMissionForOpportunity({ id, userId: OWNER }, ctx);
    expect(started.success).toBe(false);
    if (started.success) return;
    expect(started.error.details?.opportunityCode).toBe('MISSION_CREATION_FAILED');
    expect(started.error.message).toContain('no provider is currently available');
    expect(plane.listOpportunityMissionLinks(OWNER)).toHaveLength(0);
  });

  it('11. an already-linked opportunity returns the existing Mission', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');
    const first = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    const missionId = (first.data as { missionId: string }).missionId;
    const second = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(second.success).toBe(true);
    const data = second.data as { missionId: string; created: boolean; alreadyLinked: boolean };
    expect(data.missionId).toBe(missionId);
    expect(data.created).toBe(false);
    expect(data.alreadyLinked).toBe(true);
  });

  it('12. missing required opportunity data is handled BOUNDED (no invention)', async () => {
    // An opportunity whose source stated a title + description but NO required
    // capabilities still produces a bounded, honest objective and no fabricated
    // capability checklist.
    const h = harness();
    const imported = await h.router.importOpportunity(
      {
        userId: OWNER,
        opportunity: {
          source: 'manual-import',
          sourceReference: 'https://board.example/jobs/sparse',
          title: 'Sparse opportunity',
          description: 'A real request whose requirements were not itemized by the source.',
        },
      },
      h.ctx,
    );
    const id = (imported.data as OpportunityLifecycleRecord).id;
    for (const to of ['ASSESSED', 'SHORTLISTED', 'PRESENTED'] as const) {
      await h.router.transitionOpportunity({ userId: OWNER, id, to, note: 'walk' }, h.ctx);
    }
    const req = await h.router.requestOpportunityApproval(
      { userId: OWNER, opportunityId: id },
      h.ctx,
    );
    const taskId = (req.data as { taskId: string }).taskId;
    await h.router.transitionOpportunity(
      { userId: OWNER, id, to: 'APPROVED', note: 'ok', approvalTaskId: taskId },
      h.ctx,
    );
    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(true);
    const objective = h.launched[0]?.objective ?? '';
    expect(objective).toContain('Sparse opportunity');
    expect(objective).toContain('No required capabilities were stated by the opportunity source.');
    expect(objective).toContain('Deliverable:');
    expect(objective).toContain('Verification:');
    // No fabricated capability checklist when none was stated.
    expect(h.launched[0]?.initialObjectives).toBeUndefined();
  });
});
