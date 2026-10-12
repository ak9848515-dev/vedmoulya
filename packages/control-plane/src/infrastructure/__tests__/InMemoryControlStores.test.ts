// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · InMemoryControlStores
//
// The deterministic dev/test backend. These tests exercise the owner-scoped
// documents, the idempotent opportunity↔mission link state machine
// (save / claimLaunch / completeLaunch / getLaunch / getByOpportunity /
// getByMission / list) and the list-ordering comparators that the durable
// backend must mirror.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryControlStores } from '../InMemoryControlStores.js';
import type { OpportunityLifecycleRecord } from '../../types/control-types.js';

function opportunity(
  ownerId: string,
  id: string,
  updatedAt = '2026-08-14T08:00:00.000Z',
): OpportunityLifecycleRecord {
  return {
    id,
    ownerId,
    stableKey: `${ownerId}:${id}`,
    title: `opportunity-${id}`,
    description: 'desc',
    category: 'AUTOMATION',
    status: 'DISCOVERED',
    evidence: [],
    riskLevel: 'LOW',
    automationPotential: 'HIGH',
    transitions: [],
    createdAt: '2026-08-14T07:00:00.000Z',
    updatedAt,
  };
}

describe('InMemoryControlStores — documents', () => {
  it('settings round-trip and are owner-scoped', () => {
    const stores = new InMemoryControlStores();
    expect(stores.settings.get('u1')).toBeUndefined();
    stores.settings.save({
      ownerId: 'u1',
      autonomyLevel: 3,
      privateOnly: true,
      userConfirmed: true,
      notificationPreference: 'briefing-only',
      updatedAt: '2026-08-14T08:00:00.000Z',
      updatedBy: 'u1',
    });
    expect(stores.settings.get('u1')?.autonomyLevel).toBe(3);
    expect(stores.settings.get('u2')).toBeUndefined();
  });

  it('emergency-stop state round-trips and is owner-scoped', () => {
    const stores = new InMemoryControlStores();
    expect(stores.emergencyStop.get('u1')).toBeUndefined();
    stores.emergencyStop.save({ ownerId: 'u1', engaged: true, history: [] });
    expect(stores.emergencyStop.get('u1')?.engaged).toBe(true);
    expect(stores.emergencyStop.get('u2')).toBeUndefined();
  });

  it('opportunities: save/get/getByKey/list are owner-scoped and keyed by id', () => {
    const stores = new InMemoryControlStores();
    stores.opportunities.save(opportunity('u1', 'o1'));
    stores.opportunities.save(opportunity('u2', 'o1'));
    expect(stores.opportunities.get('u1', 'o1')?.id).toBe('o1');
    expect(stores.opportunities.get('u1', 'missing')).toBeUndefined();
    expect(stores.opportunities.getByKey('u1', 'u1:o1')?.id).toBe('o1');
    expect(stores.opportunities.list('u1')).toHaveLength(1);
    expect(stores.opportunities.list('u2')).toHaveLength(1);
  });

  it('opportunities.list orders newest-updatedAt first', () => {
    const stores = new InMemoryControlStores();
    stores.opportunities.save(opportunity('u1', 'old', '2026-08-14T07:00:00.000Z'));
    stores.opportunities.save(opportunity('u1', 'new', '2026-08-14T10:00:00.000Z'));
    expect(stores.opportunities.list('u1').map((o) => o.id)).toEqual(['new', 'old']);
  });
});

