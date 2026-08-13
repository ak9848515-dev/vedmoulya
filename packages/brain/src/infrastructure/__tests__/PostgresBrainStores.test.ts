// ──────────────────────────────────────────────────────────────────
// VedMoulya — PostgresBrainStores (SPRINT-022) hermetic tests
// Verifies the synchronous Brain store contracts over a recording
// postgres.js stub: owner isolation, idempotent upserts (no duplicate
// records), bounded grouped retention, durable outcome memory and
// EXACT parity between the persisted adaptive-score ledger and the
// in-memory ledger (same pure math).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { AdaptiveScoreLedger } from '../../domain/AdaptiveScoreLedger.js';
import type { BrainTask } from '../../types/brain-types.js';
import type { BrainDecisionRecord } from '../../types/brain-types.js';
import type {
  BrainOutcomeMemory,
  IntelligenceEvent,
  Opportunity,
} from '../../types/continuous-types.js';
import {
  PostgresBrainTaskStore,
  PostgresBrainDecisionStore,
  PostgresOpportunityStore,
  PostgresIntelligenceEventStore,
  PostgresOutcomeMemory,
  PostgresAdaptiveScoreLedger,
  BRAIN_TASKS_PER_OWNER,
} from '../PostgresBrainStores.js';

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

function task(userId: string, id: string, createdAt = '2026-01-01T00:00:00.000Z'): BrainTask {
  return {
    id,
    userId,
    objective: `objective-${id}`,
    originalInput: `input-${id}`,
    intent: { domain: 'productivity', goal: 'help', constraints: [], preferences: [] },
    mode: 'AUTONOMOUS',
    domain: 'productivity',
    qualityTarget: 'good',
    privacyRequirement: 'private',
    budget: { maxTokens: 1000, maxCostUsd: 0.1, maxIterations: 5, maxLatencyMs: 60000 },
    requiredCapabilities: ['reasoning'],
    roleAssignments: [],
    graph: { nodes: [], edges: [] },
    status: 'PLANNING',
    stage: 'UNDERSTAND',
    stageStatuses: {},
    providerOutputs: [],
    conflicts: [],
    failoverEvents: [],
    decisionRecords: [],
    approvalRequired: [],
    approvalGranted: [],
    traceId: `trace-${id}`,
    createdAt,
    updatedAt: createdAt,
  } as BrainTask;
}

function decision(
  userId: string,
  taskId: string,
  id: string,
  createdAt = '2026-01-01T00:00:00.000Z',
): BrainDecisionRecord {
  return {
    id,
    taskId,
    userId,
    decision: 'select-provider',
    reason: 'evidence',
    alternatives: [],
    selected: 'provider-a',
    evidence: [],
    confidence: 0.9,
    constraints: [],
    qualityEstimate: 0.9,
    createdAt,
    provenance: 'test',
  } as BrainDecisionRecord;
}

function opportunity(
  userId: string,
  id: string,
  createdAt = '2026-01-01T00:00:00.000Z',
): Opportunity {
  return {
    id,
    userId,
    category: 'AUTOMATION',
    title: `opportunity-${id}`,
    description: 'desc',
    evidence: [],
    uncertainty: 0.3,
    source: 'ai-world-discovery',
    createdAt,
  } as Opportunity;
}

function event(
  userId: string,
  id: string,
  createdAt = '2026-01-01T00:00:00.000Z',
): IntelligenceEvent {
  return {
    id,
    userId,
    kind: 'NEW_MODEL',
    title: `event-${id}`,
    description: 'desc',
    relevance: 0.8,
    security: 'TRUSTED',
    evidence: [],
    adoptionRequired: [],
    source: 'ai-world',
    createdAt,
  } as IntelligenceEvent;
}

function outcome(
  userId: string,
  taskId: string,
  capturedAt = '2026-01-01T00:00:00.000Z',
): BrainOutcomeMemory {
  return {
    userId,
    taskId,
    taskType: 'coding',
    providers: [
      {
        providerId: 'provider-a',
        capability: 'reasoning',
        role: 'PRIMARY_REASONER',
        succeeded: true,
      },
    ],
    selectedReason: [],
    outcome: 'SUCCESS',
    userAccepted: true,
    capturedAt,
  } as BrainOutcomeMemory;
}

