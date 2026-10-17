// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: AuthService Refresh Rotation (S024-4A)
// End-to-end lifecycle via the REAL TokenService + an injected durable
// in-memory denylist: refresh rotates (old JTI single-use), replay is
// rejected, logout revokes the session family, denylist outage fails
// closed — and (remediation A) a legitimate sign-in AFTER logout gets a
// working session while pre-logout tokens stay dead.
//
// The family marker is TIME-SCOPED, and refresh-token `iat` claims have
// second resolution, so a token minted in the SAME wall-clock second as a
// logout is indistinguishable from one minted by a sign-in in that second.
// The tests therefore space logout and re-sign-in by >1s, matching the
// documented bound (see RELEASE-CANDIDATE-VERIFICATION / status doc).
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../src/auth/AuthService.js';
import { UserFactory } from '@vedmoulya/domain';
import { InMemoryRefreshTokenDenylistStore } from '../src/infrastructure/persistence/RefreshTokenDenylistStore.js';

const mockHash = vi.fn();
const mockVerify = vi.fn();
vi.mock('../src/auth/PasswordService.js', () => ({
  PasswordService: vi.fn().mockImplementation(function () {
    return { hash: mockHash, verify: mockVerify };
  }),
}));

const mockPublishLoggedIn = vi.fn();
const mockPublishLoggedOut = vi.fn();
const mockEventPublisher = {
  publishUserLoggedIn: mockPublishLoggedIn,
  publishUserLoggedOut: mockPublishLoggedOut,
  publishUserCreated: vi.fn(),
};

function makeUser() {
  return UserFactory.reconstructUser({
    id: 'usr_rotation1234567890ab',
    email: 'rotate@example.com',
    displayName: 'Rotate User',
    givenName: 'Rotate',
    familyName: 'User',
    role: 'user',
    statusState: 'active',
    emailVerified: true,
    entityStatus: 'active',
    passwordHash: 'hash',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
  });
}

function makeRepository(user: ReturnType<typeof makeUser>) {
  return {
    findByEmail: vi.fn().mockResolvedValue(user),
    findByGoogleId: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(user),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    list: vi.fn(),
  };
}

function makeService(denylist: unknown, user = makeUser()) {
  const repo = makeRepository(user);
  const service = new AuthService(repo as never, mockEventPublisher as never, {
    refreshTokenDenylist: denylist as never,
  });
  return { service, repo };
}

/** Refresh claims have second resolution — step past the logout second. */
const pastLogoutSecond = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1_100));

