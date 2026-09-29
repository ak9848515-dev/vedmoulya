// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ask VedMoulya: user-connected provider execution (PROVIDER-01 → AI)
//
// The direct AI gateway (ai.stream / ai.orchestrate) used to run ONLY on the
// deployment-wide orchestrator, whose adapters come from platform environment
// keys. A provider a user connected with their OWN credential was invisible to
// Ask VedMoulya even though Mission could already use it — so in production
// (no platform AI_* keys) candidate selection was empty and the request failed
// before any adapter or network call.
//
// These tests prove the fix reuses the EXISTING user-scoped composition
// (createMissionUserProviderRegistrar + cacheUserInitialization) for the direct
// AI runtime: a user-connected Gemini/OpenRouter adapter becomes executable
// from Ask, platform providers are preserved, and one user's credential can
// never serve another user.
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
import { GoogleGeminiProvider, OpenAICompatibleProvider } from '@vedmoulya/orchestrator';
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
const OPENROUTER_SECRET = 'sk-or-v1-user-secret-000000000000000002';

const OK_VALIDATION: ValidationResult = {
  passed: true,
  checks: [],
  overallScore: 1,
  decision: 'pass',
};

/** A deterministic adapter that records every execution (no network). */
class RecordingAdapter implements ProviderAdapter {
  readonly executions: string[] = [];

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

  execute(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
    modelId?: string;
  }): Promise<AIResponse> {
    this.executions.push(request.model);
    return Promise.resolve({
      content: `${this.name} answered`,
      provider: this.name,
      model: request.modelId ?? 'recording-model',
      confidence: 1,
      qualityScore: 1,
      latency: 5,
      cost: 0.0012,
      tokenUsage: { input: 11, output: 22, total: 33 },
      validation: OK_VALIDATION,
      traceId: 'trace-recording',
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
function makeResolver(options: {
  credentials?: ProviderCredentialService;
  platformProviders?: () => ProviderAdapter[];
  registerUserProviders?: UserProviderRegistrar;
}): {
  resolve: (userId: string) => Promise<AIOrchestrationServiceType>;
  platform: AIOrchestrationServiceType;
} {
  const platform = new AIOrchestrationService();
  for (const adapter of options.platformProviders?.() ?? []) {
    platform.registerProvider(adapter);
  }
  const resolve = createUserAiOrchestratorResolver({
    platform,
    createUserOrchestrator: (): AIOrchestrationServiceType => {
      const orchestrator = new AIOrchestrationService();
      // Platform providers first — a user credential OVERLAYS them.
      for (const adapter of options.platformProviders?.() ?? []) {
        orchestrator.registerProvider(adapter);
      }
      return orchestrator;
    },
    registerUserProviders:
      options.registerUserProviders ?? createMissionUserProviderRegistrar(options.credentials),
  });
  return { resolve, platform };
}

const ASK_INPUT = {
  userId: 'user-a',
  capability: 'reasoning' as const,
  userInput: 'What should I focus on today?',
  qualityTier: 'standard' as const,
  constraints: { outputFormat: 'markdown' as const, maxOutputTokens: 1200 },
};

const CTX = { userId: 'user-a', email: 'a@example.com', role: 'user' };

// ── Resolver: user-connected providers become visible to the AI runtime ─────

describe('createUserAiOrchestratorResolver — Ask runtime is user-scoped', () => {
  it('exposes a user-connected Gemini adapter on the user runtime', async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'google', GEMINI_SECRET);
    const { resolve } = makeResolver({ credentials });

    const runtime = await resolve('user-a');

    expect(runtime.getProvider('google')).toBeInstanceOf(GoogleGeminiProvider);
    expect(runtime.listProviders().providers.map((p) => p.id)).toContain('google');
  });

  it('exposes a user-connected OpenRouter adapter on the user runtime', async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'openrouter', OPENROUTER_SECRET);
    const { resolve } = makeResolver({ credentials });

    const runtime = await resolve('user-a');

    expect(runtime.getProvider('openrouter')).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it("keeps one user's credential out of another user's runtime", async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'google', GEMINI_SECRET);
    await credentials.store('user-b', 'openrouter', OPENROUTER_SECRET);
    const { resolve, platform } = makeResolver({ credentials });

    const forA = await resolve('user-a');
    const forB = await resolve('user-b');

    expect(forA.getProvider('google')).toBeInstanceOf(GoogleGeminiProvider);
    expect(forA.getProvider('openrouter')).toBeUndefined();
    expect(forB.getProvider('openrouter')).toBeInstanceOf(OpenAICompatibleProvider);
    expect(forB.getProvider('google')).toBeUndefined();
    // The deployment orchestrator never gains a user adapter.
    expect(platform.getProvider('google')).toBeUndefined();
    expect(platform.getProvider('openrouter')).toBeUndefined();
  });

  it('preserves platform providers for a user with no credential', async () => {
    const credentials = makeCredentials();
    const platformAdapter = new RecordingAdapter('platform-google', 'google');
    const { resolve } = makeResolver({
      credentials,
      platformProviders: () => [platformAdapter],
    });

    const runtime = await resolve('user-a');

    expect(runtime.getProvider('platform-google')).toBe(platformAdapter);
  });

  it('caches one runtime per user (dedup + identity)', async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'google', GEMINI_SECRET);
    const { resolve } = makeResolver({ credentials });

    const first = await resolve('user-a');
    const second = await resolve('user-a');

    expect(second).toBe(first);
  });

  it('falls back to the platform runtime when no user registrar exists', async () => {
    const platform = new AIOrchestrationService();
    const resolve = createUserAiOrchestratorResolver({
      platform,
      createUserOrchestrator: () => new AIOrchestrationService(),
    });

    expect(await resolve('user-a')).toBe(platform);
  });

  it('never exposes credential material through the user runtime', async () => {
    const credentials = makeCredentials();
    await credentials.store('user-a', 'google', GEMINI_SECRET);
    await credentials.store('user-a', 'openrouter', OPENROUTER_SECRET);
    const { resolve } = makeResolver({ credentials });

    const runtime = await resolve('user-a');
    const serialized = JSON.stringify({
      providers: runtime.listProviders(),
      health: await runtime.getAllProviderHealth(),
    });

    expect(serialized).not.toContain(GEMINI_SECRET);
    expect(serialized).not.toContain(OPENROUTER_SECRET);
  });
});

