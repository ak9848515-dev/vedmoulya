// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · Opportunity ↔ Mission link coverage (S5.2)
//
// Focused unit coverage for the two association entry points:
//   • linkOpportunityToMission — APPROVED-only, idempotent by (user, opp)
//   • linkClaimedOpportunityToMission — also accepts the PLANNED launch claim
// Both are exercised directly so the package coverage gate sees them.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ActiveIntelligenceControlPlane } from '../application/ActiveIntelligenceControlPlane.js';
import { InMemoryControlStores } from '../infrastructure/InMemoryControlStores.js';

function makePlane() {
  const stores = new InMemoryControlStores();
  const plane = new ActiveIntelligenceControlPlane({
    brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
    proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
    fabric: {} as never,
    stores,
    now: () => '2026-10-05T00:00:00.000Z',
  });
  return { plane, stores };
}

function approvedOpportunity(
  plane: ActiveIntelligenceControlPlane,
  ownerId = 'u1',
): { id: string } {
  const opp = plane.discoverOpportunity({
    ownerId,
    title: 'Link me',
    description: 'x',
    category: 'x',
    evidence: [],
    riskLevel: 'LOW',
    automationPotential: 'LOW',
  });
  for (const to of ['ASSESSED', 'SHORTLISTED', 'PRESENTED'] as const) {
    const r = plane.transitionOpportunity({ ownerId, id: opp.id, to, note: 'walk' });
    expect(r.success).toBe(true);
  }
  const approved = plane.transitionOpportunity({
    ownerId,
    id: opp.id,
    to: 'APPROVED',
    note: 'human approved',
    approval: { id: 'a1', grantedBy: ownerId, grantedAt: '2026-10-05T00:00:00.000Z', scope: 's' },
  });
  expect(approved.success).toBe(true);
  return { id: opp.id };
}

describe('S5.2 — opportunity↔mission link entry points', () => {
  it('linkOpportunityToMission persists once and is idempotent', () => {
    const { plane } = makePlane();
    const { id } = approvedOpportunity(plane);
    const link = {
      userId: 'u1',
      opportunityId: id,
      missionId: 'm-1',
      createdAt: '2026-10-05T00:00:00.000Z',
    };
    const first = plane.linkOpportunityToMission(link);
    expect(first.missionId).toBe('m-1');
    // A second save with a DIFFERENT missionId still returns the first —
    // first-writer-wins idempotency, never a second linkage.
    const second = plane.linkOpportunityToMission({ ...link, missionId: 'm-2' });
    expect(second.missionId).toBe('m-1');
    expect(plane.getMissionForOpportunity('u1', id)?.missionId).toBe('m-1');
    expect(plane.getOpportunityForMission('u1', 'm-1')?.opportunityId).toBe(id);
    expect(plane.listOpportunityMissionLinks('u1')).toHaveLength(1);
  });

  it('linkOpportunityToMission refuses missing and non-APPROVED opportunities', () => {
    const { plane } = makePlane();
    expect(() =>
      plane.linkOpportunityToMission({
        userId: 'u1',
        opportunityId: 'nope',
        missionId: 'm-1',
        createdAt: '2026-10-05T00:00:00.000Z',
      }),
    ).toThrow('Opportunity not found.');
    const opp = plane.discoverOpportunity({
      ownerId: 'u1',
      title: 'Not approved',
      description: 'x',
      category: 'x',
      evidence: [],
      riskLevel: 'LOW',
      automationPotential: 'LOW',
    });
    expect(() =>
      plane.linkOpportunityToMission({
        userId: 'u1',
        opportunityId: opp.id,
        missionId: 'm-1',
        createdAt: '2026-10-05T00:00:00.000Z',
      }),
    ).toThrow('Only an APPROVED opportunity');
  });

  it('linkClaimedOpportunityToMission accepts the PLANNED launch claim', () => {
    const { plane } = makePlane();
    const { id } = approvedOpportunity(plane);
    const claimed = plane.transitionOpportunity({
      ownerId: 'u1',
      id,
      to: 'PLANNED',
      note: 'mission launch claimed — association pending',
    });
    expect(claimed.success).toBe(true);
    const link = plane.linkClaimedOpportunityToMission({
      userId: 'u1',
      opportunityId: id,
      missionId: 'm-9',
      createdAt: '2026-10-05T00:00:00.000Z',
    });
    expect(link.missionId).toBe('m-9');
    expect(plane.getMissionForOpportunity('u1', id)?.missionId).toBe('m-9');
  });

  it('linkClaimedOpportunityToMission refuses missing and non-claim statuses', () => {
    const { plane } = makePlane();
    expect(() =>
      plane.linkClaimedOpportunityToMission({
        userId: 'u1',
        opportunityId: 'nope',
        missionId: 'm-1',
        createdAt: '2026-10-05T00:00:00.000Z',
      }),
    ).toThrow('Opportunity not found.');
    const opp = plane.discoverOpportunity({
      ownerId: 'u1',
      title: 'Still discovered',
      description: 'x',
      category: 'x',
      evidence: [],
      riskLevel: 'LOW',
      automationPotential: 'LOW',
    });
    expect(() =>
      plane.linkClaimedOpportunityToMission({
        userId: 'u1',
        opportunityId: opp.id,
        missionId: 'm-1',
        createdAt: '2026-10-05T00:00:00.000Z',
      }),
    ).toThrow('Only an APPROVED opportunity');
  });
});
