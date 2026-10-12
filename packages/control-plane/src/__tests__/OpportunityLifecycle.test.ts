import { describe, expect, it } from 'vitest';
import { OpportunityLifecycle, type OpportunityStore } from '../domain/OpportunityLifecycle.js';
import type { OpportunityLifecycleRecord } from '../types/control-types.js';

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

const base = {
  title: 'YouTube automation service',
  description: 'Repetitive video production workflow for local businesses',
  category: 'automation-service',
  evidence: [{ label: 'User repeated this workflow 6 times', status: 'VERIFIED' as const }],
  riskLevel: 'MEDIUM' as const,
  automationPotential: 'HIGH' as const,
};

describe('OpportunityLifecycle (SPRINT-031)', () => {
  it('discovers idempotently — the same title maps to ONE record (duplicate suppression)', () => {
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const first = lc.discover({ ownerId: 'u1', ...base });
    const second = lc.discover({ ownerId: 'u1', ...base });
    expect(second.id).toBe(first.id);
    expect(lc.list('u1').length).toBe(1);
  });

  it('walks the legal lifecycle with approval + execution evidence from EXISTING authorities', () => {
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const opp = lc.discover({ ownerId: 'u1', ...base });

    const assessed = lc.transition({ ownerId: 'u1', id: opp.id, to: 'ASSESSED', note: 'scored' });
    expect(assessed.success).toBe(true);
    const shortlisted = lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'SHORTLISTED',
      note: 'top 3',
    });
    expect(shortlisted.success).toBe(true);
    const presented = lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'PRESENTED',
      note: 'shown to user',
    });
    expect(presented.success).toBe(true);
    const approved = lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'APPROVED',
      note: 'user approved',
      approval: {
        id: 'approval-1',
        grantedBy: 'alice',
        grantedAt: '2026-08-14T09:00:00Z',
        scope: 'opportunity',
      },
    });
    expect(approved.success).toBe(true);
    const planned = lc.transition({ ownerId: 'u1', id: opp.id, to: 'PLANNED', note: 'mvp plan' });
    expect(planned.success).toBe(true);
    const executed = lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'EXECUTED',
      note: 'executed via the existing execution authority',
      execution: { id: 'exec-1', completedAt: '2026-08-14T10:00:00Z', verified: true },
    });
    expect(executed.success).toBe(true);
    const verified = lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'VERIFIED',
      note: 'artifact verified',
    });
    expect(verified.success).toBe(true);
    const completed = lc.transition({ ownerId: 'u1', id: opp.id, to: 'COMPLETED', note: 'done' });
    expect(completed.success).toBe(true);

    const record = store.get('u1', opp.id)!;
    expect(record.status).toBe('COMPLETED');
    expect(record.transitions.length).toBe(8);
  });

  it('REFUSES APPROVED without an approval record from the EXISTING authority', () => {
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const opp = lc.discover({ ownerId: 'u1', ...base });
    // Walk the legal path to PRESENTED first (no jumps).
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'ASSESSED', note: 'scored' });
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'SHORTLISTED', note: 'shortlist' });
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'PRESENTED', note: 'shown' });
    const result = lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'APPROVED',
      note: 'attempt without record',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('APPROVAL_REQUIRED');
    expect(store.get('u1', opp.id)!.status).toBe('PRESENTED');
  });

  it('REFUSES EXECUTED without execution evidence — the lifecycle never executes', () => {
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const opp = lc.discover({ ownerId: 'u1', ...base });
    // Walk the legal path to PLANNED (with the existing approval record).
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'ASSESSED', note: 'scored' });
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'SHORTLISTED', note: 'shortlist' });
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'PRESENTED', note: 'shown' });
    lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'APPROVED',
      note: 'approved',
      approval: { id: 'a1', grantedBy: 'alice', grantedAt: '2026-08-14T09:00:00Z', scope: 'opp' },
    });
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'PLANNED', note: 'planned' });
    const result = lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'EXECUTED',
      note: 'attempt without execution evidence',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('EXECUTION_REQUIRED');
    expect(store.get('u1', opp.id)!.status).toBe('PLANNED');
  });

  it('REFUSES illegal jumps (DISCOVERED → VERIFIED) and terminal re-entry', () => {
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const opp = lc.discover({ ownerId: 'u1', ...base });
    const jump = lc.transition({ ownerId: 'u1', id: opp.id, to: 'VERIFIED', note: 'jump' });
    expect(jump.success).toBe(false);
    if (!jump.success) expect(jump.code).toBe('ILLEGAL_TRANSITION');

    const rejected = lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'REJECTED',
      note: 'not viable',
    });
    expect(rejected.success).toBe(true);
    const reOpen = lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'ASSESSED',
      note: 're-open attempt',
    });
    expect(reOpen.success).toBe(false);
    if (!reOpen.success) expect(reOpen.code).toBe('ILLEGAL_TRANSITION');
  });

  it('is owner-scoped — another owner cannot transition your opportunity', () => {
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const opp = lc.discover({ ownerId: 'u1', ...base });
    const stolen = lc.transition({ ownerId: 'u2', id: opp.id, to: 'ASSESSED', note: 'hijack' });
    expect(stolen.success).toBe(false);
    if (!stolen.success) expect(stolen.code).toBe('NOT_FOUND');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT-031 — remaining lifecycle branches: idempotent same-status transition,
// VERIFIED-only-after-EXECUTED guard, and the externally-sourced dedup key.
// ─────────────────────────────────────────────────────────────────────────────

describe('OpportunityLifecycle — boundary and dedup branches', () => {
  it('a transition to the CURRENT status is a no-op success (idempotent)', () => {
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const opp = lc.discover({ ownerId: 'u1', ...base });
    const same = lc.transition({ ownerId: 'u1', id: opp.id, to: 'DISCOVERED', note: 'no-op' });
    expect(same.success).toBe(true);
    if (same.success) expect(same.record.status).toBe('DISCOVERED');
    // No extra transition recorded.
    expect(store.get('u1', opp.id)!.transitions.length).toBe(0);
  });

  it('REFUSES VERIFIED unless the record is already EXECUTED', () => {
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const opp = lc.discover({ ownerId: 'u1', ...base });
    // Walk to EXECUTED is required; first prove the guard fires from DISCOVERED.
    const illegal = lc.transition({ ownerId: 'u1', id: opp.id, to: 'VERIFIED', note: 'jump' });
    expect(illegal.success).toBe(false);
    if (!illegal.success) expect(illegal.code).toBe('ILLEGAL_TRANSITION');
  });

  it('REFUSES VERIFIED from a state whose legal set excludes it (EXECUTED-gated)', () => {
    // A direct check of the explicit `VERIFIED only after EXECUTED` guard: reach
    // a state where OPPORTUNITY_TRANSITIONS includes VERIFIED in no other way.
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const opp = lc.discover({ ownerId: 'u1', ...base });
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'ASSESSED', note: 'a' });
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'SHORTLISTED', note: 's' });
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'PRESENTED', note: 'p' });
    lc.transition({
      ownerId: 'u1',
      id: opp.id,
      to: 'APPROVED',
      note: 'ok',
      approval: { id: 'a1', grantedBy: 'alice', grantedAt: '2026-08-14T09:00:00Z', scope: 'opp' },
    });
    lc.transition({ ownerId: 'u1', id: opp.id, to: 'REJECTED', note: 'drop' });
    const reopened = lc.transition({ ownerId: 'u1', id: opp.id, to: 'VERIFIED', note: 'nope' });
    expect(reopened.success).toBe(false);
  });

  it('externally-sourced opportunities dedup by (source, sourceReference), not title', () => {
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const ref = { source: 'RSS-Feed', sourceReference: 'https://example.com/job/42' };
    const first = lc.discover({ ownerId: 'u1', ...base, sourceRef: ref });
    // Same source ref but a DIFFERENT title → still ONE record.
    const second = lc.discover({
      ownerId: 'u1',
      ...base,
      title: 'A different title for the same posting',
      sourceRef: ref,
    });
    expect(second.id).toBe(first.id);
    expect(lc.list('u1').length).toBe(1);
    // A different sourceReference → a distinct record.
    const other = lc.discover({
      ownerId: 'u1',
      ...base,
      sourceRef: { source: 'rss-feed', sourceReference: 'https://example.com/job/43' },
    });
    expect(other.id).not.toBe(first.id);
    expect(lc.list('u1').length).toBe(2);
  });

  it('discoverWithResult reports created/existing and clamps confidence + caps arrays', () => {
    const store = createStore();
    const lc = new OpportunityLifecycle(store);
    const created = lc.discoverWithResult({
      ownerId: 'u1',
      ...base,
      confidence: 5, // clamped to 1
      requiredCapabilities: Array.from({ length: 25 }, (_, i) => `cap-${i}`),
      evidence: Array.from({ length: 12 }, (_, i) => ({
        label: `e${i}`,
        status: 'UNKNOWN' as const,
      })),
    });
    expect(created.created).toBe(true);
    expect(created.record.confidence).toBe(1);
    expect(created.record.requiredCapabilities).toHaveLength(20);
    expect(created.record.evidence).toHaveLength(8);
    const existing = lc.discoverWithResult({ ownerId: 'u1', ...base });
    expect(existing.created).toBe(false);
    expect(existing.record.id).toBe(created.record.id);
  });
});
