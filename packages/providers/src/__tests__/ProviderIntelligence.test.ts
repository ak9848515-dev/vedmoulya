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
import { ProviderVersion } from '../domain/value-objects/ProviderVersion.js';

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

  it('Ollama adapter fails safe on a non-2xx response', async () => {
    const discovery = new OllamaLocalModelDiscovery('http://localhost:11434', {
      fetchFn: async () => new Response('boom', { status: 500 }),
    });
    const result = await discovery.discover();
    expect(result.discovered).toBe(false);
    expect(result.statusMessage).toContain('HTTP 500');
  });

  it('Ollama adapter handles an empty model list and string sizes', async () => {
    const discovery = new OllamaLocalModelDiscovery('http://localhost:11434', {
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            models: [{ name: 'tiny', size: '4.7GB', details: {} }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });
    const result = await discovery.discover();
    expect(result.discovered).toBe(true);
    expect(result.models[0]?.sizeGb).toBe(4.7);
    expect(result.statusMessage).toContain('Discovered 1 model(s)');

    const empty = new OllamaLocalModelDiscovery('http://localhost:11434', {
      fetchFn: async () =>
        new Response(JSON.stringify({ models: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    const emptyResult = await empty.discover();
    expect(emptyResult.discovered).toBe(true);
    expect(emptyResult.models).toHaveLength(0);
  });

  it('OpenAI-compatible adapter parses discovered models on success', async () => {
    const discovery = new OpenAICompatibleModelDiscovery('lm-studio', 'http://localhost:1234', {
      fetchFn: async () =>
        new Response(JSON.stringify({ data: [{ id: 'local-llama' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    const result = await discovery.discover();
    expect(result.discovered).toBe(true);
    expect(result.models[0]?.id).toBe('local-llama');
    expect(result.models[0]?.capabilitiesProvenance).toBe('INFERRED');
  });

  it('OpenAI-compatible adapter fails safe when the endpoint is unreachable', async () => {
    const discovery = new OpenAICompatibleModelDiscovery('lm-studio', 'http://localhost:9', {
      fetchFn: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    const result = await discovery.discover();
    expect(result.discovered).toBe(false);
    expect(result.statusMessage).toContain('unreachable');
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('OpenAI-compatible adapter supports the openai-compatible runtime default', async () => {
    const discovery = new OpenAICompatibleModelDiscovery('openai-compatible', undefined, {
      fetchFn: async () =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    const result = await discovery.discover();
    expect(result.runtime).toBe('openai-compatible');
    expect(result.discovered).toBe(true);
  });
});

describe('ProviderIntelligenceService — capability labels and free-availability branches', () => {
  it('maps capability labels and deduplicates vision/audio/embeddings flags', () => {
    const provider = makeProvider({
      id: 'multimodal',
      family: 'openai',
      name: 'Multimodal',
      input: 3,
      output: 15,
      models: [
        {
          id: 'mm1',
          name: 'Multimodal One',
          contextLength: 200000,
          maxOutputTokens: 8192,
          streaming: true,
          vision: true,
          functionCalling: true,
          embeddings: true,
          reasoning: true,
          coding: false,
          creativeWriting: false,
          translation: false,
          image: true,
          audio: true,
          video: false,
          modalities: ['text', 'image', 'audio'],
          capabilities: [
            'vision',
            'speech',
            'image_understanding',
            'content_generation',
            'general_conversation',
            'summarization',
            'classification',
            'translation',
          ],
        },
      ],
    });
    const model = new ProviderIntelligenceService().buildProfile(provider).models[0];
    expect(model?.capabilities.value).toContain('audio');
    expect(model?.capabilities.value).toContain('embeddings');
    expect(model?.capabilities.value).toContain('chat');
    expect(model?.capabilities.value).toContain('generation');
    // vision is added once despite being both a flag and a capability label.
    expect(model?.capabilities.value.filter((c) => c === 'vision')).toHaveLength(1);
  });

  it('classifies a quota-limited free tier as limited availability', () => {
    const provider = makeProvider({
      id: 'google',
      family: 'google',
      name: 'Google',
      costTier: 'free',
      input: 0.5,
      output: 2,
    });
    const model = new ProviderIntelligenceService().buildProfile(provider).models[0];
    expect(model?.resourceType).toBe('FREE_API_QUOTA');
    expect(model?.freeAvailability.value).toBe('limited');
  });

  it('classifies an enterprise-tagged provider as paid', () => {
    const provider = makeProvider({
      id: 'anthropic-ent',
      family: 'anthropic',
      name: 'Anthropic Ent',
      costTier: 'high',
      input: 5,
      output: 25,
      tags: ['enterprise'],
    });
    const model = new ProviderIntelligenceService().buildProfile(provider).models[0];
    expect(model?.resourceType).toBe('ENTERPRISE');
    expect(model?.freeAvailability.value).toBe('paid');
  });

  it('marks measured latency as MEASURED after a health sample', () => {
    const provider = makeProvider({ id: 'measured', family: 'mock', name: 'Measured' });
    provider.recordHealthSample({ ok: true, latencyMs: 42 });
    const model = new ProviderIntelligenceService().buildProfile(provider).models[0];
    expect(model?.latencyMs.provenance).toBe('MEASURED');
    expect(model?.latencyMs.value).toBe(42);
  });

  it('structured output is false when neither function-calling nor reasoning is declared', () => {
    const provider = makeProvider({
      id: 'plain',
      family: 'mock',
      name: 'Plain',
      models: [
        {
          id: 'p1',
          name: 'Plain One',
          contextLength: 4096,
          maxOutputTokens: 1024,
          streaming: false,
          vision: false,
          functionCalling: false,
          embeddings: false,
          reasoning: false,
          coding: false,
          creativeWriting: false,
          translation: false,
          image: false,
          audio: false,
          video: false,
          modalities: ['text'],
          capabilities: [],
        },
      ],
    });
    const model = new ProviderIntelligenceService().buildProfile(provider).models[0];
    expect(model?.structuredOutput.value).toBe(false);
    expect(model?.structuredOutput.provenance).toBe('PROVIDER_DECLARED');
  });
});

describe('ProviderVersion — value object', () => {
  it('parses, bumps and compares versions', () => {
    const v = ProviderVersion.fromString('2.3.4');
    expect(v.toString()).toBe('2.3.4');
    expect(v.bumpMajor().toString()).toBe('3.0.0');
    expect(v.bumpMinor().toString()).toBe('2.4.0');
    expect(v.bumpPatch().toString()).toBe('2.3.5');
    expect(v.equals(ProviderVersion.fromString('2.3.4'))).toBe(true);
    expect(v.equals(ProviderVersion.fromString('2.3.5'))).toBe(false);
    expect(ProviderVersion.fromString('garbage').toString()).toBe('1.0.0');
    expect(ProviderVersion.fromString('2').toString()).toBe('2.0.0');
    expect(ProviderVersion.initial().toString()).toBe('1.0.0');
  });
});
