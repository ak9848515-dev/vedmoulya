// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: OAuth state (server-side CSRF correlation)
//
// Pins the server-side state authority introduced to close the audit's P2
// gap: the identity service now mints the OAuth `state`, persists only its
// hash, and consumes it single-use. These tests exercise the primitives and
// the store implementations hermetically (no database).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  createOAuthState,
  hashOAuthState,
  OAUTH_STATE_BYTES,
  OAUTH_STATE_TTL_MS,
} from '../src/auth/OAuthState.js';
import {
  InMemoryOAuthStateStore,
  createOAuthStateStore,
} from '../src/infrastructure/persistence/OAuthStateStore.js';

describe('OAuth state value', () => {
  it('mints a high-entropy, URL-safe state with a matching hash and expiry', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const value = createOAuthState(now);

    // base64url of 32 random bytes → 43 characters, URL-safe, non-empty.
    expect(value.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(value.state).not.toContain('+');
    expect(value.state).not.toContain('/');
    expect(value.stateHash).toBe(hashOAuthState(value.state));
    expect(value.stateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(value.expiresAt.getTime()).toBe(now.getTime() + OAUTH_STATE_TTL_MS);
    expect(OAUTH_STATE_BYTES).toBe(32);
  });

  it('never repeats a state across calls (unpredictable nonce)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(createOAuthState().state);
    expect(seen.size).toBe(200);
  });

  it('hashes deterministically (sha256 hex) and never leaks the raw value', () => {
    const expected = createHash('sha256').update('raw-state-value').digest('hex');
    expect(hashOAuthState('raw-state-value')).toBe(expected);
    const value = createOAuthState();
    // The stored hash is not the raw state.
    expect(value.stateHash).not.toBe(value.state);
  });
});

describe('InMemoryOAuthStateStore — single-use semantics', () => {
  it('accepts an unconsumed, unexpired state exactly once', async () => {
    const store = new InMemoryOAuthStateStore();
    const { state, stateHash, expiresAt } = createOAuthState();
    await store.save(stateHash, expiresAt);

    expect(await store.consume(hashOAuthState(state))).toBe(true);
    // SECOND consumption of the SAME state is refused — replay protection.
    expect(await store.consume(hashOAuthState(state))).toBe(false);
  });

  it('refuses a state that was never issued', async () => {
    const store = new InMemoryOAuthStateStore();
    expect(await store.consume(hashOAuthState('never-issued'))).toBe(false);
  });

  it('refuses an expired state', async () => {
    const store = new InMemoryOAuthStateStore();
    const { state, stateHash } = createOAuthState();
    await store.save(stateHash, new Date(Date.now() - 1));
    expect(await store.consume(hashOAuthState(state))).toBe(false);
  });

  it('keeps distinct states independent', async () => {
    const store = new InMemoryOAuthStateStore();
    const a = createOAuthState();
    const b = createOAuthState();
    await store.save(a.stateHash, a.expiresAt);
    await store.save(b.stateHash, b.expiresAt);

    expect(await store.consume(a.stateHash)).toBe(true);
    // Consuming A must not consume B.
    expect(await store.consume(b.stateHash)).toBe(true);
  });
});

describe('createOAuthStateStore — environment selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the in-memory store outside production/staging', () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(createOAuthStateStore()).toBeInstanceOf(InMemoryOAuthStateStore);
  });

  it('uses the Postgres store in production (never in-memory)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const store = createOAuthStateStore();
    expect(store).not.toBeInstanceOf(InMemoryOAuthStateStore);
    expect(typeof (store as { ensureTable?: unknown }).ensureTable).toBe('function');
  });
});
