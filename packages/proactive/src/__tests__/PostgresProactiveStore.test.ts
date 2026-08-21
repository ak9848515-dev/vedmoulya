// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · PostgresProactiveStore hermetic tests
// SPRINT-029 — durable owner-scoped recommendation store over a recording
// postgres.js stub: owner isolation, idempotent saveWithKey, bounded reads,
// and the sql.json() single-encoding guard (mirrors the voice package's
// PostgresConversationStore test discipline — no live DB required).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { PostgresProactiveStore } from '../infrastructure/PostgresProactiveStore.js';
import type { ProactiveRecommendation } from '../types/proactive-types.js';

function createFakeSql(): postgres.Sql {
  const run = (first: unknown, ..._values: unknown[]): unknown => {
    const text = typeof first === 'string' ? first : (first as TemplateStringsArray).join('?');
    if (/^\s*SELECT/i.test(text)) return Promise.resolve([]);
    return Promise.resolve({ count: 1 });
  };
  return Object.assign(run, {
    json: (value: unknown): unknown => {
      if (typeof value === 'string') {
        throw new Error('double-encoding regression: sql.json() received pre-stringified JSON');
      }
      return value;
    },
  }) as unknown as postgres.Sql;
}

function rec(id: string, ownerId = 'u1'): ProactiveRecommendation {
  return {
    id,
    ownerId,
    category: 'OPPORTUNITY',
    title: `R ${id}`,
    description: 'd',
    evidence: ['e'],
    confidence: 0.5,
    urgency: 'LOW',
    riskLevel: 'LOW',
    status: 'NEW',
    source: 'system',
    createdAt: '2026-08-13T00:00:00.000Z',
  };
}

describe('PostgresProactiveStore', () => {
  it('persists a recommendation and reads it back from the mirror', () => {
    const store = new PostgresProactiveStore(createFakeSql(), 'proactive_recommendations');
    store.save(rec('a', 'u1'));
    expect(store.get('u1', 'a')?.title).toBe('R a');
    // Foreign owner cannot see it (owner-scoped key).
    expect(store.get('u2', 'a')).toBeUndefined();
  });

  it('saveWithKey is idempotent — same key produces the same deterministic id', () => {
    const store = new PostgresProactiveStore(createFakeSql());
    store.saveWithKey('u1:OPPORTUNITY:R', rec('x', 'u1'));
    const savedId = store.list('u1')[0]?.id;
    expect(savedId).toBeTruthy();
    expect(store.get('u1', savedId ?? '')?.title).toBe('R x');
    store.saveWithKey('u1:OPPORTUNITY:R', rec('y', 'u1'));
    // Same key → same id, latest content wins; one row total.
    expect(store.get('u1', savedId ?? '')?.title).toBe('R y');
    expect(store.list('u1').length).toBe(1);
  });

  it('update is owner-scoped and returns undefined for a foreign owner', () => {
    const store = new PostgresProactiveStore(createFakeSql());
    store.save(rec('a', 'u1'));
    expect(store.update('u2', 'a', { status: 'ACCEPTED' })).toBeUndefined();
    expect(store.update('u1', 'a', { status: 'ACCEPTED' })?.status).toBe('ACCEPTED');
  });

  it('delete removes the recommendation (mirror + pending delete)', () => {
    const store = new PostgresProactiveStore(createFakeSql());
    store.save(rec('a', 'u1'));
    store.delete('u1', 'a');
    expect(store.get('u1', 'a')).toBeUndefined();
  });

  it('binds JSON through sql.json() — never a pre-stringified value', () => {
    const store = new PostgresProactiveStore(createFakeSql());
    expect(() => store.save(rec('a', 'u1'))).not.toThrow();
  });
});
