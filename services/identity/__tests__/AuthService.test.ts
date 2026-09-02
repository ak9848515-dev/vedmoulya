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
    findByGoogleId: vi.fn().mockResolvedValue(null),
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

    // ── Account linking / duplicate prevention (secure identity rules) ──
    function stubGoogleProfile(profile: Record<string, unknown>): void {
      const fetchMock = vi.fn(async (url: string | URL | Request) => {
        if (String(url).includes('oauth2.googleapis.com/token')) {
          return new Response(JSON.stringify({ access_token: 'google-access-token' }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify(profile), { status: 200 });
      });
      vi.stubGlobal('fetch', fetchMock);
    }

    it('links a Google identity into an existing verified password account WITHOUT creating a duplicate', async () => {
      const repo = makeRepository();
      const user = makeUser(); // verified email/password account
      repo.findByEmail.mockResolvedValue(user);
      const service = createService(repo);
      stubGoogleProfile({
        id: 'g-1',
        email: 'test@example.com',
        verified_email: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
      });

      const result = await service.signInWithGoogle('good-code');

      expect(result.success).toBe(true);
      expect(result.session?.userId).toBe(user.id);
      // Same identity resolved — never a second account.
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(user);
      expect(mockPublishLoggedIn).toHaveBeenCalledWith(user.id);
      vi.unstubAllGlobals();
    });

    it('fills missing profile fields and verifies an unverified email when linking', async () => {
      const repo = makeRepository();
      const user = makeUser({ givenName: '', familyName: '', emailVerified: false });
      repo.findByEmail.mockResolvedValue(user);
      const service = createService(repo);
      stubGoogleProfile({
        id: 'g-2',
        email: 'test@example.com',
        verified_email: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
      });

      const result = await service.signInWithGoogle('good-code');

      expect(result.success).toBe(true);
      expect(user.profile.givenName).toBe('Test');
      expect(user.profile.familyName).toBe('User');
      expect(user.status.emailVerified).toBe(true);
      expect(repo.save).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('resolves the existing Google-provisioned account instead of duplicating it', async () => {
      const repo = makeRepository();
      const googleUser = makeUser({ passwordHash: '' }); // created by an earlier Google signup
      repo.findByEmail.mockResolvedValue(googleUser);
      const service = createService(repo);
      stubGoogleProfile({
        id: 'g-3',
        email: 'test@example.com',
        verified_email: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
      });

      const result = await service.signInWithGoogle('good-code');

      expect(result.success).toBe(true);
      expect(result.session?.userId).toBe(googleUser.id);
      expect(repo.save).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('REFUSES to link an unverified Google email into an existing account (takeover protection)', async () => {
      const repo = makeRepository();
      const user = makeUser();
      repo.findByEmail.mockResolvedValue(user);
      const service = createService(repo);
      stubGoogleProfile({
        id: 'g-4',
        email: 'test@example.com',
        verified_email: false,
        name: 'Impostor',
        given_name: 'Impostor',
        family_name: 'Claim',
      });

      const result = await service.signInWithGoogle('good-code');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/did not verify/i);
      // No linking, no enrichment, no session.
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(mockPublishLoggedIn).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('REFUSES to create an account from an unverified Google email', async () => {
      const repo = makeRepository();
      repo.findByEmail.mockResolvedValue(null);
      const service = createService(repo);
      stubGoogleProfile({
        id: 'g-5',
        email: 'new@example.com',
        verified_email: false,
        name: 'New User',
        given_name: 'New',
        family_name: 'User',
      });

      const result = await service.signInWithGoogle('good-code');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/did not verify/i);
      expect(repo.save).not.toHaveBeenCalled();
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

    it('verifies the new email in development/test (local runtime closure)', async () => {
      const repo = makeRepository();
      repo.findByEmail.mockResolvedValue(null);
      const service = createService(repo);

      const result = await service.signUp({
        email: 'local@example.com',
        displayName: 'Local Founder',
        password: 'ValidPass1',
      });

      expect(result.success).toBe(true);
      const saved = repo.save.mock.calls[0]?.[0] as { status: { emailVerified: boolean } };
      expect(saved.status.emailVerified).toBe(true);
    });

    it('leaves the email unverified in production/staging (safeguard unchanged)', async () => {
      const repo = makeRepository();
      repo.findByEmail.mockResolvedValue(null);
      const service = createService(repo);
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const result = await service.signUp({
          email: 'prod@example.com',
          displayName: 'Prod User',
          password: 'ValidPass1',
        });

        expect(result.success).toBe(true);
        const saved = repo.save.mock.calls[0]?.[0] as { status: { emailVerified: boolean } };
        expect(saved.status.emailVerified).toBe(false);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
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

  // ── SPRINT-041B — first-login profile completion in sessions ────────────

  describe('first-login profile completion (SPRINT-041B)', () => {
    it('sign-up session reports profileComplete=false for a brand-new user', async () => {
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
      expect(result.session?.displayName).toBe('New User');
      expect(result.session?.profileComplete).toBe(false);
    });

    it('sign-in session reports profileComplete=true once the profile is complete', async () => {
      const repo = makeRepository();
      const user = makeUser({
        age: 30,
        gender: 'female',
        purpose: 'learning',
        primaryGoal: 'Master TS',
      });
      repo.findByEmail.mockResolvedValue(user);
      const service = createService(repo);

      const result = await service.signInWithEmail('test@example.com', 'password');
      expect(result.success).toBe(true);
      expect(result.session?.profileComplete).toBe(true);
    });

    it('getProfile returns the stored profile with the derived completion state', async () => {
      const repo = makeRepository();
      const user = makeUser({
        age: 30,
        gender: 'male',
        purpose: 'business',
        primaryGoal: 'Launch a service',
      });
      repo.findById.mockResolvedValue(user);
      const service = createService(repo);

      const profile = await service.getProfile(user.id);
      expect(profile.userId).toBe(user.id);
      expect(profile.age).toBe(30);
      expect(profile.gender).toBe('male');
      expect(profile.purpose).toBe('business');
      expect(profile.primaryGoal).toBe('Launch a service');
      expect(profile.profileComplete).toBe(true);
    });

    it('getProfile throws NotFoundError for an unknown user', async () => {
      const repo = makeRepository();
      repo.findById.mockResolvedValue(null);
      const service = createService(repo);
      await expect(service.getProfile('missing')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('updateProfile persists through the domain entity and returns completion', async () => {
      const repo = makeRepository();
      const user = makeUser();
      repo.findById.mockResolvedValue(user);
      const service = createService(repo);

      const profile = await service.updateProfile(user.id, {
        age: 25,
        gender: 'non_binary',
        purpose: 'career',
        primaryGoal: 'Become a senior engineer',
      });

      expect(repo.update).toHaveBeenCalled();
      expect(profile.profileComplete).toBe(true);
      expect(profile.age).toBe(25);
      expect(profile.primaryGoal).toBe('Become a senior engineer');
      // The repository received the updated entity (verifies no direct DB writes
      // and that the domain entity is the write path).
      const saved = repo.update.mock.calls[0]?.[0] as { profile: { isComplete(): boolean } };
      expect(saved.profile.isComplete()).toBe(true);
    });

    it('updateProfile leaves completion false when required fields are missing', async () => {
      const repo = makeRepository();
      const user = makeUser();
      repo.findById.mockResolvedValue(user);
      const service = createService(repo);

      const profile = await service.updateProfile(user.id, { displayName: 'Renamed' });
      expect(profile.displayName).toBe('Renamed');
      expect(profile.profileComplete).toBe(false);
    });
  });
});

// Keep the Email import referenced for tree-shaking safety in coverage runs.
void Email;
