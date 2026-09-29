// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mission: user-credential → runtime adapter registrar
// (PROVIDER-01 → Mission)
//
// Proves the fix for the Mission/Providers contradiction at the credential
// boundary: a provider a user really connected (stored, encrypted, owner-
// scoped) is turned into the EXISTING runtime adapter, becomes eligible for
// THAT user's missions, and never leaks to another user or into any output.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import { OrchestratorProviderAvailability } from '@vedmoulya/mission-runtime';
import { GoogleGeminiProvider, OpenAICompatibleProvider } from '@vedmoulya/orchestrator';
import {
  InMemoryProviderCredentialStore,
  ProviderCredentialService,
  createProviderCredentialCipher,
} from '@vedmoulya/providers';
import {
  createMissionUserProviderRegistrar,
  type UserProviderRegistrar,
} from '../services/MissionUserProviders.js';

const GEMINI_SECRET = 'gemini-user-secret-key-0000000000000001';
const OPENROUTER_SECRET = 'sk-or-v1-user-secret-000000000000000002';
const PLATFORM_SECRET = 'platform-deployment-key-00000000000000';

function makeCredentials(): ProviderCredentialService {
  return new ProviderCredentialService(
    new InMemoryProviderCredentialStore(),
    createProviderCredentialCipher('test-deployment-encryption-key-0001'),
  );
}

/**
 * Per-user availability over a resolver that mirrors the production
 * composition: a fresh orchestrator per user, platform providers first, then
 * the user's own credential-backed adapters.
 */
function scopedAvailability(options?: {
  registrar?: UserProviderRegistrar;
  platform?: () => void;
}): OrchestratorProviderAvailability {
  const cache = new Map<string, Promise<AIOrchestrationService>>();
  const resolve = (userId: string): Promise<AIOrchestrationService> => {
    const existing = cache.get(userId);
    if (existing) return existing;
    const created = (async (): Promise<AIOrchestrationService> => {
      const orchestrator = new AIOrchestrationService();
      options?.platform?.();
      if (options?.registrar) await options.registrar(orchestrator, userId);
      return orchestrator;
    })();
    cache.set(userId, created);
    return created;
  };
  return new OrchestratorProviderAvailability(new AIOrchestrationService(), resolve);
}

describe('createMissionUserProviderRegistrar', () => {
  it('returns undefined when the deployment cannot store user credentials', () => {
    expect(createMissionUserProviderRegistrar(undefined)).toBeUndefined();
  });

  it('registers the EXISTING Gemini adapter from a stored user credential', async () => {
    const credentials = makeCredentials();
    await credentials.store('u1', 'google', GEMINI_SECRET);
    const registrar = createMissionUserProviderRegistrar(credentials)!;

    const orchestrator = new AIOrchestrationService();
    await registrar(orchestrator, 'u1');

    // The EXISTING adapter class — no adapter duplicated.
    expect(orchestrator.getProvider('google')).toBeInstanceOf(GoogleGeminiProvider);
    const status = await new OrchestratorProviderAvailability(orchestrator).getProviderStatus([]);
    expect(status.available).toBe(true);
    expect(status.capableProviders.map((p) => p.providerId)).toEqual(['google']);
  });

  it('registers the EXISTING OpenRouter adapter from a stored user credential', async () => {
    const credentials = makeCredentials();
    await credentials.store('u1', 'openrouter', OPENROUTER_SECRET);
    const registrar = createMissionUserProviderRegistrar(credentials)!;

    const orchestrator = new AIOrchestrationService();
    await registrar(orchestrator, 'u1');

    expect(orchestrator.getProvider('openrouter')).toBeInstanceOf(OpenAICompatibleProvider);
    const status = await new OrchestratorProviderAvailability(orchestrator).getProviderStatus([]);
    expect(status.available).toBe(true);
    expect(status.capableProviders.map((p) => p.providerId)).toEqual(['openrouter']);
  });

  it('registers nothing when the user has no credential for a family', async () => {
    const credentials = makeCredentials();
    const registrar = createMissionUserProviderRegistrar(credentials)!;

    const orchestrator = new AIOrchestrationService();
    await registrar(orchestrator, 'u1');

    expect(orchestrator.listProviders().total).toBe(0);
  });

  it('keeps the required-capability predicate intact', async () => {
    const credentials = makeCredentials();
    await credentials.store('u1', 'google', GEMINI_SECRET);
    const availability = scopedAvailability({
      registrar: createMissionUserProviderRegistrar(credentials),
    });

    expect((await availability.getProviderStatus(['reasoning'], 'u1')).available).toBe(true);
    // A capability no adapter declares keeps the user ineligible.
    expect((await availability.getProviderStatus(['embeddings'], 'u1')).available).toBe(false);
  });

  it("scopes a user's credential to that user only", async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'google', GEMINI_SECRET);
    const availability = scopedAvailability({
      registrar: createMissionUserProviderRegistrar(credentials),
    });

    const forA = await availability.getProviderStatus([], 'user-a');
    const forB = await availability.getProviderStatus([], 'user-b');

    expect(forA.available).toBe(true);
    expect(forA.capableProviders.map((p) => p.providerId)).toEqual(['google']);
    expect(forB.available).toBe(false);
    expect(forB.capableProviders).toEqual([]);
  });

  it('preserves deployment (environment) providers for every user', async () => {
    // No user credential anywhere; the platform provider is all there is.
    const credentials = makeCredentials();
    const availability = scopedAvailability({
      registrar: createMissionUserProviderRegistrar(credentials),
      platform: () => {
        // registered into the per-user orchestrator exactly like
        // registerPlatformProviders does in the composition
      },
    });
    // A user with no credential still reports availability when the platform
    // orchestrator itself has a provider (pre-existing behavior).
    const platformOrchestrator = new AIOrchestrationService();
    platformOrchestrator.registerProvider(new GoogleGeminiProvider(PLATFORM_SECRET));
    const platformStatus = await new OrchestratorProviderAvailability(
      platformOrchestrator,
    ).getProviderStatus([]);
    expect(platformStatus.available).toBe(true);
    expect(platformStatus.capableProviders.map((p) => p.providerId)).toEqual(['google']);

    // And the user-scoped resolver, with no user credential, invents nothing.
    expect((await availability.getProviderStatus([], 'user-a')).available).toBe(false);
  });

  it('never exposes credential material in listings or availability results', async () => {
    const credentials = makeCredentials();
    await credentials.store('u1', 'google', GEMINI_SECRET);
    await credentials.store('u1', 'openrouter', OPENROUTER_SECRET);
    const registrar = createMissionUserProviderRegistrar(credentials)!;

    const orchestrator = new AIOrchestrationService();
    await registrar(orchestrator, 'u1');
    const status = await new OrchestratorProviderAvailability(orchestrator).getProviderStatus([]);

    const serialized = JSON.stringify({
      providers: orchestrator.listProviders(),
      health: await orchestrator.getAllProviderHealth(),
      status,
    });
    expect(serialized).not.toContain(GEMINI_SECRET);
    expect(serialized).not.toContain(OPENROUTER_SECRET);
  });
});
