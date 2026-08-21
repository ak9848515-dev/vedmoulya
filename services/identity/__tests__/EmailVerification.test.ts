// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Email Verification Flow
// SPRINT-045 — PRODUCTION EMAIL VERIFICATION
// Covers the production lifecycle: sign-up requires verification (no session
// issued, email sent with a link), verify-email consumes the token, expired /
// replayed / unknown tokens are rejected, resend is enumeration-free, and an
// unverified account stays blocked from sign-in while a verified one signs in.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Email } from '@vedmoulya/domain';
import { UserFactory } from '@vedmoulya/domain';
import {
  AuthService,
  type VerificationEmailSender,
  type VerificationEmail,
  InMemoryVerificationTokenStore,
  createVerificationToken,
  hashVerificationToken,
} from '../src/index.js';

const mockHash = vi.fn();
const mockVerify = vi.fn();
vi.mock('../src/auth/PasswordService.js', () => ({
  PasswordService: vi.fn().mockImplementation(function () {
    return { hash: mockHash, verify: mockVerify };
  }),
}));

const mockPublishLoggedIn = vi.fn();
const mockPublishEmailVerified = vi.fn();
const mockEventPublisher = {
  publishUserLoggedIn: mockPublishLoggedIn,
  publishUserEmailVerified: mockPublishEmailVerified,
  publishUserCreated: vi.fn(),
  publishUserLoggedOut: vi.fn(),
};

/** Captures the emailed verification link (test double for the sender port). */
class CapturingEmailSender implements VerificationEmailSender {
  sent: VerificationEmail[] = [];
  async sendVerificationEmail(message: VerificationEmail): Promise<void> {
    this.sent.push(message);
  }
}

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
    statusState: 'pending',
    emailVerified: false,
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

function createService(
  repo: ReturnType<typeof makeRepository>,
  store: InMemoryVerificationTokenStore,
  sender: CapturingEmailSender,
): AuthService {
  return new AuthService(repo as never, mockEventPublisher as never, {
    verificationTokenStore: store,
    emailSender: sender,
  });
}

/** Extract the raw token from an emailed verification link. */
function tokenFromLink(link: string): string {
  const url = new URL(link);
  const token = url.searchParams.get('token');
  if (!token) throw new Error('No token in link');
  return token;
}