describe('InMemoryControlStores — opportunity↔mission links', () => {
  const link = (overrides: Partial<{ missionId: string; createdAt: string }> = {}) => ({
    userId: 'u1',
    opportunityId: 'opp-1',
    missionId: overrides.missionId ?? 'm-1',
    createdAt: overrides.createdAt ?? '2026-08-14T08:00:00.000Z',
  });

  it('save is idempotent by (userId, opportunityId) — first writer wins', () => {
    const stores = new InMemoryControlStores();
    const first = stores.opportunityMissionLinks.save(link({ missionId: 'm-1' }));
    expect(first).toMatchObject({ status: 'LINKED', missionId: 'm-1' });
    const second = stores.opportunityMissionLinks.save(link({ missionId: 'm-2' }));
    expect(second.missionId).toBe('m-1');
    expect(stores.opportunityMissionLinks.list('u1')).toHaveLength(1);
  });

  it('claimLaunch returns PENDING on first claim and the EXISTING intent thereafter', async () => {
    const stores = new InMemoryControlStores();
    const pending = await stores.opportunityMissionLinks.claimLaunch(link({ missionId: 'm-1' }));
    expect(pending.status).toBe('PENDING');
    // A second claim at the same key returns the already-reserved intent.
    const again = await stores.opportunityMissionLinks.claimLaunch(link({ missionId: 'm-2' }));
    expect(again.missionId).toBe('m-1');
    expect(again.status).toBe('PENDING');
  });

  it('completeLaunch flips a matching PENDING intent to LINKED', async () => {
    const stores = new InMemoryControlStores();
    await stores.opportunityMissionLinks.claimLaunch(link({ missionId: 'm-1' }));
    const completed = await stores.opportunityMissionLinks.completeLaunch(
      link({ missionId: 'm-1' }),
    );
    expect(completed).toMatchObject({ status: 'LINKED', missionId: 'm-1' });
    expect(stores.opportunityMissionLinks.getByOpportunity('u1', 'opp-1')?.missionId).toBe('m-1');
  });

  it('completeLaunch fails closed on a missing intent or a Mission-ID mismatch', async () => {
    const stores = new InMemoryControlStores();
    // The in-memory backend throws synchronously (no awaited I/O to reject on).
    expect(() => stores.opportunityMissionLinks.completeLaunch(link({ missionId: 'm-1' }))).toThrow(
      'Launch intent mismatch.',
    );

    await stores.opportunityMissionLinks.claimLaunch(link({ missionId: 'm-1' }));
    expect(() => stores.opportunityMissionLinks.completeLaunch(link({ missionId: 'm-2' }))).toThrow(
      'Launch intent mismatch.',
    );
  });

  it('getLaunch returns PENDING and LINKED intents alike; getByOpportunity only LINKED', async () => {
    const stores = new InMemoryControlStores();
    await stores.opportunityMissionLinks.claimLaunch(link({ missionId: 'm-1' }));
    const pending = stores.opportunityMissionLinks.getLaunch('u1', 'opp-1');
    expect(pending?.status).toBe('PENDING');
    // A PENDING intent is not yet an association.
    expect(stores.opportunityMissionLinks.getByOpportunity('u1', 'opp-1')).toBeUndefined();

    await stores.opportunityMissionLinks.completeLaunch(link({ missionId: 'm-1' }));
    expect(stores.opportunityMissionLinks.getLaunch('u1', 'opp-1')?.status).toBe('LINKED');
    expect(stores.opportunityMissionLinks.getByOpportunity('u1', 'opp-1')?.missionId).toBe('m-1');
    expect(stores.opportunityMissionLinks.getLaunch('u1', 'missing')).toBeUndefined();
  });

  it('getByMission and list are owner-scoped and only surface LINKED associations', async () => {
    const stores = new InMemoryControlStores();
    await stores.opportunityMissionLinks.claimLaunch(link({ missionId: 'm-1' }));
    await stores.opportunityMissionLinks.claimLaunch({
      userId: 'u1',
      opportunityId: 'opp-2',
      missionId: 'm-2',
      createdAt: '2026-08-14T09:00:00.000Z',
    });
    await stores.opportunityMissionLinks.completeLaunch(link({ missionId: 'm-1' }));

    expect(stores.opportunityMissionLinks.getByMission('u1', 'm-1')?.opportunityId).toBe('opp-1');
    expect(stores.opportunityMissionLinks.getByMission('u1', 'm-2')).toBeUndefined();
    expect(stores.opportunityMissionLinks.getByMission('u2', 'm-1')).toBeUndefined();

    // Only the LINKED association is listed (opp-2 is still PENDING).
    expect(stores.opportunityMissionLinks.list('u1').map((l) => l.opportunityId)).toEqual([
      'opp-1',
    ]);
    expect(stores.opportunityMissionLinks.list('u2')).toEqual([]);
  });

  it('list orders LINKED associations newest-createdAt first', async () => {
    const stores = new InMemoryControlStores();
    const two = [
      { opportunityId: 'opp-old', createdAt: '2026-08-14T07:00:00.000Z' },
      { opportunityId: 'opp-new', createdAt: '2026-08-14T10:00:00.000Z' },
    ];
    for (const entry of two) {
      await stores.opportunityMissionLinks.claimLaunch({
        userId: 'u1',
        opportunityId: entry.opportunityId,
        missionId: `m-${entry.opportunityId}`,
        createdAt: entry.createdAt,
      });
      await stores.opportunityMissionLinks.completeLaunch({
        userId: 'u1',
        opportunityId: entry.opportunityId,
        missionId: `m-${entry.opportunityId}`,
        createdAt: entry.createdAt,
      });
    }
    expect(stores.opportunityMissionLinks.list('u1').map((l) => l.opportunityId)).toEqual([
      'opp-new',
      'opp-old',
    ]);
  });
});
