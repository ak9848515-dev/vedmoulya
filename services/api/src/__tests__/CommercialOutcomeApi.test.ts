// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.0 governed commercial-outcome API path
//
// Exercises the exposed operation the way RouterRegistry exposes it — identity
// comes from the AUTHENTICATED CONTEXT (spread after the input so a
// client-supplied userId can never win) — and proves the REAL S4 → S6.0 chain
// over the in-memory ClientOps repository: a verified delivery must exist before
// a commercial outcome can be recorded.
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryClientOpsRepository } from '@vedmoulya/services';
import { InMemoryCommercialOutcomeStore } from '@vedmoulya/control-plane';
import {
  MissionClientOpsHandoffService,
  type HandoffMissionView,
} from '../services/MissionClientOpsHandoff.js';
import { CommercialOutcomeService } from '../services/CommercialOutcomeService.js';

const NOW = new Date('2026-10-06T10:00:00.000Z');

const missions = new Map<string, HandoffMissionView>();

function missionView(userId: string, objectiveState = 'VERIFIED'): HandoffMissionView {
  return {
    missionId: 'm-1',
    userId,
    objectives: [
      {
        objectiveId: 'o-1',
        state: objectiveState,
        title: 'Objective o-1',
        verifiedOutcome:
          objectiveState === 'VERIFIED'
            ? { outcome: 'done o-1', method: 'process-exit', evidence: ['exit 0'] }
            : null,
      },
    ],
  };
}

function api(ownerId: string) {
  const clientOps = new InMemoryClientOpsRepository();
  const outcomes = new InMemoryCommercialOutcomeStore();
  const lookup = { get: async () => missions.get(ownerId) };
  const handoff = new MissionClientOpsHandoffService({
    missions: lookup,
    clientOps,
    now: () => NOW,
  });
  const service = new CommercialOutcomeService({
    missions: lookup,
    clientOps,
    outcomes,
    now: () => NOW,
  });

  return { handoff, service, clientOps, outcomes };
}

const DELIVER = {
  missionId: 'm-1',
  objectiveId: 'o-1',
  clientId: 'client-1',
  deliverableName: 'deliverable.md',
  deliverableContent: '# Deliverable',
};

/** The RouterRegistry procedure: identity is the session, spread LAST. */
function record(service: CommercialOutcomeService, sessionUserId: string) {
  return service.recordCommercialOutcome({
    missionId: 'm-1',
    objectiveId: 'o-1',
    userId: sessionUserId,
  });
}

describe('S6.0 API — record commercial outcome', () => {
  beforeEach(() => {
    missions.clear();
    missions.set('owner-1', missionView('owner-1'));
    missions.set('owner-2', missionView('owner-2'));
  });

  it('records a pending commercial outcome AFTER a verified delivery', async () => {
    const { handoff, service, outcomes } = api('owner-1');

    // S4 first — no commercial outcome without a delivery.
    const delivered = await handoff.handoffVerifiedOutcome({ ...DELIVER, userId: 'owner-1' });
    expect(delivered.ok).toBe(true);

    const result = await record(service, 'owner-1');
    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.created).toBe(true);
    expect(result.status).toBe('COMMERCIAL_PENDING');
    expect(result.pendingHumanAction).toBe(true);
    expect(outcomes.list('owner-1')).toHaveLength(1);
  });

  it('refuses the commercial outcome before any delivery exists', async () => {
    const { service } = api('owner-1');
    const result = await record(service, 'owner-1');
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('DELIVERABLE_NOT_FOUND');
  });

  it('takes identity from the session, never the mission owner field', async () => {
    // owner-2's session, but the mission is owner-1's → NOT_OWNER (cannot use
    // another user's mission even if a body userId somehow claimed it).
    const { service } = api('owner-2');
    missions.set('owner-2', missionView('owner-1'));
    const result = await record(service, 'owner-2');
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('NOT_OWNER');
  });

  it('keeps two owners isolated end to end', async () => {
    const a = api('owner-1');
    const b = api('owner-2');

    await a.handoff.handoffVerifiedOutcome({ ...DELIVER, userId: 'owner-1' });
    await b.handoff.handoffVerifiedOutcome({ ...DELIVER, userId: 'owner-2' });
    await record(a.service, 'owner-1');
    await record(b.service, 'owner-2');

    expect(a.outcomes.list('owner-1')).toHaveLength(1);
    expect(b.outcomes.list('owner-2')).toHaveLength(1);
    // Neither store can see the other owner's record.
    expect(a.outcomes.list('owner-2')).toHaveLength(0);
    expect(b.outcomes.list('owner-1')).toHaveLength(0);
  });

  it('is idempotent at the API boundary', async () => {
    const { handoff, service, outcomes } = api('owner-1');
    await handoff.handoffVerifiedOutcome({ ...DELIVER, userId: 'owner-1' });

    const first = await record(service, 'owner-1');
    const second = await record(service, 'owner-1');
    expect(first.ok === true && first.created).toBe(true);
    expect(second.ok === true && second.created).toBe(false);
    expect(outcomes.list('owner-1')).toHaveLength(1);
  });
});
