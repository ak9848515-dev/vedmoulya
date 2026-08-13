// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Intelligence tests
// EPIC-012A — AI Provider Intelligence (Phases 7–11)
// Verifies: resource classification (free vs paid vs local — never
// conflated), provenance-carrying profile derivation (never fabricate),
// hardware fit (SAFE/POSSIBLE_SLOW/NOT_RECOMMENDED/UNSUPPORTED/UNKNOWN),
// and fail-safe local model discovery.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { Provider } from '../domain/entities/Provider.js';
import { createProviderId } from '../domain/value-objects/ProviderId.js';
import { ProviderLifecycleStatus } from '../domain/value-objects/ProviderLifecycleStatus.js';
import {
  classifyResource,
  resolveResourceType,
} from '../domain/services/ModelResourceClassifier.js';
import { ProviderIntelligenceService } from '../domain/services/ProviderIntelligenceService.js';
import { HardwareCompatibilityService } from '../domain/services/HardwareCompatibilityService.js';
import {
  OllamaLocalModelDiscovery,
  OpenAICompatibleModelDiscovery,
  InMemoryLocalModelDiscovery,
} from '../infrastructure/LocalModelDiscovery.js';

function makeProvider(params: {
  id: string;
  family: string;
  name: string;
  costTier?: 'free' | 'low' | 'medium' | 'high';
  input?: number;
  output?: number;
  tags?: string[];
  models?: Array<{
    id: string;
    name: string;
    contextLength: number;
    maxOutputTokens: number;
    streaming: boolean;
    vision: boolean;
    functionCalling: boolean;
    embeddings: boolean;
    reasoning: boolean;
    coding: boolean;
    creativeWriting: boolean;
    translation: boolean;
    image: boolean;
    audio: boolean;
    video: boolean;
    modalities: string[];
    capabilities: string[];
  }>;
}): Provider {
  const baseModel = {
    maxOutputTokens: 4096,
    streaming: true,
    vision: false,
    functionCalling: true,
    embeddings: false,
    reasoning: true,
    coding: true,
    creativeWriting: false,
    translation: false,
    image: false,
    audio: false,
    video: false,
    modalities: ['text'] as string[],
    capabilities: ['reasoning', 'coding'] as string[],
  };
  return Provider.create({
    id: createProviderId(params.id),
    family: params.family as Provider['family'],
    name: params.name,
    description: 'test',
    owner: 'u1',
    models: params.models?.map((m) => ({ ...baseModel, ...m })) ?? [
      { ...baseModel, id: 'm1', name: 'Model One', contextLength: 128000 },
    ],
    capabilities: ['reasoning', 'coding'],
    supportedModalities: ['text'],
    cost: {
      inputPerMillionTokens: params.input ?? 0,
      outputPerMillionTokens: params.output ?? 0,
      currency: 'USD',
      tier: params.costTier ?? 'free',
    },
    latency: { p50Ms: 100, p95Ms: 300 },
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 10000,
      requestsPerDay: 1000,
      maxConcurrentRequests: 4,
    },
    availability: 0.99,
    tags: params.tags ?? [],
    lifecycleStatus: ProviderLifecycleStatus.fromStatus('active'),
  });
}

describe('ModelResourceClassifier — resource types never conflate free/local/paid', () => {
  it('classifies local runtimes as LOCAL even when free', () => {
    const cls = classifyResource({
      family: 'ollama',
      inputPerMillionTokens: 0,
      outputPerMillionTokens: 0,
      tags: ['open'],
      costTier: 'free',
    });
    expect(cls.resourceType).toBe('LOCAL');
    expect(cls.freeToUse).toBe(true);
    expect(cls.openWeights).toBe(true);
  });

  it('treats a paid API as USER_PAID_API even when open weights', () => {
    const cls = classifyResource({
      family: 'openai',
      inputPerMillionTokens: 3,
      outputPerMillionTokens: 15,
      tags: ['open-source'],
      costTier: 'low',
    });
    expect(cls.resourceType).toBe('USER_PAID_API');
    expect(cls.freeToUse).toBe(false);
    // "open source" is NEVER treated as "free API".
    expect(cls.openWeights).toBe(true);
    expect(cls.reasons.some((r) => r.includes('open model weights'))).toBe(true);
  });

  it('classifies a free tier with listed pricing as FREE_API_QUOTA (not unlimited free)', () => {
    const cls = classifyResource({
      family: 'google',
      inputPerMillionTokens: 0.5,
      outputPerMillionTokens: 2,
      tags: [],
      costTier: 'free',
    });
    expect(cls.resourceType).toBe('FREE_API_QUOTA');
    expect(cls.freeToUse).toBe(true);
    expect(cls.reasons.some((r) => r.includes('quota-limited'))).toBe(true);
  });

  it('classifies a zero-cost non-local family as FREE_HOSTED', () => {
    const cls = classifyResource({
      family: 'mock',
      inputPerMillionTokens: 0,
      outputPerMillionTokens: 0,
      tags: [],
      costTier: 'free',
    });
    expect(cls.resourceType).toBe('FREE_HOSTED');
    expect(cls.freeToUse).toBe(true);
  });

  it('classifies OpenRouter as an aggregator, never free', () => {
    const cls = classifyResource({
      family: 'openrouter',
      inputPerMillionTokens: 0.1,
      outputPerMillionTokens: 0.3,
      tags: [],
      costTier: 'medium',
    });
    expect(cls.resourceType).toBe('AGGREGATOR');
    expect(cls.freeToUse).toBe(false);
  });

  it('resolves ENTERPRISE only when explicitly tagged', () => {
    const cls = classifyResource({
      family: 'anthropic',
      inputPerMillionTokens: 5,
      outputPerMillionTokens: 25,
      tags: ['enterprise'],
      costTier: 'high',
    });
    expect(resolveResourceType(cls, ['enterprise'])).toBe('ENTERPRISE');
    expect(resolveResourceType(cls, [])).toBe('USER_PAID_API');
  });
});

