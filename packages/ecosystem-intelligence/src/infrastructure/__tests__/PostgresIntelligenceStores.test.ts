// ──────────────────────────────────────────────────────────────────
// VedMoulya — PostgresIntelligenceStores (SPRINT-022) hermetic tests
// Verifies the EPIC-015 store contracts over a recording postgres.js
// stub: owner isolation, read-state preservation, bounded retention and
// the never-persist-tokens GitHub connection convention.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import type {
  GitHubConnection,
  IntelligenceNotification,
  LifecycleRecord,
} from '../../types/intelligence-types.js';
import {
  PostgresGitHubConnectionStore,
  PostgresLifecycleStore,
  PostgresRecommendationStore,
  PostgresNotificationStore,
  PostgresAcquisitionStore,
  NOTIFICATIONS_PER_OWNER,
} from '../PostgresIntelligenceStores.js';

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

function connection(userId: string): GitHubConnection {
  return {
    userId,
    state: 'CONNECTED',
    accountLogin: 'alice',
    grantedScopes: ['public_metadata'],
    authorizedScopes: ['public_metadata'],
    connectedAt: '2026-01-01T00:00:00.000Z',
  } as GitHubConnection;
}

function lifecycle(userId: string, resourceId: string): LifecycleRecord {
  return {
    resourceId,
    resourceKind: 'provider',
    state: 'VERIFIED',
    evidence: [],
    history: [{ state: 'VERIFIED', at: '2026-01-01T00:00:00.000Z', reason: 'test' }],
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as LifecycleRecord;
}

function notification(
  userId: string,
  id: string,
  createdAt = '2026-01-01T00:00:00.000Z',
): IntelligenceNotification {
  return {
    id,
    kind: 'BETTER_MODEL',
    title: `n-${id}`,
    body: 'body',
    relevance: 0.9,
    createdAt,
  } as IntelligenceNotification;
}

describe('PostgresIntelligenceStores', () => {
  it('GitHubConnectionStore: one connection per user, metadata only — never a token', async () => {
    const store = new PostgresGitHubConnectionStore(createFakeSql());
    const conn = connection('u1');
    store.save(conn);
    store.save(connection('u2'));
    expect(store.get('u1')).toMatchObject({ userId: 'u1', accountLogin: 'alice' });
    expect(store.get('u3')).toBeUndefined();
    // The contract's document never carries a token field — nothing secret
    // can ever be serialized.
    expect('token' in (store.get('u1') as object)).toBe(false);
    await store.flush();
  });

  it('LifecycleStore: owner-scoped keyed by resourceId', async () => {
    const store = new PostgresLifecycleStore(createFakeSql());
    store.save('u1', lifecycle('u1', 'res-1'));
    store.save('u1', lifecycle('u1', 'res-2'));
    store.save('u2', lifecycle('u2', 'res-1'));
    expect(store.get('u1', 'res-1')).toMatchObject({ resourceId: 'res-1' });
    expect(store.get('u2', 'res-1')?.resourceId).toBe('res-1');
    expect(store.get('u2', 'res-2')).toBeUndefined(); // IDOR
    expect(store.list('u1')).toHaveLength(2);
    await store.flush();
  });

  it('RecommendationStore: save/get/list/mark with owner isolation', async () => {
    const store = new PostgresRecommendationStore(createFakeSql());
    store.save('u1', {
      id: 'rec-1',
      kind: 'better-provider',
      title: 't',
      state: 'PENDING',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    store.save('u1', {
      id: 'rec-2',
      kind: 'better-provider',
      title: 't',
      state: 'PENDING',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    store.mark('u1', 'rec-1', 'ACCEPTED');
    expect(store.get('u1', 'rec-1')?.state).toBe('ACCEPTED');
    expect(store.get('u2', 'rec-1')).toBeUndefined(); // IDOR
    expect(store.list('u1')).toHaveLength(2);
    await store.flush();
  });

  it('NotificationStore: read state persists and survives re-save; bounded retention', async () => {
    const store = new PostgresNotificationStore(createFakeSql());
    store.save('u1', notification('u1', 'n1', '2026-01-01T00:00:00.000Z'));
    store.markRead('u1', 'n1');
    // Re-saving (e.g. a notification update) preserves read state.
    store.save('u1', notification('u1', 'n1', '2026-01-01T00:00:00.000Z'));
    const listed = store.list('u1');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.read).toBe(true);
    expect(listed[0]?.id).toBe('n1');

    // Bounded retention (200/user, FIFO).
    for (let i = 0; i < NOTIFICATIONS_PER_OWNER + 5; i += 1) {
      store.save(
        'u2',
        notification('u2', `n${i}`, `2026-01-01T00:00:00.${String(i).padStart(3, '0')}Z`),
      );
    }
    expect(store.list('u2')).toHaveLength(NOTIFICATIONS_PER_OWNER);
    // Read state is owner-scoped.
    expect(store.list('u1')[0]?.read).toBe(true);
    await store.flush();
  });

  it('AcquisitionStore: case-insensitive repository key, owner-scoped', async () => {
    const store = new PostgresAcquisitionStore(createFakeSql());
    store.save('u1', {
      repository: 'Owner/Repo',
      state: 'DISCOVERED',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(store.get('u1', 'owner/repo')).toMatchObject({ repository: 'Owner/Repo' });
    store.mark('u1', 'OWNER/REPO', 'APPROVED');
    expect(store.get('u1', 'owner/repo')?.state).toBe('APPROVED');
    expect(store.get('u2', 'owner/repo')).toBeUndefined(); // IDOR
    await store.flush();
  });
});
