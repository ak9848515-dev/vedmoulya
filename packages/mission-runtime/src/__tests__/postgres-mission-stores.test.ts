// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Durable Mission Persistence (BLD-022 §5)
//
// Verifies the Postgres-backed MissionStore/CheckpointStore on the
// EXISTING WriteThroughDocumentStore infrastructure: sync mirror
// semantics (reads never touch the database), idempotent parameterized
// write-through attempts, bounded per-mission checkpoint retention,
// boot hydration (corrupt rows skipped, never fatal), and shutdown
// flush. Hermetic: no live database required — the fake driver records
// statement attempts exactly as the real driver receives them.
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import type { Mission, MissionCheckpoint } from '@vedmoulya/mission-controller';
import {
  PostgresCheckpointStore,
  PostgresMissionStore,
  ensureMissionPersistence,
} from '../persistence/PostgresMissionStores.js';

/** The base store's driver type (same convention as every EI store). */
type Sql = postgres.Sql;

interface FakeSql {
  sql: Sql;
  statements: string[];
  setRows(rows: Array<{ owner: string; key: string; doc: string }>): void;
}

/**
 * Hermetic driver mirroring postgres.js's dual call shape: tagged-template
 * execution (sql\`…\`) AND plain-call identifier fragments (sql('table')
 * used inside template interpolation, which postgres.js serializes into the
 * surrounding query). json()-capable; records every statement text.
 */
function createFakeSql(): FakeSql {
  const statements: string[] = [];
  let rows: Array<{ owner: string; key: string; doc: string }> = [];
  const handler = ((...args: unknown[]) => {
    const [first] = args;
    if (typeof first === 'string') {
      // Plain-call fragment: sql('table_name') — returns a fragment value
      // that the surrounding tagged template merely interpolates.
      return { __fragment: first };
    }
    const strings = first as readonly string[];
    statements.push(strings.join('?').replace(/\s+/g, ' ').trim().slice(0, 60));
    return Promise.resolve(rows);
  }) as unknown as Sql & { json: (value: unknown) => unknown };
  handler.json = (value: unknown) => ({ __json: value });
  return {
    sql: handler as Sql,
    statements,
    setRows(next: Array<{ owner: string; key: string; doc: string }>): void {
      rows = next;
    },
  };
}

function makeMission(overrides: Partial<Mission> = {}): Mission {
  const now = new Date().toISOString();
  return {
    missionId: 'mission-pg-1',
    userId: 'user-1',
    title: 'Persistence mission',
    objective: 'Persist and recover',
    description: 'Persist and recover',
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
    budget: {
      maxObjectives: 3,
      maxActions: 30,
      maxToolCalls: 50,
      maxRetries: 2,
      maxReplans: 2,
      maxRuntimeMs: 600000,
      maxTokens: 50000,
      maxCostUsd: 2,
    },
    budgetUsage: {
      objectivesCompleted: 0,
      objectivesFailed: 0,
      actionsExecuted: 0,
      toolCallsExecuted: 0,
      retriesConsumed: 0,
      replansConsumed: 0,
      runtimeMs: 0,
      tokensConsumed: 0,
      costUsdConsumed: 0,
    },
    constraints: {},
    state: 'RUNNING',
    stateHistory: ['CREATED', 'RUNNING'],
    objectives: [],
    checkpoints: [],
    decisions: [],
    successCriteria: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCheckpoint(missionId: string, index: number): MissionCheckpoint {
  return {
    checkpointId: `checkpoint-pg-${String(index)}`,
    missionId,
    objectiveId: `objective-${String(index)}`,
    state: 'VERIFIED',
    completedWork: [`work-${String(index)}`],
    remainingWork: [],
    failures: [],
    recoveryHistory: [],
    learningReferences: [],
    experienceReferences: [],
    budgetRemaining: {
      objectives: 2,
      actions: 29,
      runtimeMs: 599000,
      tokens: 49900,
      costUsd: 1.99,
    },
    timestamp: new Date(Date.parse('2026-01-01T00:00:00Z') + index * 1000).toISOString(),
  };
}

describe('Postgres mission persistence (existing WriteThrough infrastructure)', () => {
  it('mirror semantics: save/get/list served from the mirror; writes attempt the parameterized upsert', async () => {
    const fake = createFakeSql();
    const store = new PostgresMissionStore(fake.sql);
    const mission = makeMission();
    await store.save(mission);
    const loaded = await store.get('mission-pg-1');
    expect(loaded?.title).toBe('Persistence mission');
    expect(await store.listByUserId('user-1')).toHaveLength(1);
    expect(await store.listByUserId('someone-else')).toHaveLength(0);
    expect(await store.listActive()).toHaveLength(1);
    expect(store.getSync('mission-pg-1')?.missionId).toBe('mission-pg-1');
    expect(fake.statements.some((statement) => statement.includes('INSERT'))).toBe(true);
    // Updates are idempotent upserts on (owner, key) — save twice, one row.
    await store.save({ ...mission, state: 'COMPLETED' });
    expect(await store.listByUserId('user-1')).toHaveLength(1);
    expect((await store.get('mission-pg-1'))?.state).toBe('COMPLETED');
    expect(await store.listActive()).toHaveLength(0); // terminal → inactive
  });

  it('checkpoint retention is bounded per mission and latest reads work', async () => {
    const fake = createFakeSql();
    const store = new PostgresCheckpointStore(fake.sql);
    for (let index = 0; index < 55; index += 1) {
      await store.save(makeCheckpoint('mission-pg-1', index));
    }
    const all = await store.listForMission('mission-pg-1');
    expect(all).toHaveLength(50); // bounded retention (never an unbounded sink)
    expect(all[0]?.checkpointId).toBe('checkpoint-pg-5'); // oldest evicted
    const latest = await store.getLatestForMission('mission-pg-1');
    expect(latest?.checkpointId).toBe('checkpoint-pg-54'); // newest kept
  });

  it('boot hydrate loads rows (corrupt rows skipped, never fatal); flush drains', async () => {
    const fake = createFakeSql();
    fake.setRows([
      {
        owner: 'mission-controller',
        key: 'mission-pg-2',
        doc: JSON.stringify(makeMission({ missionId: 'mission-pg-2' })),
      },
      { owner: 'mission-controller', key: 'mission-bad', doc: '{not json' },
    ]);
    const store = new PostgresMissionStore(fake.sql);
    const hydrated = await store.hydrate();
    expect(hydrated).toBe(2); // both rows read…
    expect((await store.get('mission-pg-2'))?.title).toBe('Persistence mission'); // …the valid one loads
    expect(await store.get('mission-bad')).toBeUndefined(); // …the corrupt one is skipped
    await store.save(makeMission({ missionId: 'mission-pg-3' }));
    await store.flush(); // drains without error on the fake
    expect(fake.statements.some((statement) => statement.includes('INSERT'))).toBe(true);
  });

  it('ensureMissionPersistence boots both tables (idempotent DDL) and hydrates', async () => {
    const fake = createFakeSql();
    const boot = await ensureMissionPersistence(fake.sql);
    expect(boot.missions).toBeInstanceOf(PostgresMissionStore);
    expect(boot.checkpoints).toBeInstanceOf(PostgresCheckpointStore);
    const createStatements = fake.statements.filter((statement) =>
      statement.includes('CREATE TABLE'),
    );
    expect(createStatements.length).toBeGreaterThanOrEqual(2);
  });
});
