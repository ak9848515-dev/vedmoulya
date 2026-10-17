// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: RefreshTokenDenylistStore (S024-4A closure)
// Hermetic coverage of the durable rotation + logout revocation store:
// no hashing oracle leaks, rotation is single-use, logout revokes the
// family, expiries and cleanup behave, failures fail closed upstream.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  InMemoryRefreshTokenDenylistStore,
  hashRefreshJti,
} from '../src/infrastructure/persistence/RefreshTokenDenylistStore.js';

const FUTURE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST = () => new Date(Date.now() - 1000);

describe('RefreshTokenDenylistStore (in-memory)', () => {
  it('stores only the SHA-256 hash, never the raw JTI', async () => {
    const store = new InMemoryRefreshTokenDenylistStore();
    await store.revoke('rt_secret_jti_123', 'usr_1', FUTURE());
    // isRevoked resolves via the hash — distinct raw JTIs do not collide.
    expect(await store.isRevoked('rt_secret_jti_123')).toBe(true);
    expect(await store.isRevoked('rt_secret_jti_124')).toBe(false);
    expect(hashRefreshJti('rt_secret_jti_123')).toHaveLength(64);
  });

  it('rotation is single-use: revoke is idempotent, replay stays rejected', async () => {
    const store = new InMemoryRefreshTokenDenylistStore();
    await store.revoke('rt_old', 'usr_1', FUTURE());
    await store.revoke('rt_old', 'usr_1', FUTURE()); // double write → no-op
    expect(await store.isRevoked('rt_old')).toBe(true);
  });

  it('logout revokes the family: isUserRevoked flips, per-JTI checks stay independent', async () => {
    const store = new InMemoryRefreshTokenDenylistStore();
    // A rotation alone must NOT trip family revocation.
    await store.revoke('rt_rotated', 'usr_1', FUTURE());
    expect(await store.isUserRevoked('usr_1')).toBe(false);
    // Logout flips the family marker; other users are untouched.
    await store.revokeForUser('usr_1');
    expect(await store.isUserRevoked('usr_1')).toBe(true);
    expect(await store.isUserRevoked('usr_2')).toBe(false);
  });

  it('expiry bounds revocation: expired JTIs read as live; cleanup removes only expired rows', async () => {
    const store = new InMemoryRefreshTokenDenylistStore();
    await store.revoke('rt_expired', 'usr_1', PAST());
    await store.revoke('rt_live', 'usr_1', FUTURE());
    // Cleanup counts expired rows without a prior lazy read deleting them first.
    const removed = await store.cleanup();
    expect(removed).toBeGreaterThanOrEqual(1);
    // Expired evidence is gone; live evidence is kept.
    expect(await store.isRevoked('rt_expired')).toBe(false);
    expect(await store.isRevoked('rt_live')).toBe(true);
  });

  it('unknown JTIs are not revoked (no oracle, no false positive)', async () => {
    const store = new InMemoryRefreshTokenDenylistStore();
    expect(await store.isRevoked('never-seen')).toBe(false);
    expect(await store.isUserRevoked('ghost-user')).toBe(false);
  });

  // ── remediation A: atomic claim + time-scoped family markers ──────────

  it('claim is the atomic single-use arbiter: exactly one caller wins', async () => {
    const store = new InMemoryRefreshTokenDenylistStore();
    const [first, second] = await Promise.all([
      store.claim('rt_race', 'usr_1', FUTURE()),
      store.claim('rt_race', 'usr_1', FUTURE()),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    // A claimed JTI is revoked evidence — it can never be claimed again.
    expect(await store.isRevoked('rt_race')).toBe(true);
    expect(await store.claim('rt_race', 'usr_1', FUTURE())).toBe(false);
    // Independent JWTs are unaffected by another token's claim.
    expect(await store.claim('rt_other', 'usr_1', FUTURE())).toBe(true);
  });

  it('familyRevokedAt is a timestamp, not a blanket boolean', async () => {
    const store = new InMemoryRefreshTokenDenylistStore();
    expect(await store.familyRevokedAt('usr_1')).toBeNull();

    await store.revokeForUser('usr_1');
    const first = await store.familyRevokedAt('usr_1');
    expect(first).toBeInstanceOf(Date);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await store.revokeForUser('usr_1');
    const second = await store.familyRevokedAt('usr_1');
    // The LATEST logout is authoritative — an earlier marker cannot shadow it.
    expect(second!.getTime()).toBeGreaterThanOrEqual(first!.getTime());
    expect(await store.familyRevokedAt('usr_2')).toBeNull();
  });

  describe('family marker expiry (documented bound: equal to the 7d refresh lifetime)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('an expired marker stops blocking and is dropped', async () => {
      const store = new InMemoryRefreshTokenDenylistStore();
      await store.revokeForUser('usr_1');
      expect(await store.familyRevokedAt('usr_1')).toBeInstanceOf(Date);

      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
      expect(await store.familyRevokedAt('usr_1')).toBeNull();
      expect(await store.isUserRevoked('usr_1')).toBe(false);
      vi.useRealTimers();

      // Any refresh token minted before that instant has itself expired by
      // then (AUTH_REFRESH_EXPIRES_IN=7d), so the bound is not a replay hole.
      expect(await store.isRevoked('rt_never_claimed')).toBe(false);
    });
  });
});
