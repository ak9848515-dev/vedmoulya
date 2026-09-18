// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider credential primitives (PROVIDER-01, Decisions 3 & 4)
//
// Proves the security invariants the credential lifecycle rests on:
//   - the at-rest form NEVER contains the plaintext,
//   - two seals of the same secret differ (unique IV),
//   - a tampered record or the wrong key fails CLOSED rather than decrypting,
//   - per-user isolation is structural (no cross-user read),
//   - platform credentials resolve from the documented env keys, and a
//     prototype-named key can never masquerade as a credential.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { createProviderCredentialCipher, MIN_CREDENTIAL_KEY_LENGTH } from '../credential-cipher.js';
import { platformCredentialEnvKeys, resolvePlatformCredential } from '../platform-credential.js';
import { InMemoryProviderCredentialStore } from '../../../infrastructure/InMemoryProviderCredentialStore.js';

const KEY = 'deployment-secret-with-enough-entropy-01';
const SECRET = 'AIzaSyPLAINTEXT-user-gemini-key-0000';

describe('createProviderCredentialCipher — encrypted at rest', () => {
  const cipher = createProviderCredentialCipher(KEY);

  it('seals without leaving the plaintext anywhere in the sealed record', () => {
    const sealed = cipher.seal(SECRET);
    const serialized = JSON.stringify(sealed);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain('AIzaSy');
    expect(sealed.algorithm).toBe('aes-256-gcm');
    expect(sealed.keyVersion).toBeGreaterThan(0);
  });

  it('round-trips the secret', () => {
    expect(cipher.open(cipher.seal(SECRET))).toBe(SECRET);
  });

  it('uses a fresh IV so the same secret never produces the same ciphertext', () => {
    const a = cipher.seal(SECRET);
    const b = cipher.seal(SECRET);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(cipher.open(a)).toBe(cipher.open(b));
  });

  it('fails closed on a tampered ciphertext (GCM authentication)', () => {
    const sealed = cipher.seal(SECRET);
    const tampered = {
      ...sealed,
      ciphertext: Buffer.from('not-the-real-bytes').toString('base64'),
    };
    expect(() => cipher.open(tampered)).toThrow();
  });

  it('fails closed under a different deployment key (rotation)', () => {
    const other = createProviderCredentialCipher('a-completely-different-deployment-secret');
    expect(() => other.open(cipher.seal(SECRET))).toThrow();
  });

  it('refuses key material that is too short to be a real secret', () => {
    expect(() => createProviderCredentialCipher('short')).toThrow(
      new RegExp(String(MIN_CREDENTIAL_KEY_LENGTH)),
    );
  });
});

describe('resolvePlatformCredential — deployment credential lookup', () => {
  it('resolves the documented key per family', () => {
    expect(resolvePlatformCredential('google', { AI_GOOGLE_API_KEY: 'g-key' })).toBe('g-key');
    expect(resolvePlatformCredential('deepseek', { AI_DEEPSEEK_API_KEY: 'd-key' })).toBe('d-key');
    expect(resolvePlatformCredential('openai', { AI_OPENAI_API_KEY: 'o-key' })).toBe('o-key');
  });

  it('honours the documented precedence for OpenAI', () => {
    expect(
      resolvePlatformCredential('openai', { AI_OPENAI_API_KEY: 'ai-key', OPENAI_API_KEY: 'plain' }),
    ).toBe('ai-key');
    expect(resolvePlatformCredential('openai', { OPENAI_API_KEY: 'plain' })).toBe('plain');
  });

  it('never treats a blank value as a credential', () => {
    expect(resolvePlatformCredential('google', { AI_GOOGLE_API_KEY: '   ' })).toBeUndefined();
    expect(resolvePlatformCredential('google', { AI_GOOGLE_API_KEY: '' })).toBeUndefined();
  });

  it('has no platform credential for local / custom endpoints', () => {
    expect(platformCredentialEnvKeys('ollama')).toEqual([]);
    expect(platformCredentialEnvKeys('openai-compatible')).toEqual([]);
    expect(resolvePlatformCredential('ollama', { AI_OLLAMA_BASE_URL: 'http://x' })).toBeUndefined();
  });

  it('a prototype-named env member can never masquerade as a credential', () => {
    // `Object.prototype.toString` is a function, not a string — but even a
    // string-carrying prototype member must not resolve, because the lookup is
    // restricted to OWN enumerable entries.
    expect(
      resolvePlatformCredential('google', {} as Record<string, string | undefined>),
    ).toBeUndefined();
    expect(resolvePlatformCredential('unknown-family', { toString: 'sneaky' })).toBeUndefined();
  });
});

describe('InMemoryProviderCredentialStore — owner isolation', () => {
  const record = (userId: string, family: string) => ({
    userId,
    family,
    sealed: createProviderCredentialCipher(KEY).seal(SECRET),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  it('never returns another owner\u2019s record', async () => {
    const store = new InMemoryProviderCredentialStore();
    await store.put(record('user-a', 'google'));
    expect(await store.get('user-a', 'google')).not.toBeNull();
    expect(await store.get('user-b', 'google')).toBeNull();
  });

  it('lists only the owner\u2019s families, sorted, and removes idempotently', async () => {
    const store = new InMemoryProviderCredentialStore();
    await store.put(record('user-a', 'google'));
    await store.put(record('user-a', 'openai'));
    await store.put(record('user-b', 'deepseek'));

    expect(await store.listFamilies('user-a')).toEqual(['google', 'openai']);
    expect(await store.listFamilies('user-b')).toEqual(['deepseek']);

    await store.remove('user-a', 'google');
    await store.remove('user-a', 'google');
    expect(await store.listFamilies('user-a')).toEqual(['openai']);
  });

  it('stores ciphertext only — a dump of the store contains no plaintext', async () => {
    const store = new InMemoryProviderCredentialStore();
    await store.put(record('user-a', 'google'));
    const dump = JSON.stringify(await store.listForOwner('user-a'));
    expect(dump).not.toContain(SECRET);
  });
});
