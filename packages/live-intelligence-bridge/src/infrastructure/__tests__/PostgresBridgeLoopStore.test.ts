// ──────────────────────────────────────────────────────────────────
// VedMoulya — PostgresBridgeLoopStore (SPRINT-022) hermetic tests
// Owner-scoped loop persistence with idempotent upsert (re-saving a
// loop replaces it — never duplicates) and bounded FIFO retention.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import type { BridgeLoopRun } from '../../types/bridge-types.js';
import { PostgresBridgeLoopStore, BRIDGE_LOOPS_PER_OWNER } from '../PostgresBridgeLoopStore.js';

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

function loop(
  userId: string,
  loopId: string,
  createdAt = '2026-01-01T00:00:00.000Z',
): BridgeLoopRun {
  return {
    loopId,
    userId,
    objective: `objective-${loopId}`,
    status: 'RUNNING',
    stage: 'UNDERSTAND',
    stageStatuses: {},
    capabilities: [],
    candidates: [],
    comparisons: [],
    recommendations: [],
    approvals: [],
    performance: [],
    notifications: [],
    traceId: `trace-${loopId}`,
    createdAt,
    updatedAt: createdAt,
  } as BridgeLoopRun;
}

describe('PostgresBridgeLoopStore', () => {
  it('saves and lists loops owner-scoped with deterministic order', async () => {
    const store = new PostgresBridgeLoopStore(createFakeSql());
    store.save(loop('u1', 'l1', '2026-01-01T00:00:00.000Z'));
    store.save(loop('u1', 'l2', '2026-01-02T00:00:00.000Z'));
    store.save(loop('u2', 'l1', '2026-01-01T00:00:00.000Z'));
    expect(store.list('u1').map((l) => l.loopId)).toEqual(['l1', 'l2']);
    expect(store.get('u1', 'l2')).toMatchObject({ loopId: 'l2' });
    expect(store.get('u2', 'l2')).toBeUndefined(); // IDOR
    await store.flush();
  });

  it('re-saving a loop replaces it — never a duplicate record', async () => {
    const store = new PostgresBridgeLoopStore(createFakeSql());
    store.save(loop('u1', 'l1'));
    store.save({ ...loop('u1', 'l1'), status: 'COMPLETED' });
    const runs = store.list('u1');
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('COMPLETED');
    await store.flush();
  });

  it('bounds loops per owner (FIFO 50)', async () => {
    const store = new PostgresBridgeLoopStore(createFakeSql());
    for (let i = 0; i < BRIDGE_LOOPS_PER_OWNER + 5; i += 1) {
      store.save(loop('u1', `l${i}`, `2026-01-01T00:00:00.${String(i).padStart(3, '0')}Z`));
    }
    expect(store.list('u1')).toHaveLength(BRIDGE_LOOPS_PER_OWNER);
    expect(store.list('u1')[0]?.loopId).toBe('l5'); // oldest 5 evicted
    await store.flush();
  });
});
