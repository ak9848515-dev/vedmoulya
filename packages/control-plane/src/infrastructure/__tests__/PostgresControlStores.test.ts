// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — PostgresControlStores (SPRINT-031) hermetic tests
// Verifies the synchronous control-plane store contracts over a recording
// postgres.js stub: owner isolation (IDOR), keyed document semantics, idempotent
// upserts and list ordering. The stores extend the shared @vedmoulya/core
// WriteThroughDocumentStore base (mirror-first + async write-through), so the
// sync contract is exercised exactly as the domain consumes it.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import type {
  AutonomySettings,
  EmergencyStopState,
  OpportunityLifecycleRecord,
} from '../types/control-types.js';
import {
  PostgresSettingsStore,
  PostgresEmergencyStopStore,
  PostgresOpportunityStore,
} from '../PostgresControlStores.js';

function createFakeSql(): postgres.Sql {
  const run = (first: unknown, ..._values: unknown[]): unknown => {
    const text = typeof first === 'string' ? first : (first as TemplateStringsArray).join('?');
    if (/^\s*SELECT/i.test(text)) return Promise.resolve([]);
    return Promise.resolve({ count: 1 });
  };
  // The store binds JSON docs via sql.json() — the fake returns the raw value
  // (the real driver wraps it in a Parameter for OID 3802). It REJECTS strings
  // to mirror the real driver's double-encoding failure mode (see the core
  // WriteThroughDocumentStore test for the regression this guards).
  return Object.assign(run, {
    json: (value: unknown): unknown => {
      if (typeof value === 'string') {
        throw new Error('double-encoding regression: sql.json() received pre-stringified JSON');
      }
      return value;
    },
  }) as unknown as postgres.Sql;
}

function settings(ownerId: string, overrides: Partial<AutonomySettings> = {}): AutonomySettings {
  return {
    ownerId,
    autonomyLevel: 3,
    allowedCategories: [],
    prohibitedCategories: [],
    maxDailyCostUsd: 10,
    maxTaskCostUsd: 1,
    allowedProviders: [],
    prohibitedProviders: [],
    privateOnly: true,
    userConfirmed: true,
    notificationPreference: 'briefing-only',
    quietHours: {},
    automationPermissions: [],
    updatedAt: '2026-08-14T08:00:00.000Z',
    updatedBy: ownerId,
    ...overrides,
  };
}

function stopState(ownerId: string, engaged = true): EmergencyStopState {
  return {
    ownerId,
    engaged,
    engagedAt: '2026-08-14T09:00:00.000Z',
    engagedBy: 'alice',
    reason: 'stop',
    history: [],
  };
}

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

describe('PostgresSettingsStore', () => {
  it('saves and reads one settings document per owner', async () => {
    const store = new PostgresSettingsStore(createFakeSql());
    store.save(settings('u1'));
    expect(store.get('u1')).toMatchObject({ ownerId: 'u1', autonomyLevel: 3 });
    await store.flush();
  });

  it('owner isolation: a foreign owner never sees another owner document', async () => {
    const store = new PostgresSettingsStore(createFakeSql());
    store.save(settings('u1'));
    store.save(settings('u2', { autonomyLevel: 5 }));
    expect(store.get('u1')?.autonomyLevel).toBe(3);
    expect(store.get('u2')?.autonomyLevel).toBe(5);
    expect(store.get('missing')).toBeUndefined();
    await store.flush();
  });
});

describe('PostgresEmergencyStopStore', () => {
  it('saves and reads emergency-stop state (fail-closed flag preserved)', async () => {
    const store = new PostgresEmergencyStopStore(createFakeSql());
    store.save(stopState('u1', true));
    expect(store.get('u1')).toMatchObject({ ownerId: 'u1', engaged: true });
    await store.flush();
  });

  it('owner isolation + released state round-trips', async () => {
    const store = new PostgresEmergencyStopStore(createFakeSql());
    store.save(stopState('u1', false));
    store.save(stopState('u2', true));
    expect(store.get('u1')?.engaged).toBe(false);
    expect(store.get('u2')?.engaged).toBe(true);
    expect(store.get('missing')).toBeUndefined();
    await store.flush();
  });
});

describe('PostgresOpportunityStore', () => {
  it('saves, reads and lists owner-scoped lifecycle records', async () => {
    const store = new PostgresOpportunityStore(createFakeSql());
    store.save(opportunity('u1', 'o1'));
    store.save(opportunity('u1', 'o2'));
    store.save(opportunity('u2', 'o1'));
    expect(store.list('u1')).toHaveLength(2);
    expect(store.list('u2')).toHaveLength(1);
    expect(store.get('u1', 'o1')).toMatchObject({ id: 'o1' });
    expect(store.get('u2', 'o1')).toMatchObject({ id: 'o1' });
    expect(store.get('u1', 'missing')).toBeUndefined();
    await store.flush();
  });

  it('stable-key lookup is owner-scoped (same key, different owner → own record)', async () => {
    const store = new PostgresOpportunityStore(createFakeSql());
    store.save(opportunity('u1', 'o1'));
    store.save(opportunity('u2', 'o1'));
    expect(store.getByKey('u1', 'u1:o1')?.id).toBe('o1');
    expect(store.getByKey('u1', 'u2:o1')).toBeUndefined(); // IDOR
    expect(store.getByKey('u2', 'u2:o1')?.id).toBe('o1');
    await store.flush();
  });

  it('list orders by updatedAt descending (newest first)', async () => {
    const store = new PostgresOpportunityStore(createFakeSql());
    store.save(opportunity('u1', 'old', '2026-08-14T07:00:00.000Z'));
    store.save(opportunity('u1', 'new', '2026-08-14T10:00:00.000Z'));
    const listed = store.list('u1');
    expect(listed.map((o) => o.id)).toEqual(['new', 'old']);
    await store.flush();
  });

  it('idempotent re-save never duplicates (mirror keyed by owner:id)', async () => {
    const store = new PostgresOpportunityStore(createFakeSql());
    store.save(opportunity('u1', 'o1'));
    store.save(opportunity('u1', 'o1')); // same record — same key
    expect(store.list('u1')).toHaveLength(1);
    await store.flush();
  });
});