describe('PostgresBrainStores', () => {
  it('BrainTaskStore: owner-scoped get/list; foreign tasks are invisible', async () => {
    const store = new PostgresBrainTaskStore(createFakeSql());
    store.save(task('u1', 't1'));
    store.save(task('u2', 't2'));
    expect(store.get('u1', 't1')).toMatchObject({ id: 't1' });
    expect(store.get('u2', 't1')).toBeUndefined(); // IDOR
    expect(store.list('u1')).toHaveLength(1);
    await store.flush();
  });

  it('BrainTaskStore: bounded FIFO retention per owner', async () => {
    const store = new PostgresBrainTaskStore(createFakeSql());
    for (let i = 0; i < BRAIN_TASKS_PER_OWNER + 5; i += 1) {
      store.save(task('u1', `t${i}`, `2026-01-01T00:00:00.${String(i).padStart(3, '0')}Z`));
    }
    expect(store.list('u1')).toHaveLength(BRAIN_TASKS_PER_OWNER);
    await store.flush();
  });

  it('BrainDecisionStore: grouped by task, bounded 200/task, owner-scoped', async () => {
    const store = new PostgresBrainDecisionStore(createFakeSql());
    for (let i = 0; i < 210; i += 1) {
      store.save(
        decision('u1', 'task-1', `d${i}`, `2026-01-01T00:00:00.${String(i).padStart(3, '0')}Z`),
      );
    }
    store.save(decision('u1', 'task-2', 'd0'));
    store.save(decision('u2', 'task-1', 'foreign'));

    expect(store.get('u1', 'task-1')).toHaveLength(200); // bounded
    expect(store.get('u1', 'task-1')![0]?.id).toBe('d10'); // oldest evicted
    expect(store.get('u1', 'task-2')).toHaveLength(1);
    expect(store.get('u2', 'task-1')).toHaveLength(1); // own records only
    expect(store.get('u1', 'task-1')?.some((d) => d.id === 'foreign')).toBe(false);
    await store.flush();
  });

  it('OpportunityStore: idempotent save + status update, owner-scoped', async () => {
    const store = new PostgresOpportunityStore(createFakeSql());
    store.save(opportunity('u1', 'o1'));
    store.save(opportunity('u1', 'o1')); // dedup by stable id
    store.save(opportunity('u2', 'o1')); // same id, different owner — separate row
    expect(store.list('u1')).toHaveLength(1);
    expect(store.list('u2')).toHaveLength(1);

    const updated = store.update('u1', 'o1', { status: 'DISMISSED' } as Partial<Opportunity>);
    expect(updated?.status).toBe('DISMISSED');
    expect(store.list('u1')[0]?.status).toBe('DISMISSED');
    expect(store.update('u2', 'o1', { status: 'DISMISSED' } as Partial<Opportunity>)?.status).toBe(
      'DISMISSED',
    );
    expect(
      store.update('u1', 'missing', { status: 'DISMISSED' } as Partial<Opportunity>),
    ).toBeUndefined();
    await store.flush();
  });

  it('IntelligenceEventStore: owner-scoped + idempotent', async () => {
    const store = new PostgresIntelligenceEventStore(createFakeSql());
    store.save(event('u1', 'e1'));
    store.save(event('u1', 'e1'));
    store.save(event('u2', 'e1')); // same id, different owner — separate row
    expect(store.list('u1')).toHaveLength(1);
    expect(store.list('u2')).toHaveLength(1);
    const updated = store.update('u1', 'e1', { status: 'SEEN' } as Partial<IntelligenceEvent>);
    expect(updated?.status).toBe('SEEN');
    expect(store.list('u1')[0]?.status).toBe('SEEN');
    // Each owner updates their OWN row only.
    expect(store.update('u2', 'e1', { status: 'SEEN' } as Partial<IntelligenceEvent>)?.status).toBe(
      'SEEN',
    );
    expect(
      store.update('u2', 'missing', { status: 'SEEN' } as Partial<IntelligenceEvent>),
    ).toBeUndefined();
    await store.flush();
  });

  it('OutcomeMemory: re-evaluating the same task never duplicates the learning record', async () => {
    const store = new PostgresOutcomeMemory(createFakeSql());
    await store.recordOutcome(outcome('u1', 'task-1'));
    await store.recordOutcome(outcome('u1', 'task-1'));
    await store.recordOutcome(outcome('u2', 'task-1'));
    expect(store.list('u1')).toHaveLength(1); // no duplicate after restart semantics
    expect(store.list('u2')).toHaveLength(1);
    expect(store.list('u1')[0]?.taskId).toBe('task-1');
    await store.flush();
  });

  it('AdaptiveScoreLedger (Postgres) matches the in-memory ledger score-for-score', async () => {
    const now = (): string => '2026-01-01T00:00:00.000Z';
    const inMemory = new AdaptiveScoreLedger(now);
    const persisted = new PostgresAdaptiveScoreLedger(
      createFakeSql(),
      'adaptive_score_ledger',
      now,
    );

    const samples = [
      {
        providerId: 'p1',
        capability: 'reasoning' as const,
        succeeded: true,
        explicit: true,
        at: '2026-01-01T00:00:00.000Z',
      },
      {
        providerId: 'p1',
        capability: 'reasoning' as const,
        succeeded: true,
        explicit: false,
        quality: 0.7,
        at: '2026-01-02T00:00:00.000Z',
      },
      {
        providerId: 'p2',
        capability: 'reasoning' as const,
        succeeded: false,
        explicit: false,
        at: '2026-01-03T00:00:00.000Z',
      },
      {
        providerId: 'p2',
        capability: 'reasoning' as const,
        succeeded: true,
        explicit: true,
        at: '2026-01-04T00:00:00.000Z',
      },
    ];

    for (const sample of samples) {
      await inMemory.recordPerformance(sample);
      await persisted.recordPerformance(sample);
    }

    const memScores = inMemory.scoresFor('reasoning');
    const pgScores = persisted.scoresFor('reasoning');
    expect(pgScores).toEqual(memScores); // identical math, identical order
    expect(persisted.bestFor('reasoning')).toEqual(inMemory.bestFor('reasoning'));
    await persisted.flush();
  });

  it('persisted ledger survives instance recreation via hydrate (mirror round-trip)', async () => {
    const now = (): string => '2026-01-01T00:00:00.000Z';
    const first = new PostgresAdaptiveScoreLedger(createFakeSql(), 'adaptive_score_ledger', now);
    await first.recordPerformance({
      providerId: 'p1',
      capability: 'reasoning',
      succeeded: true,
      explicit: true,
      at: now(),
    });

    // Simulate restart: a NEW instance hydrates the same rows (fake sql
    // returns the serialized entries for SELECT).
    const rows = first.scoresFor('reasoning');
    const fakeHydrate = ((firstArg: unknown, ..._values: unknown[]) => {
      const text =
        typeof firstArg === 'string' ? firstArg : (firstArg as TemplateStringsArray).join('?');
      if (/^\s*SELECT/i.test(text)) {
        return Promise.resolve([
          {
            owner: '',
            key: 'p1|reasoning',
            doc: JSON.stringify({
              providerId: 'p1',
              capability: 'reasoning',
              sum: 0.98,
              weight: 1,
              sampleCount: 1,
              source: 'EXPLICIT',
              updatedAt: now(),
            }),
          },
        ]);
      }
      return Promise.resolve({ count: 1 });
    }) as unknown as postgres.Sql;

    const second = new PostgresAdaptiveScoreLedger(fakeHydrate, 'adaptive_score_ledger', now);
    await second.hydrate();
    expect(second.scoresFor('reasoning')).toEqual(rows);
  });
});