describe('ProviderIntelligenceService — provenance, never fabricated', () => {
  it('derives a profile with PROVIDER_DECLARED metadata and honest UNKNOWNs', () => {
    const provider = makeProvider({
      id: 'openai',
      family: 'openai',
      name: 'OpenAI',
      costTier: 'low',
      input: 3,
      output: 15,
    });
    const svc = new ProviderIntelligenceService();
    const profile = svc.buildProfile(provider);

    expect(profile.providerId).toBe('openai');
    expect(profile.models).toHaveLength(1);
    const model = profile.models[0];
    expect(model.contextWindow.value).toBe(128000);
    expect(model.contextWindow.provenance).toBe('PROVIDER_DECLARED');
    expect(model.capabilities.provenance).toBe('PROVIDER_DECLARED');
    expect(model.capabilities.value).toContain('reasoning');
    // Free availability is INFERRED from resource classification.
    expect(model.freeAvailability.provenance).toBe('INFERRED');
    expect(model.resourceType).toBe('USER_PAID_API');
    // Coverage totals are honest.
    expect(
      profile.coverage.knownPropertyCount + profile.coverage.unknownPropertyCount,
    ).toBeGreaterThan(0);
  });

  it('marks absent health latency as UNKNOWN rather than guessing', () => {
    const provider = makeProvider({ id: 'x', family: 'mock', name: 'X' });
    // Latency is zero in the fixture → UNKNOWN, not a fabricated MEASURED.
    const profile = new ProviderIntelligenceService().buildProfile(provider);
    expect(profile.models[0]?.latencyMs.provenance).toBe('UNKNOWN');
    expect(profile.models[0]?.latencyMs.value).toBeNull();
  });

  it('classifies ollama provider models as LOCAL with free availability', () => {
    const provider = makeProvider({
      id: 'ollama',
      family: 'ollama',
      name: 'Ollama',
      tags: ['open'],
    });
    const model = new ProviderIntelligenceService().buildProfile(provider).models[0];
    expect(model?.resourceType).toBe('LOCAL');
    expect(model?.freeAvailability.value).toBe('free');
  });

  it('structured output is INFERRED from function-calling/reasoning (never declared blindly)', () => {
    const provider = makeProvider({ id: 'y', family: 'openai', name: 'Y', input: 1, output: 2 });
    const model = new ProviderIntelligenceService().buildProfile(provider).models[0];
    expect(model?.structuredOutput.provenance).toBe('PROVIDER_DECLARED');
    expect(model?.structuredOutput.value).toBe(true);
  });
});