// ── Router: Ask execution reaches the owner's adapter ──────────────────────

describe('createAIRouter — Ask execution uses the owner runtime', () => {
  it('reaches a real adapter execution when a user provider exists', async () => {
    // The registrar stands in for the credential-backed adapters so no network
    // is touched; it is overlaid through the SAME resolver path production uses.
    // The platform provider cannot serve `reasoning`, so the OWNER's adapter is
    // the candidate that must actually execute.
    const userAdapter = new RecordingAdapter('user-google', 'google');
    const platformAdapter = new RecordingAdapter('platform-google', 'google', ['embeddings']);
    const { resolve } = makeResolver({
      platformProviders: () => [platformAdapter],
      registerUserProviders: async (orchestrator) => {
        orchestrator.registerProvider(userAdapter);
      },
    });

    const router = createAIRouter(new AIOrchestrationService(), resolve);
    const result = await router.stream(ASK_INPUT, CTX);

    expect(result.success).toBe(true);
    expect(userAdapter.executions).toHaveLength(1);
    expect(platformAdapter.executions).toHaveLength(0);
    expect(result.data?.final.content).toContain('user-google answered');
  });

  it('routes two users to their own adapters', async () => {
    const forA = new RecordingAdapter('adapter-a', 'google');
    const forB = new RecordingAdapter('adapter-b', 'openrouter');
    const { resolve } = makeResolver({
      registerUserProviders: async (orchestrator, userId) => {
        orchestrator.registerProvider(userId === 'user-a' ? forA : forB);
      },
    });
    const router = createAIRouter(new AIOrchestrationService(), resolve);

    await router.stream(ASK_INPUT, CTX);
    await router.stream({ ...ASK_INPUT, userId: 'user-b' }, { ...CTX, userId: 'user-b' });

    expect(forA.executions).toHaveLength(1);
    expect(forB.executions).toHaveLength(1);
  });

  it('still fails honestly when no provider is available', async () => {
    // Simulates a production deployment with no platform AI keys and no user
    // credential: the runtime registers nothing, so selection must fail.
    const { resolve } = makeResolver({
      registerUserProviders: async () => {
        /* no credential stored */
      },
    });
    const router = createAIRouter(new AIOrchestrationService(), resolve);

    await expect(router.stream(ASK_INPUT, CTX)).rejects.toThrow(/Provider not found/);
  });
});
