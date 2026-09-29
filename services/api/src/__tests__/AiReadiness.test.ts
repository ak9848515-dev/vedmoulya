// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Honest AI readiness (Phase C)
//
// The Ask VedMoulya badge used to read a provider DESCRIPTOR's theoretical
// `canExecute`, which stays true for a family that has an adapter but is
// NOT_CONFIGURED / not registered. It now reads the user's ACTUAL runtime —
// the very same user-scoped orchestrator `stream`/`orchestrate` execute on —
// through a pure registry query (`canServe`). No provider call, no usage, no
// CostLedger, no static capability.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import type { AIOrchestrationService as AIOrchestrationServiceType } from '@vedmoulya/services';
import type { ProviderAdapter } from '@vedmoulya/services';
import type {
  AIResponse,
  CapabilityType,
  ProviderHealth,
  ValidationResult,
} from '@vedmoulya/orchestrator';
import { GoogleGeminiProvider } from '@vedmoulya/orchestrator';
import { readProviderRuntimeState } from '@vedmoulya/core';
import {
  InMemoryProviderCredentialStore,
  ProviderCredentialService,
  createProviderCredentialCipher,
} from '@vedmoulya/providers';
import {
  createMissionUserProviderRegistrar,
  createUserAiOrchestratorResolver,
  type UserProviderRegistrar,
} from '../services/MissionUserProviders.js';
import { createAIRouter } from '../routers/AIRouter.js';

const GEMINI_SECRET = 'gemini-user-secret-key-0000000000000001';

const OK_VALIDATION: ValidationResult = {
  passed: true,
  checks: [],
  overallScore: 1,
  decision: 'pass',
};

class RecordingAdapter implements ProviderAdapter {
  constructor(
    public name: string,
    public family: string,
    public capabilities: CapabilityType[] = ['reasoning'],
  ) {}

  isHealthy(): Promise<boolean> {
    return Promise.resolve(true);
  }

  getHealth(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: this.name,
      status: 'healthy',
      latency: 5,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 100,
      rateLimitReset: null,
    });
  }

  execute(): Promise<AIResponse> {
    return Promise.resolve({
      content: `${this.name} answered`,
      provider: this.name,
      model: 'recording-model',
      confidence: 1,
      qualityScore: 1,
      latency: 5,
      cost: 0.001,
      tokenUsage: { input: 5, output: 5, total: 10 },
      validation: OK_VALIDATION,
      traceId: 'trace-readiness',
    });
  }
}

function makeCredentials(): ProviderCredentialService {
  return new ProviderCredentialService(
    new InMemoryProviderCredentialStore(),
    createProviderCredentialCipher('test-deployment-encryption-key-0001'),
  );
}

/** A resolver composed exactly like the gateway: platform providers + user ones. */
function makeRouter(options: {
  credentials?: ProviderCredentialService;
  platformAdapters?: ProviderAdapter[];
  registerUserProviders?: UserProviderRegistrar;
}): ReturnType<typeof createAIRouter> {
  const platform = new AIOrchestrationService();
  for (const adapter of options.platformAdapters ?? []) {
    platform.registerProvider(adapter);
  }
  const resolve = createUserAiOrchestratorResolver({
    platform,
    createUserOrchestrator: (): AIOrchestrationServiceType => {
      const orchestrator = new AIOrchestrationService();
      for (const adapter of options.platformAdapters ?? []) {
        orchestrator.registerProvider(adapter);
      }
      return orchestrator;
    },
    registerUserProviders:
      options.registerUserProviders ?? createMissionUserProviderRegistrar(options.credentials),
  });
  return createAIRouter(platform, resolve);
}

const CTX = { userId: 'user-a', email: 'a@example.com', role: 'user' };
const askInput = (userId: string) => ({
  userId,
  capability: 'reasoning' as const,
  userInput: 'What should I focus on today?',
  qualityTier: 'standard' as const,
});

