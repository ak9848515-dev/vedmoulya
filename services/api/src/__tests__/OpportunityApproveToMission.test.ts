// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — REVENUE-001 · APPROVED opportunity → Mission launch
//
// Proves the closed first-revenue boundary end to end over the REAL control
// plane, the REAL Brain approval authority and the REAL guarded launch seam.
// Only the Mission *engine* is stubbed at the injected port boundary — exactly
// the boundary the architecture constrains.
//
//   • an APPROVED opportunity starts EXACTLY ONE Mission
//   • a repeated call returns the existing linkage (no second launch)
//   • a cross-user launch is refused (owner isolation)
//   • a non-APPROVED opportunity is refused (approval still required)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
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
    clock: { now: () => new Date(NOW).toISOString() },
    budget: { maxTokens: 10_000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 1000 },
    opportunities: new InMemoryOpportunityStore(),
  });
}

const POSTING = {
  source: 'manual-import',
  sourceReference: 'https://board.example/jobs/revenue-1',
  title: 'Build a TypeScript SDK',
  description: 'Client needs a typed SDK for their public API.',
  requirements: ['typescript', 'api design'],
};

function harness() {
  const brain = createBrain();
  const stores = new InMemoryControlStores();
  const plane = new ActiveIntelligenceControlPlane({
    brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
    proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
    fabric: {} as never,
    stores,
    now: () => NOW,
  });
  const launched: Array<{ userId: string; title: string }> = [];
  let n = 0;
  const mission = createMissionLaunchPort({
    createAndRun: async (userId, input) => {
      launched.push({ userId, title: input.title });
      return { missionId: `mission-${++n}` };
    },
  });
  const router = createControlRouter(plane, {
    approval: createOpportunityApprovalPort(brain),
    qualify: createOpportunityQualifier({ brain, now: () => NOW }).qualify,
    mission,
  });
  return {
    router,
    launched,
    ctx: { userId: OWNER } as never,
    otherCtx: { userId: OTHER } as never,
  };
}

/** Import + walk the lifecycle to a chosen state, using only real transitions. */
async function walk(
  h: ReturnType<typeof harness>,
  ctx: never,
  upTo: 'PRESENTED' | 'APPROVED',
): Promise<string> {
  const imported = await h.router.importOpportunity(
    { userId: OWNER, opportunity: { ...POSTING } },
    ctx,
  );
  if (!imported.success) throw new Error('import failed');
  const id = (imported.data as OpportunityLifecycleRecord).id;
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

describe('REVENUE-001 — APPROVED opportunity → Mission', () => {
  it('starts EXACTLY ONE Mission for an APPROVED opportunity', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');

    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(true);
    expect((started.data as { missionId: string }).missionId).toBe('mission-1');
    expect((started.data as { created: boolean }).created).toBe(true);
    expect(h.launched).toHaveLength(1);
  });

  it('a repeated call returns the existing linkage — never a second launch', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');

    await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    const second = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);

    expect(second.success).toBe(true);
    expect((second.data as { missionId: string }).missionId).toBe('mission-1');
    expect((second.data as { created: boolean }).created).toBe(false);
    // The engine was reached once and only once.
    expect(h.launched).toHaveLength(1);
  });

  it('refuses a cross-user launch (owner isolation)', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'APPROVED');

    const stolen = await h.router.startMissionForOpportunity({ id, userId: OTHER }, h.otherCtx);
    expect(stolen.success).toBe(false);
    expect(h.launched).toHaveLength(0);
  });

  it('refuses a non-APPROVED opportunity (approval still required)', async () => {
    const h = harness();
    const id = await walk(h, h.ctx, 'PRESENTED');

    const early = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(early.success).toBe(false);
    expect(
      (early as { error?: { details?: { opportunityCode?: string } } }).error?.details
        ?.opportunityCode,
    ).toBe('APPROVAL_REQUIRED');
    expect(h.launched).toHaveLength(0);
  });
});
