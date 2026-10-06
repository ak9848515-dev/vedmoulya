// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S5 — Opportunity acquisition foundation tests
//
// These exercise the REAL canonical machinery: the actual OpportunityLifecycle
// domain, the actual normalizer, and the actual approval port over a real
// BrainApplicationService. No fake parallel domain infrastructure.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeEach } from 'vitest';
import {
  ActiveIntelligenceControlPlane,
  InMemoryControlStores,
  OpportunityLifecycle,
  type OpportunityStore,
} from '@vedmoulya/control-plane';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import { createControlRouter } from '../routers/ControlRouter.js';
import {
  normalizeExternalOpportunity,
  collectCandidates,
  type OpportunitySourcePort,
} from '../services/OpportunitySourceAdapter.js';
import { createOpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { BrainApplicationService } from '@vedmoulya/brain';
import { InMemoryBrainTaskStore, InMemoryBrainDecisionStore } from '@vedmoulya/brain';
import { InMemoryOpportunityStore } from '@vedmoulya/brain';

// ── Real canonical store (owner-scoped, mirrors the Postgres seam) ──────────
function createStore(): OpportunityStore {
  const map = new Map<string, OpportunityLifecycleRecord>();
  return {
    save: (r) => {
      map.set(`${r.ownerId}:${r.id}`, r);
    },
    get: (ownerId, id) => map.get(`${ownerId}:${id}`),
    getByKey: (ownerId, key) =>
      [...map.values()].find((r) => r.ownerId === ownerId && r.stableKey === key),
    list: (ownerId) => [...map.values()].filter((r) => r.ownerId === ownerId),
  };
}

/** Import through the real normalizer into the real lifecycle — the exact
 *  composition the governed router performs. */
function importOpportunity(
  lifecycle: OpportunityLifecycle,
  ownerId: string,
  raw: unknown,
):
  | { success: true; record: OpportunityLifecycleRecord; created: boolean }
  | { success: false; code: string } {
  const normalized = normalizeExternalOpportunity(raw);
  if (!normalized.success) return { success: false, code: normalized.code };
  const discovery = lifecycle.discoverWithResult({
    ownerId,
    title: normalized.data.title,
    description: normalized.data.description,
    category: normalized.data.category,
    evidence: normalized.data.evidence,
    riskLevel: normalized.data.riskLevel,
    automationPotential: normalized.data.automationPotential,
    sourceRef: normalized.data.sourceRef,
  });
  return {
    success: true,
    record: discovery.record,
    created: discovery.created,
  };
}

const POSTING = {
  source: 'rss-feed',
  sourceReference: 'https://board.example/jobs/42',
  title: 'Build a TypeScript SDK',
  description: 'Client needs a typed SDK for their public API.',
};

describe('S5 — opportunity acquisition foundation', () => {
  let store: OpportunityStore;
  let lifecycle: OpportunityLifecycle;

  beforeEach(() => {
    store = createStore();
    lifecycle = new OpportunityLifecycle(store, () => '2026-10-05T00:00:00.000Z');
  });

  // ── 1. import ──────────────────────────────────────────────────────────────
  it('imports an external posting into the canonical record at DISCOVERED', () => {
    const result = importOpportunity(lifecycle, 'user-1', POSTING);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.created).toBe(true);
    expect(result.record.ownerId).toBe('user-1');
    expect(result.record.status).toBe('DISCOVERED');
    expect(result.record.sourceRef).toEqual({
      source: 'rss-feed',
      sourceReference: 'https://board.example/jobs/42',
    });
    expect(lifecycle.list('user-1')).toHaveLength(1);
  });

  it('records the canonical id, not a new model type', () => {
    const result = importOpportunity(lifecycle, 'user-1', POSTING);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // The record IS the pre-existing control-plane contract.
    expect(result.record.stableKey).toBe('user-1:rss-feed:https://board.example/jobs/42');
    expect(result.record.transitions).toEqual([]);
  });

  // ── 2. qualification does not commit ───────────────────────────────────────
  it('import alone never commits — the record cannot skip past DISCOVERED', () => {
    const result = importOpportunity(lifecycle, 'user-1', POSTING);
    if (!result.success) throw new Error('expected success');
    // No approval, no execution evidence is attached by a source import.
    expect(result.record.approval).toBeUndefined();
    expect(result.record.execution).toBeUndefined();
    // And the lifecycle refuses to jump straight to APPROVED.
    const jumped = lifecycle.transition({
      ownerId: 'user-1',
      id: result.record.id,
      to: 'APPROVED',
      note: 'skip',
    });
    expect(jumped.success).toBe(false);
    if (jumped.success) return;
    expect(jumped.code).toBe('ILLEGAL_TRANSITION');
  });

  // ── 3. malformed external input rejected ───────────────────────────────────
  it('rejects malformed external source input', () => {
    expect(normalizeExternalOpportunity(null).success).toBe(false);
    expect(normalizeExternalOpportunity('a string').success).toBe(false);
    expect(normalizeExternalOpportunity([]).success).toBe(false);
    expect(normalizeExternalOpportunity({ ...POSTING, title: '' }).success).toBe(false);
    expect(normalizeExternalOpportunity({ ...POSTING, description: '' }).success).toBe(false);
    const noRef = normalizeExternalOpportunity({ ...POSTING, sourceReference: '' });
    expect(noRef.success).toBe(false);
    if (noRef.success) return;
    expect(noRef.code).toBe('SOURCE_REFERENCE_REQUIRED');
  });

  it('rejects a non-http source URL rather than storing junk provenance', () => {
    const bad = normalizeExternalOpportunity({ ...POSTING, url: 'javascript:alert(1)' });
    expect(bad.success).toBe(false);
    if (bad.success) return;
    expect(bad.code).toBe('MALFORMED_SOURCE_URL');
  });

  it('retains a valid URL in normalized provenance without storing the raw payload', () => {
    const result = normalizeExternalOpportunity({
      ...POSTING,
      url: 'https://board.example/jobs/42',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.url).toBe('https://board.example/jobs/42');
    expect(Object.keys(result.data)).not.toContain('raw');
  });

  // ── 4. secret-bearing input rejected ───────────────────────────────────────
  it('rejects secret-bearing external input across every text field', () => {
    const secrets: Array<[string, unknown]> = [
      ['description', { ...POSTING, description: 'Use api_key=sk-abc123def456ghi to call us' }],
      ['requirements', { ...POSTING, requirements: ['password: hunter2'] }],
      ['url', { ...POSTING, url: 'https://x.example/?token=abcdefgh12345' }],
      ['title', { ...POSTING, title: 'Cookie: session_token=deadbeefcafe' }],
      ['description', { ...POSTING, description: 'postgres://admin:s3cret@db.example:5432/app' }],
      ['description', { ...POSTING, description: 'send Authorization: Bearer abcdefgh123456' }],
    ];
    for (const [field, payload] of secrets) {
      const result = normalizeExternalOpportunity(payload);
      expect(result.success, `${field} should be rejected`).toBe(false);
      if (result.success) continue;
      expect(result.code).toBe('SECRET_REJECTED');
    }
  });

  it('does not reject an ordinary posting that merely mentions a budget', () => {
    const ok = normalizeExternalOpportunity({
      ...POSTING,
      description: 'Budget is 5000 USD for the engagement.',
    });
    expect(ok.success).toBe(true);
  });

  // ── 5. deduplication ───────────────────────────────────────────────────────
  it('is idempotent — the same source + sourceReference maps to ONE record', () => {
    const first = importOpportunity(lifecycle, 'user-1', POSTING);
    const second = importOpportunity(lifecycle, 'user-1', { ...POSTING });
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.record.id).toBe(first.record.id);
    expect(lifecycle.list('user-1')).toHaveLength(1);
  });

  it('returns the existing lifecycle record unchanged on rediscovery', () => {
    const first = importOpportunity(lifecycle, 'user-1', POSTING);
    if (!first.success) throw new Error('expected success');
    const transitioned = lifecycle.transition({
      ownerId: 'user-1',
      id: first.record.id,
      to: 'ASSESSED',
      note: 'qualification completed',
    });
    expect(transitioned.success).toBe(true);

    const rediscovered = importOpportunity(lifecycle, 'user-1', POSTING);
    if (!rediscovered.success) throw new Error('expected success');
    expect(rediscovered.created).toBe(false);
    expect(rediscovered.record).toEqual(transitioned.success ? transitioned.record : undefined);
    expect(rediscovered.record.status).toBe('ASSESSED');
    expect(rediscovered.record.transitions).toHaveLength(1);
  });

  it('keeps a different source + sourceReference as a separate opportunity', () => {
    const a = importOpportunity(lifecycle, 'user-1', POSTING);
    const b = importOpportunity(lifecycle, 'user-1', {
      ...POSTING,
      sourceReference: 'https://board.example/jobs/43',
    });
    expect(a.success && b.success).toBe(true);
    if (!a.success || !b.success) return;
    expect(b.record.id).not.toBe(a.record.id);
    expect(lifecycle.list('user-1')).toHaveLength(2);
  });

  it('does not collapse two identical-titled postings from different boards', () => {
    const a = importOpportunity(lifecycle, 'user-1', {
      ...POSTING,
      source: 'board-a',
      sourceReference: '1',
    });
    const b = importOpportunity(lifecycle, 'user-1', {
      ...POSTING,
      source: 'board-b',
      sourceReference: '1',
    });
    if (!a.success || !b.success) throw new Error('expected success');
    expect(b.record.id).not.toBe(a.record.id);
  });

  // ── 6. user isolation ──────────────────────────────────────────────────────
  it('isolates opportunities between users', () => {
    const a = importOpportunity(lifecycle, 'user-1', POSTING);
    const b = importOpportunity(lifecycle, 'user-2', POSTING);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(lifecycle.list('user-1')).toHaveLength(1);
    expect(lifecycle.list('user-2')).toHaveLength(1);
    expect(a.created).toBe(true);
    expect(b.success && b.created).toBe(true);
    // Same external posting, two owners, two independent records.
    expect(lifecycle.list('user-1')[0].id).not.toBe(lifecycle.list('user-2')[0].id);
  });

  it('cannot read or transition another user opportunity', () => {
    const a = importOpportunity(lifecycle, 'user-1', POSTING);
    if (!a.success) throw new Error('expected success');
    expect(lifecycle.get('user-2', a.record.id)).toBeUndefined();
    const stolen = lifecycle.transition({
      ownerId: 'user-2',
      id: a.record.id,
      to: 'REJECTED',
      note: 'not mine',
    });
    expect(stolen.success).toBe(false);
    if (stolen.success) return;
    expect(stolen.code).toBe('NOT_FOUND');
    // user-1's record is untouched.
    expect(lifecycle.get('user-1', a.record.id)?.status).toBe('DISCOVERED');
  });

  // ── 7. the canonical lifecycle still guards approval ───────────────────────
  it('refuses APPROVED without an approval record from the authority', () => {
    const a = importOpportunity(lifecycle, 'user-1', POSTING);
    if (!a.success) throw new Error('expected success');
    lifecycle.transition({ ownerId: 'user-1', id: a.record.id, to: 'ASSESSED', note: 'q' });
    lifecycle.transition({ ownerId: 'user-1', id: a.record.id, to: 'SHORTLISTED', note: 'q' });
    lifecycle.transition({ ownerId: 'user-1', id: a.record.id, to: 'PRESENTED', note: 'q' });
    const noApproval = lifecycle.transition({
      ownerId: 'user-1',
      id: a.record.id,
      to: 'APPROVED',
      note: 'self-asserted',
    });
    expect(noApproval.success).toBe(false);
    if (noApproval.success) return;
    expect(noApproval.code).toBe('APPROVAL_REQUIRED');
  });

  it('an authority-minted record DOES allow APPROVED and is stamped server-side', () => {
    const a = importOpportunity(lifecycle, 'user-1', POSTING);
    if (!a.success) throw new Error('expected success');
    for (const to of ['ASSESSED', 'SHORTLISTED', 'PRESENTED'] as const) {
      lifecycle.transition({ ownerId: 'user-1', id: a.record.id, to, note: 'q' });
    }
    const approved = lifecycle.transition({
      ownerId: 'user-1',
      id: a.record.id,
      to: 'APPROVED',
      note: 'human approved',
      approval: {
        id: 'brain-task-7',
        grantedBy: 'user-1',
        grantedAt: '2026-10-05T00:00:00.000Z',
        scope: 'opportunity.approve:x',
      },
    });
    expect(approved.success).toBe(true);
    if (!approved.success) return;
    expect(approved.record.approval?.id).toBe('brain-task-7');
    expect(approved.record.approval?.grantedBy).toBe('user-1');
  });

  // ── 8. source port answers only "what did we discover?" ────────────────────
  it('a source port returns candidates, never verdicts', async () => {
    const port: OpportunitySourcePort = {
      name: 'test-feed',
      fetchCandidates: async () => [POSTING, { ...POSTING, sourceReference: 'https://b/2' }],
    };
    const results = await collectCandidates(port);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('normalization never mutates the caller payload into a decision', () => {
    const result = normalizeExternalOpportunity(POSTING);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // The normalized form carries no status/approval/decision of any kind.
    expect(Object.keys(result.data)).not.toContain('status');
    expect(Object.keys(result.data)).not.toContain('approval');
  });
});

describe('S7.0 — acquisition response observability', () => {
  it('adds created to the canonical response without changing the record contract', async () => {
    const plane = new ActiveIntelligenceControlPlane({
      brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
      proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
      fabric: {} as never,
      stores: new InMemoryControlStores(),
      now: () => '2026-10-05T00:00:00.000Z',
    });
    const control = createControlRouter(plane);
    const ctx = { userId: 'user-1' } as never;
    const input = { userId: 'user-1', opportunity: POSTING };

    const first = await control.importOpportunity(input, ctx);
    const second = await control.importOpportunity(input, ctx);
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;

    const created = first.data as OpportunityLifecycleRecord & { created: boolean };
    const existing = second.data as OpportunityLifecycleRecord & { created: boolean };
    expect(created.created).toBe(true);
    expect(existing.created).toBe(false);
    expect(existing.id).toBe(created.id);
    expect(created).toMatchObject({
      ownerId: 'user-1',
      status: 'DISCOVERED',
      sourceRef: { source: 'rss-feed', sourceReference: POSTING.sourceReference },
      createdAt: '2026-10-05T00:00:00.000Z',
    });
    expect(plane.listOpportunities('user-1')).toHaveLength(1);
  });
});

/** A REAL Brain wired with the project's own in-memory stores. We are testing
 *  the real authority, not a stub of it. */
function createBrain(): BrainApplicationService {
  let tick = 0;
  return new BrainApplicationService({
    plan: async () => ({ steps: [], rationale: '' }),
    candidates: async () => [],
    execution: async () => ({ output: '', success: true }),
    context: { assemble: async () => 'context' },
    preference: { record: async () => {} },
    tasks: new InMemoryBrainTaskStore(),
    decisions: new InMemoryBrainDecisionStore(),
    clock: { now: () => new Date(1_700_000_000_000 + tick++ * 1000).toISOString() },
    budget: { maxTokens: 10_000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 1000 },
    opportunities: new InMemoryOpportunityStore(),
  });
}

// ── 9. the approval authority (real Brain) ──────────────────────────────────
describe('S5 — opportunity approval routes through the existing authority', () => {
  it('mints the approval record server-side and ties it to the authority task', () => {
    const approval = createOpportunityApprovalPort(createBrain());

    const requested = approval.requestApproval({ userId: 'user-1', opportunityId: 'opp-1' });
    expect(requested.success).toBe(true);
    if (!requested.success) return;

    const decision = approval.approve({
      userId: 'user-1',
      taskId: requested.data.taskId,
      opportunityId: 'opp-1',
    });
    expect(decision.success).toBe(true);
    if (!decision.success) return;
    // The record is the authority's own task id, stamped from the server.
    expect(decision.data.id).toBe(requested.data.taskId);
    expect(decision.data.grantedBy).toBe('user-1');
    expect(decision.data.scope).toBe('accept_work:opp-1');
    expect(decision.data.grantedAt.length).toBeGreaterThan(0);
  });

  it('refuses to approve a task that belongs to another user', () => {
    const approval = createOpportunityApprovalPort(createBrain());
    const requested = approval.requestApproval({ userId: 'user-1', opportunityId: 'opp-1' });
    expect(requested.success).toBe(true);
    if (!requested.success) return;

    // user-2 tries to decide user-1's approval task.
    const stolen = approval.approve({
      userId: 'user-2',
      taskId: requested.data.taskId,
      opportunityId: 'opp-1',
    });
    expect(stolen.success).toBe(false);
    if (stolen.success) return;
    expect(stolen.code).toBe('APPROVAL_REFUSED');
  });
});

// ── 10. brain inbox is no longer a second approval path ─────────────────────
describe('S5 — brain ACCEPTED is closed', () => {
  it('refuses ACCEPTED on a brain opportunity', () => {
    const result = createBrain().updateOpportunity('user-1', 'opp-1', 'ACCEPTED');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/canonical control-plane/i);
  });
});
