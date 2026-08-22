import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  InMemoryVerificationTokenStore,
  createVerificationEmailSender,
} from '../src/auth/VerificationEmailSender.js';
import {
  InMemoryVerificationTokenStore as InMemoryVTStore,
  createVerificationTokenStore,
} from '../src/infrastructure/persistence/VerificationTokenStore.js';

vi.mock('@vedmoulya/core', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
  }),
}));

describe('InMemoryVerificationTokenStore', () => {
  it('saves and finds a token', async () => {
    const store = new InMemoryVTStore();
    const expiresAt = new Date(Date.now() + 3600_000);
    await store.save('user-1', 'hash-abc', expiresAt);
    const found = await store.findByHash('hash-abc');
    expect(found).not.toBeNull();
    expect(found!.userId).toBe('user-1');
    expect(found!.consumedAt).toBeNull();
  });

  it('returns null for unknown hash', async () => {
    const store = new InMemoryVTStore();
    expect(await store.findByHash('unknown')).toBeNull();
  });

  it('marks a token as consumed', async () => {
    const store = new InMemoryVTStore();
    await store.save('user-2', 'hash-def', new Date());
    const found = await store.findByHash('hash-def');
    expect(found).not.toBeNull();
    await store.markConsumed(found!.id);
    const after = await store.findByHash('hash-def');
    expect(after!.consumedAt).not.toBeNull();
  });

  it('revokes all tokens for a user', async () => {
    const store = new InMemoryVTStore();
    // save with different users so both entries exist
    await store.save('user-3a', 'hash-1', new Date());
    await store.save('user-3b', 'hash-2', new Date());
    await store.revokeForUser('user-3a');
    await store.revokeForUser('user-3b');
    const r1 = await store.findByHash('hash-1');
    const r2 = await store.findByHash('hash-2');
    expect(r1!.consumedAt).not.toBeNull();
    expect(r2!.consumedAt).not.toBeNull();
  });

  it('upserts: saving for same user replaces the old token', async () => {
    const store = new InMemoryVTStore();
    await store.save('user-4', 'hash-old', new Date());
    await store.save('user-4', 'hash-new', new Date());
    expect(await store.findByHash('hash-old')).toBeNull();
    expect(await store.findByHash('hash-new')).not.toBeNull();
  });
});

describe('createVerificationTokenStore', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns in-memory store in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const store = createVerificationTokenStore();
    expect(store).toBeInstanceOf(InMemoryVTStore);
  });

  it('returns in-memory store when NODE_ENV is not set', () => {
    vi.stubEnv('NODE_ENV', undefined);
    const store = createVerificationTokenStore();
    expect(store).toBeInstanceOf(InMemoryVTStore);
  });
});
