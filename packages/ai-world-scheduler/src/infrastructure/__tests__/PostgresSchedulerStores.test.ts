// ──────────────────────────────────────────────────────────────────
// VedMoulya — PostgresSchedulerStores (SPRINT-022) hermetic tests
// Same synchronous store contracts, backed by a recording postgres.js
// stub — verifies mirror semantics, FIFO ledger retention, owner
// isolation and the platform-wide source-policy convention.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { DEFAULT_JOB_POLICIES } from '../../domain/DiscoveryJobPolicy.js';
import type {
  DiscoveryRun,
  DiscoveryRunStatus,
  DiscoverySchedule,
  DiscoverySourcePolicy,
} from '../../types/scheduler-types.js';
import type { DiscoveryJob } from '../../types/scheduler-types.js';
import {
  PostgresScheduleStore,
  PostgresJobStore,
  PostgresRunStore,
  PostgresSourcePolicyStore,
  PostgresCooldownStore,
  LEDGER_RETENTION,
} from '../PostgresSchedulerStores.js';

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

function schedule(
  userId: string,
  jobCategory = 'PROVIDER_MODEL_DISCOVERY',
  enabled = true,
): DiscoverySchedule {
  return {
    userId,
    jobCategory: jobCategory as DiscoverySchedule['jobCategory'],
    enabled,
    frequency: 'DAILY',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function job(userId: string, jobCategory = 'PROVIDER_MODEL_DISCOVERY'): DiscoveryJob {
  return {
    jobId: jobCategory,
    userId,
    jobCategory: jobCategory as DiscoveryJob['jobCategory'],
    policy: DEFAULT_JOB_POLICIES[jobCategory as keyof typeof DEFAULT_JOB_POLICIES],
    enabled: true,
    frequency: 'DAILY',
    inFlight: false,
    cancelRequested: false,
    consecutiveFailures: 0,
  };
}

function run(
  userId: string,
  runId: string,
  startedAt: string,
  status: DiscoveryRunStatus = 'COMPLETED',
): DiscoveryRun {
  return {
    runId,
    userId,
    jobCategory: 'PROVIDER_MODEL_DISCOVERY',
    manual: false,
    status,
    startedAt,
    changeSummary: {
      ranAt: startedAt,
      meaningful: false,
      counts: { NO_CHANGE: 1, NEW: 0, UPDATED: 0, REMOVED: 0, CRITICAL_CHANGE: 0 },
      entries: [],
    },
    notifications: { emitted: 0, deduplicated: 0, skipped: 0 },
    budget: {
      spentTokens: 0,
      spentCostUsd: 0,
      spentLatencyMs: 0,
      discoveryCalls: 0,
      sourceCalls: 0,
      exceeded: false,
    },
    sourceReports: [],
  };
}

describe('PostgresSchedulerStores', () => {
  it('ScheduleStore: owner-scoped save/get/list with deterministic ordering', async () => {
    const store = new PostgresScheduleStore(createFakeSql());
    store.save(schedule('u1', 'PROVIDER_MODEL_DISCOVERY'));
    store.save(schedule('u1', 'AI_NEWS_DISCOVERY'));
    store.save(schedule('u2', 'GITHUB_DISCOVERY'));

    expect(store.get('u1', 'PROVIDER_MODEL_DISCOVERY')).toMatchObject({ userId: 'u1' });
    expect(store.get('u2', 'PROVIDER_MODEL_DISCOVERY')).toBeUndefined(); // IDOR
    expect(store.list('u1').map((s) => s.jobCategory)).toEqual([
      'AI_NEWS_DISCOVERY',
      'PROVIDER_MODEL_DISCOVERY',
    ]);
    expect(store.list('u2')).toHaveLength(1);
    await store.flush();
  });

  it('JobStore: owner-scoped with IDOR isolation', async () => {
    const store = new PostgresJobStore(createFakeSql());
    store.save(job('u1'));
    store.save(job('u2'));
    expect(store.get('u1', 'PROVIDER_MODEL_DISCOVERY')).toMatchObject({ userId: 'u1' });
    expect(store.get('u2', 'PROVIDER_MODEL_DISCOVERY')?.userId).toBe('u2');
    expect(store.list('u1')).toHaveLength(1);
    await store.flush();
  });

  it('RunStore: idempotent by runId — re-saving never duplicates', async () => {
    const store = new PostgresRunStore(createFakeSql());
    store.save(run('u1', 'r1', '2026-01-01T00:00:00.000Z'));
    store.save(run('u1', 'r1', '2026-01-02T00:00:00.000Z', 'FAILED')); // same runId
    expect(store.list('u1')).toHaveLength(1);
    expect(store.get('u1', 'r1')?.status).toBe('FAILED');
    expect(store.ledger('u1').runs).toHaveLength(1);
    await store.flush();
  });

  it('RunStore: bounded FIFO ledger (LEDGER_RETENTION) with chronological order', async () => {
    const store = new PostgresRunStore(createFakeSql());
    for (let i = 0; i < LEDGER_RETENTION + 10; i += 1) {
      store.save(run('u1', `r${i}`, `2026-01-01T00:00:0${String(i % 10).padStart(2, '0')}.000Z`));
    }
    const runs = store.ledger('u1').runs;
    expect(runs).toHaveLength(LEDGER_RETENTION);
    // Oldest 10 were evicted; the rest are chronological (oldest first).
    expect(runs[0]?.runId).toBe('r10');
    const times = runs.map((r) => Date.parse(r.startedAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    await store.flush();
  });

  it('RunStore: owner isolation — foreign runId reads nothing', async () => {
    const store = new PostgresRunStore(createFakeSql());
    store.save(run('u1', 'r1', '2026-01-01T00:00:00.000Z'));
    expect(store.get('u2', 'r1')).toBeUndefined();
    expect(store.ledger('u2').runs).toHaveLength(0);
    await store.flush();
  });

  it('SourcePolicyStore: platform-wide (owner-less) infrastructure state', async () => {
    const store = new PostgresSourcePolicyStore(createFakeSql());
    const policy: DiscoverySourcePolicy = {
      sourceId: 'static-catalog',
      enabled: true,
      consecutiveFailures: 0,
      callsConsumed: 3,
      rateLimitWindowStartedAtMs: 0,
      maxCallsPerWindow: 10,
      rateLimitWindowMs: 60000,
      budgetConsumedUsd: 0,
    };
    store.save(policy);
    expect(store.get('static-catalog')).toMatchObject({
      sourceId: 'static-catalog',
      callsConsumed: 3,
    });
    expect(store.list()).toHaveLength(1);
    await store.flush();
  });

  it('CooldownStore: owner-scoped by (userId, key)', async () => {
    const store = new PostgresCooldownStore(createFakeSql());
    store.save({
      userId: 'u1',
      key: 'item-42',
      lastNotifiedAt: '2026-01-01T00:00:00.000Z',
      nextEligibleAtMs: 1000,
    });
    expect(store.get('u1', 'item-42')).toMatchObject({ key: 'item-42' });
    expect(store.get('u2', 'item-42')).toBeUndefined(); // IDOR
    await store.flush();
  });
});
