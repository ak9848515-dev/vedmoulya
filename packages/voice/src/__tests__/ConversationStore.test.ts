// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · ConversationStore tests
// SPRINT-027 — Phase 5 · conversation foundation.
//
// Owner scoping · bounded history · retention · no cross-user leakage ·
// no promotion of conversation text into facts/preferences/learning.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryConversationStore } from '../infrastructure/InMemoryConversationStore.js';
import {
  MAX_CONVERSATIONS_PER_OWNER,
  MAX_TURN_TEXT_LENGTH,
  MAX_TURNS_PER_CONVERSATION,
  truncateText,
} from '../domain/ConversationPolicy.js';

function store(): InMemoryConversationStore {
  return new InMemoryConversationStore();
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

describe('owner scoping (no cross-user leakage)', () => {
  it('users cannot read or mutate another user conversation', () => {
    const s = store();
    const alice = s.create('alice', 'Goals');
    expect(s.get('bob', alice.id)).toBeUndefined();
    expect(s.append('bob', alice.id, turn('user', 'hi'))).toBeUndefined();
    expect(s.turns('bob', alice.id)).toEqual([]);
    s.clear('bob', alice.id);
    expect(s.get('alice', alice.id)).toBeDefined();
  });

  it('list is owner-filtered', () => {
    const s = store();
    s.create('alice');
    s.create('bob');
    expect(s.list('alice')).toHaveLength(1);
    expect(s.list('bob')).toHaveLength(1);
  });
});

describe('bounds + retention', () => {
  it('evicts the oldest conversations beyond the per-owner cap (FIFO)', () => {
    const s = store();
    const created = [];
    for (let i = 0; i < MAX_CONVERSATIONS_PER_OWNER + 5; i += 1) {
      created.push(s.create('alice', `c${i}`));
    }
    const remaining = s.list('alice');
    expect(remaining.length).toBe(MAX_CONVERSATIONS_PER_OWNER);
    // The oldest five were evicted.
    for (const old of created.slice(0, 5)) {
      expect(s.get('alice', old.id)).toBeUndefined();
    }
  });

  it('caps turns per conversation (oldest dropped at the cap)', () => {
    const s = store();
    const conv = s.create('alice');
    for (let i = 0; i < MAX_TURNS_PER_CONVERSATION + 10; i += 1) {
      s.append(
        'alice',
        conv.id,
        turn('user', `turn ${i}`, `2026-08-16T09:00:${String(i % 60).padStart(2, '0')}Z`),
      );
    }
    expect(s.turns('alice', conv.id).length).toBe(MAX_TURNS_PER_CONVERSATION);
    expect(s.turns('alice', conv.id)[0]?.text).toBe('turn 10');
  });

  it('truncates oversized turn text to the policy bound', () => {
    const s = store();
    const conv = s.create('alice');
    const long = 'x'.repeat(MAX_TURN_TEXT_LENGTH + 500);
    const record = s.append('alice', conv.id, turn('user', long));
    expect(record?.text.length).toBe(MAX_TURN_TEXT_LENGTH);
    expect(truncateText(long).length).toBe(MAX_TURN_TEXT_LENGTH);
  });

  it('clear removes only the owner conversation', () => {
    const s = store();
    const alice = s.create('alice');
    const bob = s.create('bob');
    s.clear('alice', alice.id);
    expect(s.get('alice', alice.id)).toBeUndefined();
    expect(s.get('bob', bob.id)).toBeDefined();
  });
});

describe('no promotion into facts/preferences/learning (structural contract)', () => {
  it('the store exposes no write path toward preference/learning/memory stores', () => {
    const s = store() as unknown as Record<string, unknown>;
    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(s));
    for (const forbidden of [
      'recordLearning',
      'recordOutcome',
      'recordPreference',
      'recordFact',
      'correctLearning',
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('conversation text is stored as an artifact with no fact semantics', () => {
    const s = store();
    const conv = s.create('alice');
    const record = s.append('alice', conv.id, turn('user', 'I prefer mornings'));
    expect(record?.text).toBe('I prefer mornings');
    // The turn carries provenance + ownership, not a fact/preference claim.
    expect(record).toMatchObject({ userId: 'alice', role: 'user' });
    expect(record).not.toHaveProperty('source');
    expect(record).not.toHaveProperty('confidence');
  });
});
