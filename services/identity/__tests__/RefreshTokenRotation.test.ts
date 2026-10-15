// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: AuthService Refresh Rotation (S024-4A)
// End-to-end lifecycle via the REAL TokenService + an injected durable
// in-memory denylist: refresh rotates (old JTI single-use), replay is
// rejected, logout revokes the family, denylist outage fails closed.
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

describe('AuthService refresh rotation (S024-4A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHash.mockResolvedValue('hashed');
    mockVerify.mockResolvedValue(true);
  });

  it('rotation succeeds once; replay of the same refresh JTI is rejected', async () => {
    const user = makeUser();
    const repo = makeRepository(user);
    const denylist = new InMemoryRefreshTokenDenylistStore();
    const service = new AuthService(repo as never, mockEventPublisher as never, {
      refreshTokenDenylist: denylist,
    });

    const signIn = await service.signInWithEmail('rotate@example.com', 'password');
    expect(signIn.success).toBe(true);
    const rt1 = signIn.session!.tokens.refreshToken;

    const first = await service.refreshSession(rt1);
    expect(first).not.toBeNull();

    // Replay of the consumed JTI → null, no replacement pair issued.
    const replay = await service.refreshSession(rt1);
    expect(replay).toBeNull();
  });

  it('logout revokes the family: post-logout refresh is rejected', async () => {
    const user = makeUser();
    const repo = makeRepository(user);
    const denylist = new InMemoryRefreshTokenDenylistStore();
    const service = new AuthService(repo as never, mockEventPublisher as never, {
      refreshTokenDenylist: denylist,
    });

    const signIn = await service.signInWithEmail('rotate@example.com', 'password');
    const rt1 = signIn.session!.tokens.refreshToken;

    await service.signOut(user.id, rt1);

    expect(await service.refreshSession(rt1)).toBeNull();
    // Even a freshly-issued token for the same user cannot refresh after logout.
    const signIn2 = await service.signInWithEmail('rotate@example.com', 'password');
    expect(await service.refreshSession(signIn2.session!.tokens.refreshToken)).toBeNull();
    expect(mockPublishLoggedOut).toHaveBeenCalledWith(user.id);
  });

  it('denylist outage fails closed: refresh returns null, no token minted', async () => {
    const user = makeUser();
    const repo = makeRepository(user);
    const broken = {
      revoke: vi.fn().mockRejectedValue(new Error('db down')),
      isRevoked: vi.fn().mockRejectedValue(new Error('db down')),
      revokeForUser: vi.fn().mockRejectedValue(new Error('db down')),
      isUserRevoked: vi.fn().mockRejectedValue(new Error('db down')),
      cleanup: vi.fn(),
    };
    const service = new AuthService(repo as never, mockEventPublisher as never, {
      refreshTokenDenylist: broken as never,
    });

    const signIn = await service.signInWithEmail('rotate@example.com', 'password');
    // Denylist unreadable → refresh refused (null), not a fresh pair.
    expect(await service.refreshSession(signIn.session!.tokens.refreshToken)).toBeNull();
  });
});
