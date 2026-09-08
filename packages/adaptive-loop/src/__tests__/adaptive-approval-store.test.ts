// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: InMemoryAdaptiveApprovalStore tests.
//
// Explicit, recorded human approval: the model can never approve
// itself. This store keeps a request pending until an explicit
// approve()/reject() decision (acting for a human) exists, and the
// engine refuses to resume on an undecided proposal.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryAdaptiveApprovalStore } from '../infrastructure/InMemoryAdaptiveApprovalStore.js';

describe('InMemoryAdaptiveApprovalStore — explicit human approval', () => {
  it('records a pending request and reports it as pending', () => {
    const store = new InMemoryAdaptiveApprovalStore();
    store.request({
      runId: 'run-1',
      proposalId: 'p-1',
      decisionId: 'd-1',
      stepId: 'step-1',
      reason: 'Deployment needs a human',
      requestedAt: '2026-09-08T00:00:00.000Z',
    });

    const pending = store.pending('run-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].proposalId).toBe('p-1');
    expect(store.decision('run-1', 'p-1')).toBeUndefined();
  });

  it('deduplicates a repeated request for the same proposal', () => {
    const store = new InMemoryAdaptiveApprovalStore();
    const input = {
      runId: 'run-1',
      proposalId: 'p-1',
      decisionId: 'd-1',
      stepId: 'step-1',
      reason: 'needs review',
      requestedAt: '2026-09-08T00:00:00.000Z',
    };
    store.request(input);
    store.request(input);

    expect(store.pending('run-1')).toHaveLength(1);
  });

  it('approves only an existing pending proposal and records the actor', () => {
    const store = new InMemoryAdaptiveApprovalStore();
    store.request({
      runId: 'run-1',
      proposalId: 'p-1',
      decisionId: 'd-1',
      stepId: 'step-1',
      reason: 'needs review',
      requestedAt: '2026-09-08T00:00:00.000Z',
    });

    const approved = store.approve('run-1', 'p-1', 'ops@vedmoulya.local');

    expect(approved).toBe(true);
    expect(store.decision('run-1', 'p-1')).toEqual({
      decision: 'approved',
      actor: 'ops@vedmoulya.local',
    });
    expect(store.pending('run-1')).toHaveLength(0);
  });

  it('rejects only an existing pending proposal and records the actor', () => {
    const store = new InMemoryAdaptiveApprovalStore();
    store.request({
      runId: 'run-1',
      proposalId: 'p-2',
      decisionId: 'd-2',
      stepId: 'step-1',
      reason: 'needs review',
      requestedAt: '2026-09-08T00:00:00.000Z',
    });

    const rejected = store.reject('run-1', 'p-2', 'ops@vedmoulya.local');

    expect(rejected).toBe(true);
    expect(store.decision('run-1', 'p-2')).toEqual({
      decision: 'rejected',
      actor: 'ops@vedmoulya.local',
    });
    expect(store.pending('run-1')).toHaveLength(0);
  });

  it('returns false when approving/rejecting an unknown proposal (no phantom decision)', () => {
    const store = new InMemoryAdaptiveApprovalStore();
    expect(store.approve('run-1', 'ghost', 'ops')).toBe(false);
    expect(store.reject('run-1', 'ghost', 'ops')).toBe(false);
    expect(store.decision('run-1', 'ghost')).toBeUndefined();
  });

  it('returns an empty pending list for an unknown run', () => {
    const store = new InMemoryAdaptiveApprovalStore();
    expect(store.pending('never-started')).toEqual([]);
  });

  it('keeps pending requests from different runs isolated', () => {
    const store = new InMemoryAdaptiveApprovalStore();
    store.request({
      runId: 'run-a',
      proposalId: 'p-1',
      decisionId: 'd-1',
      stepId: 'step-1',
      reason: 'a',
      requestedAt: '2026-09-08T00:00:00.000Z',
    });
    store.request({
      runId: 'run-b',
      proposalId: 'p-1',
      decisionId: 'd-1',
      stepId: 'step-1',
      reason: 'b',
      requestedAt: '2026-09-08T00:00:00.000Z',
    });

    store.approve('run-a', 'p-1', 'ops');
    expect(store.pending('run-b')).toHaveLength(1);
    expect(store.decision('run-b', 'p-1')).toBeUndefined();
  });
});
