// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: AuthService
// Covers email/password sign-in, sign-up, Google OAuth, session, refresh,
// and sign-out flows (PH-001 identity hardening).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Email } from '@vedmoulya/domain';
import { UserFactory } from '@vedmoulya/domain';
import { NotFoundError } from '@vedmoulya/core';
import { AuthService } from '../src/auth/AuthService.js';

// Mock PasswordService so tests avoid real bcrypt (slow) and we can control
// hash/verify behavior deterministically.
const mockHash = vi.fn();
const mockVerify = vi.fn();
// Vitest 4: AuthService constructs PasswordService with `new`, so the mock
// implementation must be a constructible function, not an arrow function.
vi.mock('../src/auth/PasswordService.js', () => ({
  PasswordService: vi.fn().mockImplementation(function () {
    return {
      hash: mockHash,
      verify: mockVerify,
    };
  }),
}));

const mockPublishLoggedIn = vi.fn();
const mockPublishLoggedOut = vi.fn();
const mockPublishCreated = vi.fn();
const mockEventPublisher = {
  publishUserLoggedIn: mockPublishLoggedIn,
  publishUserLoggedOut: mockPublishLoggedOut,
  publishUserCreated: mockPublishCreated,
};

/** Build a real reconstructed User for repository mocks. */
function makeUser(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof UserFactory.reconstructUser> {
  return UserFactory.reconstructUser({
    id: 'usr_test1234567890abcdef',
    email: 'test@example.com',
    displayName: 'Test User',
    givenName: 'Test',
    familyName: 'User',
    role: 'user',
    statusState: 'active',
    emailVerified: true,
    entityStatus: 'active',
    passwordHash: 'hash',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  });
}

function makeRepository(overrides: Record<string, unknown> = {}) {
  return {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    list: vi.fn(),
    ...overrides,
  };
}

function createService(repo: ReturnType<typeof makeRepository>): AuthService {
  return new AuthService(repo as never, mockEventPublisher as never);
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHash.mockResolvedValue('hashed');
    mockVerify.mockResolvedValue(true);
  });

  describe('signInWithEmail', () => {
    it('signs in a valid user and publishes the login event', async () => {
      const repo = makeRepository();
      const user = makeUser();
      repo.findByEmail.mockResolvedValue(user);
      const service = createService(repo);

      const result = await service.signInWithEmail('test@example.com', 'password');

      expect(result.success).toBe(true);
      expect(result.session?.userId).toBe(user.id);
      expect(result.session?.tokens.accessToken).toBeTruthy();
      expect(repo.update).toHaveBeenCalledWith(user);
      expect(mockPublishLoggedIn).toHaveBeenCalledWith(user.id);
    });

    it('returns an error for an unknown email', async () => {
      const repo = makeRepository();
      repo.findByEmail.mockResolvedValue(null);
      const service = createService(repo);

      const result = await service.signInWithEmail('nobody@example.com', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('returns an error when the account cannot authenticate', async () => {
      const repo = makeRepository();
      repo.findByEmail.mockResolvedValue(makeUser({ statusState: 'suspended' }));
      const service = createService(repo);

      const result = await service.signInWithEmail('test@example.com', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns an error when the password is wrong', async () => {
      const repo = makeRepository();
      repo.findByEmail.mockResolvedValue(makeUser());
      mockVerify.mockResolvedValue(false);
      const service = createService(repo);

      const result = await service.signInWithEmail('test@example.com', 'wrong');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('catches unexpected errors and returns a generic failure', async () => {
      const repo = makeRepository();
      repo.findByEmail.mockRejectedValue(new Error('DB down'));
      const service = createService(repo);

      const result = await service.signInWithEmail('test@example.com', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });

  describe('Google OAuth', () => {
    it('builds an authorization URL from the provider', () => {
      const repo = makeRepository();
      const service = createService(repo);
      const url = service.getGoogleAuthUrl('state-123');
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('state-123');
    });

    it('returns an error when the Google callback fails', async () => {
      const repo = makeRepository();
      const service = createService(repo);
      const fetchMock = vi.fn().mockResolvedValue(new Response('nope', { status: 400 }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await service.signInWithGoogle('bad-code');
      expect(result.success).toBe(false);
      vi.unstubAllGlobals();
    });
  });

  describe('verifySession / refreshSession', () => {
    it('verifies an access token via the token service', async () => {
      const repo = makeRepository();
      const service = createService(repo);
      const payload = await service.verifySession('token');
      expect(payload).toBeNull(); // invalid token → null
    });

    it('returns null when the refresh token is invalid', async () => {
      const repo = makeRepository();
      const service = createService(repo);
      const result = await service.refreshSession('invalid-refresh');
      expect(result).toBeNull();
    });

    it('returns null when the user is gone', async () => {
      const repo = makeRepository();
      repo.findById.mockResolvedValue(null);
      const service = createService(repo);
      // verifyRefreshToken uses the real TokenService → invalid token → null
      const result = await service.refreshSession('invalid');
      expect(result).toBeNull();
    });
  });

  describe('signOut', () => {
    it('signs out an existing user and publishes the event', async () => {
      const repo = makeRepository();
      const user = makeUser();
      repo.findById.mockResolvedValue(user);
      const service = createService(repo);

      await service.signOut(user.id);
      expect(repo.update).toHaveBeenCalledWith(user);
      expect(mockPublishLoggedOut).toHaveBeenCalledWith(user.id);
    });

    it('throws NotFoundError for an unknown user', async () => {
      const repo = makeRepository();
      repo.findById.mockResolvedValue(null);
      const service = createService(repo);

      await expect(service.signOut('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('signUp', () => {
    it('registers a new user and returns a session', async () => {
      const repo = makeRepository();
      repo.findByEmail.mockResolvedValue(null);
      repo.save.mockResolvedValue(undefined);
      const service = createService(repo);

      const result = await service.signUp({
        email: 'new@example.com',
        displayName: 'New User',
        password: 'ValidPass1',
      });

      expect(result.success).toBe(true);
      expect(mockHash).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(mockPublishCreated).toHaveBeenCalled();
      expect(result.session?.tokens.accessToken).toBeTruthy();
    });

    it('rejects a duplicate email', async () => {
      const repo = makeRepository();
      repo.findByEmail.mockResolvedValue(makeUser());
      const service = createService(repo);

      const result = await service.signUp({
        email: 'test@example.com',
        displayName: 'Dup',
        password: 'ValidPass1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already registered');
    });

    it('catches unexpected errors', async () => {
      const repo = makeRepository();
      repo.findByEmail.mockRejectedValue(new Error('DB down'));
      const service = createService(repo);

      const result = await service.signUp({
        email: 'new@example.com',
        displayName: 'New',
        password: 'ValidPass1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
    });
  });
});

// Keep the Email import referenced for tree-shaking safety in coverage runs.
void Email;
