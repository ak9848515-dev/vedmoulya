// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Production Provider Credential Service wiring
//
// PRODUCTION REPRO (Gemini user key received but not persisted):
// `createProductionProviderCredentialService()` returns `undefined` when the
// deployment has no usable encryption key. `ApiApplicationService` then composes
// the setup orchestrator WITHOUT a credential service, so `setupProvider`
// silently cannot store the user's key and ends at AUTH_REQUIRED. These tests
// pin that configuration contract: absent/blank/too-short key ⇒ storage is
// DISABLED (never a plaintext fallback); a strong key ⇒ storage works.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach } from 'vitest';
import { createProductionProviderCredentialService } from '../infrastructure/ProductionRepositories.js';

const KEY_ENV = 'AI_CREDENTIAL_ENCRYPTION_KEY';
const SAVED_KEY = process.env[KEY_ENV];

afterEach(() => {
  if (SAVED_KEY === undefined) delete process.env[KEY_ENV];
  else process.env[KEY_ENV] = SAVED_KEY;
});

describe('createProductionProviderCredentialService (PROVIDER-01)', () => {
  it('is absent without an encryption key — user credentials cannot be stored', () => {
    delete process.env[KEY_ENV];
    expect(createProductionProviderCredentialService()).toBeUndefined();

    process.env[KEY_ENV] = '   ';
    expect(createProductionProviderCredentialService()).toBeUndefined();
  });

  it('is absent for an unusable (too short) key — never falls back to plaintext', () => {
    process.env[KEY_ENV] = 'short'; // < MIN_CREDENTIAL_KEY_LENGTH (16)
    expect(createProductionProviderCredentialService()).toBeUndefined();
  });

  it('is configured by a strong key and can store + read back an owner credential', async () => {
    process.env[KEY_ENV] = 'a-strong-deployment-encryption-key';
    const service = createProductionProviderCredentialService();
    expect(service).toBeDefined();
    if (!service) throw new Error('expected a configured credential service');

    await service.store('user-1', 'google', 'AIza-real-looking-key');

    expect(await service.hasCredential('user-1', 'google')).toBe(true);
    const resolved = await service.resolve('user-1', 'google');
    expect(resolved.source).toBe('USER');
    expect(resolved.secret).toBe('AIza-real-looking-key');
  });
});