describe('AuthService refresh rotation (S024-4A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHash.mockResolvedValue('hashed');
    mockVerify.mockResolvedValue(true);
  });

  it('rotation succeeds once; replay of the same refresh JTI is rejected', async () => {
    const denylist = new InMemoryRefreshTokenDenylistStore();
    const { service } = makeService(denylist);

    const signIn = await service.signInWithEmail('rotate@example.com', 'password');
    expect(signIn.success).toBe(true);
    const rt1 = signIn.session!.tokens.refreshToken;

    const first = await service.refreshSession(rt1);
    expect(first).not.toBeNull();

    // Replay of the consumed JTI → null, no replacement pair issued.
    const replay = await service.refreshSession(rt1);
    expect(replay).toBeNull();
  });

  it('logout revokes the family: the pre-logout token cannot refresh', async () => {
    const denylist = new InMemoryRefreshTokenDenylistStore();
    const { service } = makeService(denylist);
    const user = makeUser();

    const signIn = await service.signInWithEmail('rotate@example.com', 'password');
    const rt1 = signIn.session!.tokens.refreshToken;

    await service.signOut(user.id, rt1);

    expect(await service.refreshSession(rt1)).toBeNull();
    expect(mockPublishLoggedOut).toHaveBeenCalledWith(user.id);
  });

  it('REGRESSION (remediation A): a legitimate sign-in after logout CAN refresh', async () => {
    const denylist = new InMemoryRefreshTokenDenylistStore();
    const { service } = makeService(denylist);
    const user = makeUser();

    const first = await service.signInWithEmail('rotate@example.com', 'password');
    await service.signOut(user.id, first.session!.tokens.refreshToken);

    // The previous behaviour rejected this for the marker's whole 7-day life.
    await pastLogoutSecond();
    const second = await service.signInWithEmail('rotate@example.com', 'password');
    expect(second.success).toBe(true);

    const refreshed = await service.refreshSession(second.session!.tokens.refreshToken);
    expect(refreshed).not.toBeNull();
    expect(refreshed!.tokens.refreshToken).toBeTruthy();
  });

  it('SECURITY: re-signing in does NOT resurrect a pre-logout token', async () => {
    const denylist = new InMemoryRefreshTokenDenylistStore();
    const { service } = makeService(denylist);
    const user = makeUser();

    // Two sessions exist before logout (e.g. two devices).
    const deviceA = await service.signInWithEmail('rotate@example.com', 'password');
    const deviceB = await service.signInWithEmail('rotate@example.com', 'password');
    const rtA = deviceA.session!.tokens.refreshToken;
    const rtB = deviceB.session!.tokens.refreshToken;
    expect(rtA).not.toEqual(rtB);

    await service.signOut(user.id, rtA);
    await pastLogoutSecond();
    const afterLogout = await service.signInWithEmail('rotate@example.com', 'password');

    // The explicitly presented token is dead (per-JTI revocation).
    expect(await service.refreshSession(rtA)).toBeNull();
    // The other pre-logout token is dead too (family time-scope).
    expect(await service.refreshSession(rtB)).toBeNull();
    // The post-logout sign-in is a NEW family and refreshes normally.
    expect(await service.refreshSession(afterLogout.session!.tokens.refreshToken)).not.toBeNull();
  });

  it('concurrent rotation of one token yields exactly one session, never two', async () => {
    const denylist = new InMemoryRefreshTokenDenylistStore();
    const { service } = makeService(denylist);

    const signIn = await service.signInWithEmail('rotate@example.com', 'password');
    const rt1 = signIn.session!.tokens.refreshToken;

    // Both callers pass the pre-checks in the same tick; only the atomic
    // claim decides the winner, so a single token can never mint two pairs.
    const [a, b] = await Promise.all([service.refreshSession(rt1), service.refreshSession(rt1)]);
    const successes = [a, b].filter((r) => r !== null);
    expect(successes).toHaveLength(1);
  });

  it('a malformed or non-refresh token fails closed', async () => {
    const denylist = new InMemoryRefreshTokenDenylistStore();
    const { service } = makeService(denylist);

    expect(await service.refreshSession('not-a-jwt')).toBeNull();
    expect(await service.refreshSession('')).toBeNull();
  });

  it('denylist outage fails closed: refresh returns null, no token minted', async () => {
    const broken = {
      claim: vi.fn().mockRejectedValue(new Error('db down')),
      revoke: vi.fn().mockRejectedValue(new Error('db down')),
      isRevoked: vi.fn().mockRejectedValue(new Error('db down')),
      revokeForUser: vi.fn().mockRejectedValue(new Error('db down')),
      familyRevokedAt: vi.fn().mockRejectedValue(new Error('db down')),
      isUserRevoked: vi.fn().mockRejectedValue(new Error('db down')),
      cleanup: vi.fn(),
    };
    const { service } = makeService(broken);

    const signIn = await service.signInWithEmail('rotate@example.com', 'password');
    // Denylist unreadable → refresh refused (null), not a fresh pair.
    expect(await service.refreshSession(signIn.session!.tokens.refreshToken)).toBeNull();
  });

  it('a storage failure while CLAIMING also fails closed', async () => {
    // Reads work (no family marker, JTI not revoked) but the atomic claim
    // write fails → no pair may be minted.
    const halfBroken = {
      claim: vi.fn().mockRejectedValue(new Error('write failed')),
      revoke: vi.fn(),
      isRevoked: vi.fn().mockResolvedValue(false),
      revokeForUser: vi.fn(),
      familyRevokedAt: vi.fn().mockResolvedValue(null),
      isUserRevoked: vi.fn().mockResolvedValue(false),
      cleanup: vi.fn(),
    };
    const { service } = makeService(halfBroken);

    const signIn = await service.signInWithEmail('rotate@example.com', 'password');
    expect(await service.refreshSession(signIn.session!.tokens.refreshToken)).toBeNull();
  });
});