describe('AI readiness — actual runtime availability, never descriptor capability', () => {
  it('is NOT ready when no provider is registered for the user', async () => {
    const router = makeRouter({ credentials: makeCredentials() });
    const result = await router.readiness({ userId: 'user-a' }, CTX);

    expect(result.success).toBe(true);
    expect(result.data?.ready).toBe(false);
    expect(result.data?.providers).toEqual([]);
    expect(result.data?.capability).toBe('reasoning');
  });

  it('is ready for a user-connected (credential-backed) provider', async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'google', GEMINI_SECRET);
    const router = makeRouter({ credentials });

    const result = await router.readiness({ userId: 'user-a' }, CTX);

    expect(result.data?.ready).toBe(true);
    expect(result.data?.providers).toContain('google');
  });

  it('is NOT ready from a static descriptor whose adapter is not registered', async () => {
    // The descriptor table still claims canExecute for families with an adapter
    // even when nothing is configured/registered — readiness must ignore that.
    const descriptorStates = readProviderRuntimeState({}, 'development');
    expect(descriptorStates.some((state) => state.canExecute)).toBe(true);

    const router = makeRouter({ credentials: makeCredentials() });
    const result = await router.readiness({ userId: 'user-a' }, CTX);
    expect(result.data?.ready).toBe(false);
  });

  it('is ready for a configured platform provider', async () => {
    const router = makeRouter({
      credentials: makeCredentials(),
      platformAdapters: [new RecordingAdapter('platform-google', 'google')],
    });

    const result = await router.readiness({ userId: 'user-a' }, CTX);

    expect(result.data?.ready).toBe(true);
    expect(result.data?.providers).toContain('platform-google');
  });

  it('scopes readiness to the requesting user', async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'google', GEMINI_SECRET);
    const router = makeRouter({ credentials });

    expect((await router.readiness({ userId: 'user-a' }, CTX)).data?.ready).toBe(true);
    expect((await router.readiness({ userId: 'user-b' }, CTX)).data?.ready).toBe(false);
  });

  it('flips to not-ready when the user provider is removed', async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'google', GEMINI_SECRET);
    const before = makeRouter({ credentials });
    expect((await before.readiness({ userId: 'user-a' }, CTX)).data?.ready).toBe(true);

    await credentials.delete('user-a', 'google');
    // A fresh resolver (same deployment, credential now gone).
    const after = makeRouter({ credentials });
    expect((await after.readiness({ userId: 'user-a' }, CTX)).data?.ready).toBe(false);
  });

  it('reports readiness for a capability no provider serves', async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'google', GEMINI_SECRET);
    const router = makeRouter({ credentials });

    // Gemini declares reasoning but not embeddings; an embeddings-only ask must
    // not report ready (provider-specific capability semantics preserved).
    const result = await router.readiness({ userId: 'user-a', capability: 'embeddings' }, CTX);
    expect(result.data?.ready).toBe(false);
    expect(result.data?.capability).toBe('embeddings');
  });

  it('leaves provider capability metadata untouched', async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'google', GEMINI_SECRET);
    const router = makeRouter({ credentials });
    const runtime = await createUserAiOrchestratorResolver({
      platform: new AIOrchestrationService(),
      createUserOrchestrator: () => new AIOrchestrationService(),
      registerUserProviders: createMissionUserProviderRegistrar(credentials),
    })('user-a');

    await router.readiness({ userId: 'user-a' }, CTX);

    expect(runtime.getProvider('google')).toBeInstanceOf(GoogleGeminiProvider);
    expect(runtime.listProviders().providers[0]?.capabilities).toContain('reasoning');
  });

  it('matches the execution runtime: ready ⇒ executes, not ready ⇒ fails the same way', async () => {
    // Stand in for the user's credential-backed adapter (no network) through the
    // SAME resolver path, so readiness and execution share ONE runtime.
    const adapter = new RecordingAdapter('user-google', 'google');
    const router = makeRouter({
      credentials: makeCredentials(),
      registerUserProviders: async (orchestrator) => {
        orchestrator.registerProvider(adapter);
      },
    });

    const readiness = await router.readiness({ userId: 'user-a' }, CTX);
    expect(readiness.data?.ready).toBe(true);
    // Whatever readiness claims, the EXECUTION path must agree.
    const executed = await router.stream(askInput('user-a'), CTX);
    expect(executed.success).toBe(true);
    expect(executed.data?.final.provider).toBe('user-google');

    // And the negative case is the same predicate: not ready ⇒ routing fails.
    const emptyRouter = makeRouter({ credentials: makeCredentials() });
    expect((await emptyRouter.readiness({ userId: 'user-c' }, CTX)).data?.ready).toBe(false);
    await expect(emptyRouter.stream(askInput('user-c'), CTX)).rejects.toThrow(/Provider not found/);
  });
});
