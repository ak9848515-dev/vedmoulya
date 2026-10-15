// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S11 · Approval binding at the S7.2 opportunity → Mission gate
//
// Governance invariants 3 and 4: a high-risk / externally consequential action
// needs the existing approval gate, and that approval must be scoped to the
// intended action — it may not be reused for a materially different one, nor
// for another user.
//
// These tests drive the REAL ControlRouter launch gate over the REAL control
// plane, the REAL Brain approval authority and the REAL launch port. The only
// stub is the Mission engine at the injected port boundary (same harness the
// REVENUE-001 suite uses). Records are poisoned through the store the gate
// actually reads, so the probe exercises the gate's read path rather than an
// in-process shortcut.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ActiveIntelligenceControlPlane, InMemoryControlStores } from '@vedmoulya/control-plane';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import {
  BrainApplicationService,
  InMemoryBrainDecisionStore,
  InMemoryBrainTaskStore,
  InMemoryOpportunityStore,
} from '@vedmoulya/brain';
import { createControlRouter } from '../routers/ControlRouter.js';
import { createOpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { createMissionLaunchPort } from '../infrastructure/OpportunityMissionPorts.js';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';

const OWNER = 's11-owner';
const OTHER = 's11-other';
const NOW = '2026-10-13T00:00:00.000Z';

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

function posting(variant: string): Record<string, unknown> {
  return {
    source: 'manual-import',
    sourceReference: `https://board.example/jobs/s11-revenue-${variant}`,
    title: `Build a TypeScript SDK (${variant})`,
    description: 'Client needs a typed SDK for their public API.',
    requirements: ['typescript', 'api design'],
  };
}

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
  const mission = createMissionLaunchPort({
    createAndRun: async (userId, input) => {
      launched.push({ userId, title: input.title });
      return { missionId: input.missionId ?? `mission-${launched.length}` };
    },
  });
  const router = createControlRouter(plane, {
    approval: createOpportunityApprovalPort(brain),
    qualify: createOpportunityQualifier({ brain, now: () => NOW }).qualify,
    mission,
  });
  return {
    router,
    stores,
    launched,
    ctx: { userId: OWNER } as never,
    otherCtx: { userId: OTHER } as never,
  };
}

/** Import + walk the lifecycle to a chosen state, using only real transitions. */
async function walk(
  h: ReturnType<typeof harness>,
  upTo: 'PRESENTED' | 'APPROVED',
  variant = 'a',
  userId = OWNER,
): Promise<string> {
  const imported = await h.router.importOpportunity(
    { userId, opportunity: posting(variant) as never },
    { userId } as never,
  );
  if (!imported.success) throw new Error('import failed');
  const id = (imported.data as OpportunityLifecycleRecord).id;
  for (const to of ['ASSESSED', 'SHORTLISTED', 'PRESENTED'] as const) {
    const r = await h.router.transitionOpportunity({ userId, id, to, note: 'walk' }, {
      userId,
    } as never);
    if (!r.success) throw new Error(`transition ${to} failed`);
  }
  if (upTo === 'PRESENTED') return id;
  const req = await h.router.requestOpportunityApproval({ userId, opportunityId: id }, {
    userId,
  } as never);
  if (!req.success) throw new Error('approval request failed');
  const taskId = (req.data as { taskId: string }).taskId;
  const approved = await h.router.transitionOpportunity(
    { userId, id, to: 'APPROVED', note: 'human approved', approvalTaskId: taskId },
    { userId } as never,
  );
  if (!approved.success) throw new Error('approval failed');
  return id;
}

/** Replace the stored record the gate reads (failure injection at the store). */
function poison(
  h: ReturnType<typeof harness>,
  ownerId: string,
  id: string,
  mutate: (record: OpportunityLifecycleRecord) => OpportunityLifecycleRecord,
): void {
  const record = h.stores.opportunities.get(ownerId, id);
  if (record === undefined) throw new Error('record not found for poisoning');
  h.stores.opportunities.save(mutate(record));
}

describe('S11 · the launch gate binds a persisted approval to its own action', () => {
  it('CONTROL: an approval really granted for this opportunity launches', async () => {
    const h = harness();
    const id = await walk(h, 'APPROVED');

    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(true);
    expect(h.launched).toHaveLength(1);
  });

  it('refuses an approval whose scope names a DIFFERENT opportunity', async () => {
    const h = harness();
    const approvedId = await walk(h, 'APPROVED', 'approved');
    const otherId = await walk(h, 'PRESENTED', 'other');
    expect(otherId).not.toBe(approvedId); // two genuinely distinct opportunities

    // Same record, same APPOVED status, same granter — only the SCOPE now names
    // another opportunity. An approval is scoped to the action it was granted
    // for; a record naming a different action must not launch this one.
    poison(h, OWNER, approvedId, (record) => ({
      ...record,
      approval: {
        id: 'forged-task',
        grantedBy: OWNER,
        grantedAt: NOW,
        scope: `accept_work:${otherId}`,
      },
    }));

    const started = await h.router.startMissionForOpportunity(
      { id: approvedId, userId: OWNER },
      h.ctx,
    );
    expect(started.success).toBe(false);
    expect(h.launched).toHaveLength(0);
  });

  it('CONTROL: the poisoned records really are distinct and APPROVED', async () => {
    const h = harness();
    const approvedId = await walk(h, 'APPROVED', 'control');
    const stored = h.stores.opportunities.get(OWNER, approvedId);
    expect(stored?.status).toBe('APPROVED');
    expect(stored?.approval?.scope).toBe(`accept_work:${approvedId}`);
    expect(stored?.approval?.grantedBy).toBe(OWNER);
    expect(h.stores.opportunities.list(OWNER)).toHaveLength(1);
  });

  it('refuses an approval granted by ANOTHER owner', async () => {
    const h = harness();
    const id = await walk(h, 'APPROVED');

    poison(h, OWNER, id, (record) => ({
      ...record,
      approval: {
        id: 'foreign-task',
        grantedBy: OTHER,
        grantedAt: NOW,
        scope: record.approval?.scope ?? '',
      },
    }));

    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(false);
    expect(h.launched).toHaveLength(0);
  });

  it('an approval for one opportunity never authorizes another (no reuse)', async () => {
    const h = harness();
    await walk(h, 'APPROVED', 'approved');
    const unapprovedId = await walk(h, 'PRESENTED', 'unapproved');

    const started = await h.router.startMissionForOpportunity(
      { id: unapprovedId, userId: OWNER },
      h.ctx,
    );
    expect(started.success).toBe(false);
    expect(
      (started as { error?: { details?: { opportunityCode?: string } } }).error?.details
        ?.opportunityCode,
    ).toBe('APPROVAL_REQUIRED');
    expect(h.launched).toHaveLength(0);
  });

  it('a missing approval never launches', async () => {
    const h = harness();
    const id = await walk(h, 'APPROVED');
    poison(h, OWNER, id, (record) => {
      const { approval: _removed, ...withoutApproval } = record;
      return withoutApproval as OpportunityLifecycleRecord;
    });

    const started = await h.router.startMissionForOpportunity({ id, userId: OWNER }, h.ctx);
    expect(started.success).toBe(false);
    expect(h.launched).toHaveLength(0);
  });
});
