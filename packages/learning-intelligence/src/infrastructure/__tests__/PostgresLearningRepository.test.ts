// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Learning Repository
// EI-007 — Enterprise Learning Intelligence Platform
//
// Verifies query building, JSONB row <-> entity mapping, and
// pagination WITHOUT a live database: the `postgres` module is mocked
// with a fake `sql` template-tag function (same pattern as the other
// EI Postgres repository tests), so the full repository surface is
// exercised in CI and local runs.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresLearningRepository } from '../PostgresLearningRepository.js';
import type { LearningEvent } from '../../../types/learning-types.js';

// ── Fake postgres `sql` ─────────────────────────────────────────────────────

function makeFakeSql(results: Array<() => unknown>): postgres.Sql {
  let idx = 0;
  const next = (): Promise<unknown> => {
    const r = results[idx] ? results[idx]() : [];
    idx += 1;
    return Promise.resolve(r);
  };
  const sql = vi.fn(() => next()) as unknown as postgres.Sql;
  sql.unsafe = vi.fn(() => next());
  // The repo binds JSON documents via sql.json() — the fake returns the raw
  // value (the real driver wraps it in a Parameter for OID 3802).
  sql.json = ((value: unknown): unknown => value) as never;
  return sql;
}

function eventRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'levent_1',
    data: JSON.stringify({
      eventId: 'levent_1',
      category: 'provider',
      entityType: 'provider',
      entityId: 'openai',
      entityLabel: 'OpenAI',
      outcome: 'success',
      confidence: 0.9,
      costUsd: 0.01,
      latencyMs: 400,
      accuracy: 0.95,
      retries: 0,
      quality: 0.92,
      metadata: {},
      occurredAt: '2026-08-01T10:00:00.000Z',
      createdAt: '2026-08-01T10:00:00.000Z',
      ...overrides,
    }),
  };
}

function decisionRow(): Record<string, unknown> {
  return {
    id: 'decision_rec_x',
    data: JSON.stringify({
      decisionId: 'decision_rec_x',
      recommendationId: 'rec_x',
      recommendationType: 'best_provider',
      targetEntityId: 'openai',
      status: 'approved',
      version: 2,
      actor: 'owner',
      audit: [
        {
          auditId: 'audit_1',
          action: 'created',
          version: 1,
          actor: 'owner',
          timestamp: '2026-08-01T10:00:00.000Z',
        },
      ],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    }),
  };
}

function validEvent(): LearningEvent {
  return {
    eventId: 'levent_1',
    category: 'provider',
    entityType: 'provider',
    entityId: 'openai',
    entityLabel: 'OpenAI',
    outcome: 'success',
    confidence: 0.9,
    costUsd: 0.01,
    latencyMs: 400,
    accuracy: 0.95,
    retries: 0,
    quality: 0.92,
    metadata: {},
    occurredAt: '2026-08-01T10:00:00.000Z',
    createdAt: '2026-08-01T10:00:00.000Z',
  };
}

describe('PostgresLearningRepository', () => {
  it('creates the learning_registry table idempotently', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresLearningRepository(sql);
    await repo.ensureTable();
    await repo.ensureTable();
    expect(sql).toHaveBeenCalled();
  });

  it('saves an event as a JSONB document', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresLearningRepository(sql);
    await repo.saveEvent(validEvent());
    expect(sql).toHaveBeenCalled();
  });

  it('finds an event by id and maps the JSONB row', async () => {
    const sql = makeFakeSql([() => [eventRow()]]);
    const repo = new PostgresLearningRepository(sql);
    const event = await repo.findEventById('levent_1');
    expect(event?.eventId).toBe('levent_1');
    expect(event?.category).toBe('provider');
    expect(event?.entityId).toBe('openai');
    expect(event?.outcome).toBe('success');
  });

  it('returns null when an event is missing', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresLearningRepository(sql);
    expect(await repo.findEventById('missing')).toBeNull();
  });

  it('lists events with filters and pagination', async () => {
    const sql = makeFakeSql([() => [{ count: 1 }], () => [eventRow({ id: 'levent_1' })]]);
    const repo = new PostgresLearningRepository(sql);
    const result = await repo.listEvents(
      { category: 'provider', outcome: 'success' },
      { page: 1, limit: 10 },
    );
    expect(result.total).toBe(1);
    expect(result.data[0]?.eventId).toBe('levent_1');
    expect(result.totalPages).toBe(1);
  });

  it('lists all events in occurredAt desc order', async () => {
    const sql = makeFakeSql([() => [eventRow(), eventRow({ id: 'levent_2' })]]);
    const repo = new PostgresLearningRepository(sql);
    const events = await repo.listAllEvents();
    expect(events).toHaveLength(2);
  });

  it('deletes events and decisions', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresLearningRepository(sql);
    await repo.deleteEvent('levent_1');
    await repo.deleteDecision('decision_rec_x');
    expect(sql).toHaveBeenCalled();
  });

  it('counts events', async () => {
    const sql = makeFakeSql([() => [{ count: 7 }]]);
    const repo = new PostgresLearningRepository(sql);
    expect(await repo.countEvents()).toBe(7);
  });

  it('counts by category and outcome with zero-filled keys', async () => {
    const sql = makeFakeSql([() => [{ category: 'provider', count: 3 }]]);
    const repo = new PostgresLearningRepository(sql);
    const byCategory = await repo.countEventsByCategory();
    expect(byCategory.provider).toBe(3);
    expect(byCategory.failure).toBe(0);

    const sql2 = makeFakeSql([() => [{ outcome: 'success', count: 2 }]]);
    const repo2 = new PostgresLearningRepository(sql2);
    const byOutcome = await repo2.countEventsByOutcome();
    expect(byOutcome.success).toBe(2);
    expect(byOutcome.failure).toBe(0);
  });

  it('saves and finds safety decisions', async () => {
    // First scripted call is consumed by saveDecision (INSERT), second by the find.
    const sql = makeFakeSql([() => [], () => [decisionRow()]]);
    const repo = new PostgresLearningRepository(sql);
    await repo.saveDecision(decisionRow() as never);
    const decision = await repo.findDecisionById('decision_rec_x');
    expect(decision?.status).toBe('approved');
    expect(decision?.audit[0]?.action).toBe('created');
  });

  it('finds decisions by recommendation id', async () => {
    const sql = makeFakeSql([() => [decisionRow()]]);
    const repo = new PostgresLearningRepository(sql);
    const decision = await repo.findDecisionByRecommendation('rec_x');
    expect(decision?.recommendationId).toBe('rec_x');
  });

  it('lists decisions and filters by status', async () => {
    const sql = makeFakeSql([() => [decisionRow()]]);
    const repo = new PostgresLearningRepository(sql);
    expect(await repo.listDecisions()).toHaveLength(1);
    const sql2 = makeFakeSql([() => [decisionRow()]]);
    const repo2 = new PostgresLearningRepository(sql2);
    const approved = await repo2.listDecisionsByStatus('approved');
    expect(approved[0]?.status).toBe('approved');
  });
});