describe('AuthService email verification', () => {
  let repo: ReturnType<typeof makeRepository>;
  let store: InMemoryVerificationTokenStore;
  let sender: CapturingEmailSender;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_URL', 'https://app.vedmoulya.com');
    // The core config fail-fast requires non-localhost URLs + real secrets
    // outside NODE_ENV=development (the production guard) — stub them for the
    // suite; AI is disabled so provider keys are not required.
    vi.stubEnv('IDENTITY_DATABASE_URL', 'postgres://user:pass@db.test.internal:5432/vedmoulya');
    vi.stubEnv('REDIS_URL', 'redis://user:pass@redis.test.internal:6379');
    vi.stubEnv('AUTH_JWT_SECRET', 'test-jwt-secret-0123456789abcdef0123456789abcdef');
    vi.stubEnv('FF_AI_ASSISTANT_ENABLED', 'false');
    vi.stubEnv('FF_SOCIAL_LOGIN_ENABLED', 'false');
    // Unset the shell-injected dev placeholder keys — production config refuses
    // any placeholder value even for optional keys.
    vi.stubEnv('AI_OPENAI_API_KEY', undefined);
    vi.stubEnv('AI_ANTHROPIC_API_KEY', undefined);
    vi.stubEnv('AI_GOOGLE_API_KEY', undefined);
    vi.stubEnv('AI_DEEPSEEK_API_KEY', undefined);
    mockHash.mockResolvedValue('hashed');
    mockVerify.mockResolvedValue(true);
    repo = makeRepository();
    store = new InMemoryVerificationTokenStore();
    sender = new CapturingEmailSender();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('production sign-up requires verification: no session, email sent with a link', async () => {
    const service = createService(repo, store, sender);
    repo.save.mockResolvedValue(undefined);

    const result = await service.signUp({
      email: 'test@example.com',
      displayName: 'Test User',
      password: 'Secret123',
    });

    expect(result.success).toBe(true);
    expect(result.verificationRequired).toBe(true);
    expect(result.session).toBeUndefined();
    expect(repo.save).toHaveBeenCalled();
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].to).toBe('test@example.com');
    expect(sender.sent[0].verificationLink).toContain(
      'https://app.vedmoulya.com/verify-email?token=',
    );

    // The stored record is the HASH — never the raw token: the raw token can
    // verify (hash lookup succeeds) but is never what was persisted.
    const rawToken = tokenFromLink(sender.sent[0].verificationLink);
    const stored = await store.findByHash(hashVerificationToken(rawToken));
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).not.toBe(rawToken);
  });

  it('verifies a valid token: consumes it and marks the user verified', async () => {
    const user = makeUser();
    repo.findById.mockResolvedValue(user);
    repo.update.mockResolvedValue(undefined);
    const service = createService(repo, store, sender);

    const issued = createVerificationToken();
    await store.save(user.id, issued.tokenHash, issued.expiresAt);

    const result = await service.verifyEmail(issued.token);
    expect(result).toEqual({ success: true });
    expect(user.status.emailVerified).toBe(true);
    expect(repo.update).toHaveBeenCalled();
    expect(mockPublishEmailVerified).toHaveBeenCalled();
    // One-time use: the same token is now rejected as already verified.
    const replay = await service.verifyEmail(issued.token);
    expect(replay).toEqual({ success: false, error: 'already-verified' });
  });

  it('rejects unknown, expired, and replayed tokens', async () => {
    const user = makeUser();
    repo.findById.mockResolvedValue(user);
    const service = createService(repo, store, sender);

    // Unknown token (never issued) → invalid.
    const unknown = await service.verifyEmail('no-such-token-abcdefghijklmnop');
    expect(unknown).toEqual({ success: false, error: 'invalid' });

    // Expired token → expired.
    const expired = createVerificationToken(new Date(Date.now() - 48 * 60 * 60 * 1000));
    await store.save(user.id, expired.tokenHash, expired.expiresAt);
    const expiredResult = await service.verifyEmail(expired.token);
    expect(expiredResult).toEqual({ success: false, error: 'expired' });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('dev/test sign-up stays auto-verified and returns a session (unchanged)', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const service = createService(repo, store, sender);
    repo.save.mockResolvedValue(undefined);

    const result = await service.signUp({
      email: 'test@example.com',
      displayName: 'Test User',
      password: 'Secret123',
    });

    expect(result.success).toBe(true);
    expect(result.verificationRequired).toBeUndefined();
    expect(result.session?.tokens).toBeDefined();
    expect(sender.sent).toHaveLength(0);
  });

  it('resend is enumeration-free and reissues a fresh token', async () => {
    const user = makeUser();
    repo.findByEmail.mockResolvedValue(null); // fresh sign-up: no duplicate
    repo.save.mockResolvedValue(undefined);
    const service = createService(repo, store, sender);

    const first = await service.signUp({
      email: 'test@example.com',
      displayName: 'Test User',
      password: 'Secret123',
    });
    expect(first.success).toBe(true);
    const firstToken = tokenFromLink(sender.sent[0].verificationLink);

    // Resend targets the registered user.
    repo.findByEmail.mockResolvedValue(user);
    const resend = await service.resendVerificationEmail('test@example.com');
    expect(resend).toEqual({ success: true });
    expect(sender.sent).toHaveLength(2);

    // The new link carries a DIFFERENT token; the old one is revoked and is
    // now indistinguishable from an unknown token (no oracle for the caller).
    const secondToken = tokenFromLink(sender.sent[1].verificationLink);
    expect(secondToken).not.toBe(firstToken);
    expect(await service.verifyEmail(firstToken)).toEqual({ success: false, error: 'invalid' });
  });

  it('resend does not reveal whether an email is registered', async () => {
    repo.findByEmail.mockResolvedValue(null); // unknown email
    const service = createService(repo, store, sender);
    const result = await service.resendVerificationEmail('ghost@example.com');
    expect(result).toEqual({ success: true });
    expect(sender.sent).toHaveLength(0);
  });

  it('blocks sign-in for an unverified account and allows it after verification', async () => {
    const unverified = makeUser(); // pending + unverified
    repo.findByEmail.mockResolvedValue(unverified);
    const service = createService(repo, store, sender);

    const blocked = await service.signInWithEmail('test@example.com', 'Secret123');
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain('Email not verified');

    // Verify, then sign-in succeeds.
    unverified.verifyEmail();
    unverified.recordLogin?.();
    repo.update.mockResolvedValue(undefined);
    repo.findByEmail.mockResolvedValue(unverified);
    const allowed = await service.signInWithEmail('test@example.com', 'Secret123');
    expect(allowed.success).toBe(true);
    expect(allowed.session?.tokens).toBeDefined();
  });
});
