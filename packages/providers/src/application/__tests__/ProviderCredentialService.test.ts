// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ProviderCredentialService (PROVIDER-01, Decisions 3 & 4)
//
// Pins the credential lifecycle the API depends on:
//   store() / rotate() / resolve() / hasCredential() / delete() / metadata()
// and the documented resolution order: user credential → platform → none,
// with the caller ALWAYS told which source answered.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ProviderCredentialService } from '../ProviderCredentialService.js';
import { createProviderCredentialCipher } from '../../domain/credentials/credential-cipher.js';
import { InMemoryProviderCredentialStore } from '../../infrastructure/InMemoryProviderCredentialStore.js';

const KEY = 'deployment-secret-with-enough-entropy-01';
const USER_KEY = 'user-supplied-gemini-key-abcdef';
const PLATFORM_KEY = 'platform-managed-gemini-key-abcdef';

function service(): ProviderCredentialService {
  return new ProviderCredentialService(
    new InMemoryProviderCredentialStore(),
    createProviderCredentialCipher(KEY),
  );
}

describe('ProviderCredentialService — lifecycle', () => {
  it('stores a credential and reports metadata with no material', async () => {
    const svc = service();
    const meta = await svc.store('u1', 'google', USER_KEY);

    expect(meta.source).toBe('USER');
    expect(meta.family).toBe('google');
    expect(meta.userId).toBe('u1');
    expect(JSON.stringify(meta)).not.toContain(USER_KEY);
    await expect(svc.hasCredential('u1', 'google')).resolves.toBe(true);
    await expect(svc.hasCredential('u2', 'google')).resolves.toBe(false);
  });

  it('rejects a blank credential instead of persisting an unusable one', async () => {
    const svc = service();
    await expect(svc.store('u1', 'google', '   ')).rejects.toThrow(/blank/i);
    await expect(svc.hasCredential('u1', 'google')).resolves.toBe(false);
  });

  it('rotate() replaces the sealed payload (fresh IV) and keeps one record', async () => {
    const store = new InMemoryProviderCredentialStore();
    const svc = new ProviderCredentialService(store, createProviderCredentialCipher(KEY));

    const before = await svc.store('u1', 'google', USER_KEY);
    const after = await svc.rotate('u1', 'google', 'a-different-user-key-0001');

    expect(after.updatedAt >= before.updatedAt).toBe(true);
    await expect(svc.listFamilies('u1')).resolves.toEqual(['google']);
    await expect(svc.resolve('u1', 'google')).resolves.toEqual({
      source: 'USER',
      secret: 'a-different-user-key-0001',
    });
  });

  it('delete() forgets the credential', async () => {
    const svc = service();
    await svc.store('u1', 'google', USER_KEY);
    await svc.delete('u1', 'google');
    await expect(svc.hasCredential('u1', 'google')).resolves.toBe(false);
    await expect(svc.metadata('u1', 'google')).resolves.toBeNull();
  });

  it('metadata() is null when nothing is stored', async () => {
    await expect(service().metadata('u1', 'openai')).resolves.toBeNull();
  });
});

describe('ProviderCredentialService.resolve — user → platform → none', () => {
  it('returns the user credential first, and says so', async () => {
    const svc = service();
    await svc.store('u1', 'google', USER_KEY);
    await expect(svc.resolve('u1', 'google', PLATFORM_KEY)).resolves.toEqual({
      source: 'USER',
      secret: USER_KEY,
    });
  });

  it('falls back to the platform credential for a user with none', async () => {
    const svc = service();
    await expect(svc.resolve('u1', 'google', PLATFORM_KEY)).resolves.toEqual({
      source: 'PLATFORM',
      secret: PLATFORM_KEY,
    });
  });

  it('reports NONE (and no secret) when neither exists', async () => {
    const resolved = await service().resolve('u1', 'google');
    expect(resolved).toEqual({ source: 'NONE' });
    expect(resolved.secret).toBeUndefined();
  });

  it('never mixes the sources: one user\u2019s credential is invisible to another', async () => {
    const svc = service();
    await svc.store('u1', 'google', USER_KEY);
    await expect(svc.resolve('u2', 'google', PLATFORM_KEY)).resolves.toEqual({
      source: 'PLATFORM',
      secret: PLATFORM_KEY,
    });
    await expect(svc.resolve('u2', 'openai')).resolves.toEqual({ source: 'NONE' });
  });

  it('treats an undecryptable record as absent and falls through (key rotation)', async () => {
    const store = new InMemoryProviderCredentialStore();
    const sealedWithOldKey = createProviderCredentialCipher(KEY);
    const svc = new ProviderCredentialService(
      store,
      createProviderCredentialCipher('a-rotated-deployment-secret-entirely'),
    );
    await store.put({
      userId: 'u1',
      family: 'google',
      sealed: sealedWithOldKey.seal(USER_KEY),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    // No throw, no fabricated secret: the platform credential answers instead.
    await expect(svc.resolve('u1', 'google', PLATFORM_KEY)).resolves.toEqual({
      source: 'PLATFORM',
      secret: PLATFORM_KEY,
    });
    await expect(svc.resolve('u1', 'google')).resolves.toEqual({ source: 'NONE' });
  });
});