describe('HardwareCompatibilityService — hardware-aware local fit', () => {
  it('SAFE when the model fits in VRAM', () => {
    const svc = new HardwareCompatibilityService();
    const out = svc.assess({ ramGb: 32, vramGb: 24, hasGpu: true, storageGb: 200 }, [
      { modelId: 'llama', name: 'Llama 8B', estimatedSizeGb: 6 },
    ]);
    expect(out.assessments[0]?.verdict).toBe('SAFE');
  });

  it('POSSIBLE_SLOW when it fits RAM but not VRAM on a GPU machine', () => {
    const svc = new HardwareCompatibilityService();
    const out = svc.assess({ ramGb: 64, vramGb: 8, hasGpu: true, storageGb: 500 }, [
      { modelId: 'big', name: 'Big Model', estimatedSizeGb: 20 },
    ]);
    expect(out.assessments[0]?.verdict).toBe('POSSIBLE_SLOW');
  });

  it('UNSUPPORTED when the model exceeds usable RAM', () => {
    const svc = new HardwareCompatibilityService();
    const out = svc.assess({ ramGb: 16, vramGb: 4, hasGpu: false, storageGb: 100 }, [
      { modelId: 'huge', name: 'Huge', estimatedSizeGb: 40 },
    ]);
    expect(out.assessments[0]?.verdict).toBe('UNSUPPORTED');
    expect(out.assessments[0]?.reasons.join(' ')).toContain('RAM');
  });

  it('UNSUPPORTED when the model exceeds storage', () => {
    const svc = new HardwareCompatibilityService();
    const out = svc.assess({ ramGb: 64, vramGb: 24, hasGpu: true, storageGb: 20 }, [
      { modelId: 'giant', name: 'Giant', estimatedSizeGb: 80 },
    ]);
    expect(out.assessments[0]?.verdict).toBe('UNSUPPORTED');
    expect(out.assessments[0]?.reasons.join(' ')).toContain('storage');
  });

  it('UNKNOWN when hardware is not reported — never guesses', () => {
    const svc = new HardwareCompatibilityService();
    const out = svc.assess({}, [{ modelId: 'm', name: 'M', estimatedSizeGb: 8 }]);
    expect(out.hardwareKnown).toBe(false);
    expect(out.assessments[0]?.verdict).toBe('UNKNOWN');
  });

  it('UNKNOWN when the model size is unknown', () => {
    const svc = new HardwareCompatibilityService();
    const out = svc.assess({ ramGb: 32, hasGpu: false }, [
      { modelId: 'm', name: 'M', estimatedSizeGb: 0 },
    ]);
    expect(out.assessments[0]?.verdict).toBe('UNKNOWN');
  });

  it('summarizes counts across models', () => {
    const svc = new HardwareCompatibilityService();
    const out = svc.assess({ ramGb: 32, vramGb: 24, hasGpu: true, storageGb: 200 }, [
      { modelId: 'a', name: 'A', estimatedSizeGb: 4 },
      { modelId: 'b', name: 'B', estimatedSizeGb: 6 },
      { modelId: 'c', name: 'C', estimatedSizeGb: 50 },
    ]);
    expect(out.summary.safe).toBe(2);
    expect(out.summary.unsupported).toBe(1);
  });
});

describe('LocalModelDiscovery — fail-safe, never fabricates', () => {
  it('InMemory adapter reports only declared models', async () => {
    const discovery = new InMemoryLocalModelDiscovery('ollama');
    const result = await discovery.discover();
    expect(result.discovered).toBe(false);
    expect(result.models).toHaveLength(0);
    expect(result.statusMessage).toContain('No local runtime declared');

    const withModels = new InMemoryLocalModelDiscovery('ollama', [
      {
        id: 'llama3',
        name: 'llama3',
        status: 'available',
        capabilities: ['reasoning'],
        capabilitiesProvenance: 'INFERRED',
        runtime: 'ollama',
      },
    ]);
    const declared = await withModels.discover();
    expect(declared.discovered).toBe(true);
    expect(declared.models).toHaveLength(1);
    expect(declared.models[0]?.capabilitiesProvenance).toBe('INFERRED');
  });

  it('Ollama adapter fails safe when the endpoint is unreachable', async () => {
    const discovery = new OllamaLocalModelDiscovery('http://localhost:9', {
      fetchFn: async () => {
        throw new Error('connection refused');
      },
    });
    const result = await discovery.discover();
    expect(result.discovered).toBe(false);
    expect(result.models).toHaveLength(0);
    expect(result.statusMessage).toContain('unreachable');
  });

  it('Ollama adapter parses discovered models and marks capabilities INFERRED', async () => {
    const discovery = new OllamaLocalModelDiscovery('http://localhost:11434', {
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            models: [
              { name: 'llama3:8b', size: 4699999999, details: { quantization_level: 'Q4_K_M' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });
    const result = await discovery.discover();
    expect(result.discovered).toBe(true);
    expect(result.models[0]?.id).toBe('llama3:8b');
    expect(result.models[0]?.sizeGb).toBe(4.7);
    expect(result.models[0]?.quantization).toBe('Q4_K_M');
    expect(result.models[0]?.capabilitiesProvenance).toBe('INFERRED');
  });

  it('OpenAI-compatible adapter fails safe on HTTP errors', async () => {
    const discovery = new OpenAICompatibleModelDiscovery('lm-studio', 'http://localhost:9', {
      fetchFn: async () => new Response('not found', { status: 404 }),
    });
    const result = await discovery.discover();
    expect(result.discovered).toBe(false);
    expect(result.statusMessage).toContain('404');
  });
});
