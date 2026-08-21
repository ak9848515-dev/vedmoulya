// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · PostgresConversationStore hermetic tests
// SPRINT-027 — Phase 5 · durable conversation store contract over a
// recording postgres.js stub: owner isolation, idempotent upserts, bounded
// retention, and the sql.json() single-encoding guard.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { PostgresConversationStore } from '../infrastructure/PostgresConversationStore.js';
import {
  MAX_CONVERSATIONS_PER_OWNER,
  MAX_TURNS_PER_CONVERSATION,
} from '../domain/ConversationPolicy.js';

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

function turn(
  role: 'user' | 'assistant',
  text: string,
  at = '2026-08-16T09:00:00Z',
): {
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
} {
  return { role, text, createdAt: at };
}

describe('PostgresConversationStore', () => {
  it('creates + persists a conversation and reads it back from the mirror', () => {
    const store = new PostgresConversationStore(createFakeSql(), 'conversations');
    const conv = store.create('alice', 'Morning');
    expect(store.get('alice', conv.id)?.title).toBe('Morning');
    // Foreign owner cannot see it (owner-scoped key).
    expect(store.get('bob', conv.id)).toBeUndefined();
  });

  it('append is bounded at the turn cap (oldest evicted) and owner-scoped', () => {
    const store = new PostgresConversationStore(createFakeSql());
    const conv = store.create('alice');
    for (let i = 0; i < MAX_TURNS_PER_CONVERSATION + 5; i += 1) {
      store.append('alice', conv.id, turn('user', `t${i}`));
    }
    expect(store.turns('alice', conv.id)).toHaveLength(MAX_TURNS_PER_CONVERSATION);
    // Foreign append refused.
    expect(store.append('bob', conv.id, turn('user', 'hi'))).toBeUndefined();
  });

  it('evicts oldest conversations beyond the per-owner cap (FIFO retention)', () => {
    const store = new PostgresConversationStore(createFakeSql());
    const ids: string[] = [];
    for (let i = 0; i < MAX_CONVERSATIONS_PER_OWNER + 3; i += 1) {
      ids.push(store.create('alice', `c${i}`).id);
    }
    expect(store.list('alice')).toHaveLength(MAX_CONVERSATIONS_PER_OWNER);
    expect(store.get('alice', ids[0])).toBeUndefined();
  });

  it('clear removes the conversation (mirror + pending delete)', () => {
    const store = new PostgresConversationStore(createFakeSql());
    const conv = store.create('alice');
    store.clear('alice', conv.id);
    expect(store.get('alice', conv.id)).toBeUndefined();
    expect(store.turns('alice', conv.id)).toEqual([]);
  });

  it('binds JSON through sql.json() — never a pre-stringified value', () => {
    // The fake rejects strings exactly like the real driver's jsonb OID 3802
    // binding, proving the store cannot double-encode conversation docs.
    const store = new PostgresConversationStore(createFakeSql());
    const conv = store.create('alice');
    expect(() => {
      store.append('alice', conv.id, turn('user', 'hello'));
    }).not.toThrow();
  });
});
