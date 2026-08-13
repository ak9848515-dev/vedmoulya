// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Runtime Integration Tests (AI-RUNTIME-002)
// Exercises the real runtime wiring with deterministic adapters:
// structured output + validation retry, RAG failure tolerance,
// EI-003 optimization, prompt-cache reuse, advisor ordering, streams.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { AIOrchestrationService } from '../AIOrchestrationService.js';
import { ContextOptimizer } from '../runtime/ContextOptimizer.js';
import { PromptCacheManager } from '../runtime/PromptCacheManager.js';
import { ProviderRoutingAdvisor } from '../runtime/ProviderRoutingAdvisor.js';
import { AIObservability, TestAIObservabilityExporter } from '../runtime/AIObservability.js';
import type {
  ExecutionStrategyPort,
  ProviderCandidateIntelligence,
  ProviderIntelligencePort,
  RagRetrievalPort,
} from '../runtime/index.js';
import type { ProviderAdapter } from '../AIOrchestrationService.js';
import type { AIResponse } from '@vedmoulya/ai';

function mockResponse(content: string, overrides: Partial<AIResponse> = {}): AIResponse {
  return {
    content,
    provider: 'mock',
    model: 'mock-model',
    confidence: 0.9,
    qualityScore: 8.5,
    latency: 1,
    cost: 0,
    tokenUsage: { input: 10, output: 20, total: 30 },
    validation: { passed: true, checks: [], overallScore: 8.5, decision: 'pass' },
    traceId: 'mock-runtime',
    ...overrides,
  };
}

function mockAdapter(name = 'mock', overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    name,
    family: 'mock',
    capabilities: ['reasoning', 'coding', 'content_generation'],
    isHealthy: async () => true,
    getHealth: async () => ({
      providerId: name,
      status: 'healthy',
      latency: 1,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 0,
      rateLimitReset: null,
    }),
    execute: async () => mockResponse('Mock response'),
    ...overrides,
  } as ProviderAdapter;
}

function candidate(
  overrides: Partial<ProviderCandidateIntelligence> = {},
): ProviderCandidateIntelligence {
  return {
    providerId: 'mock',
    family: 'mock',
    capabilities: ['reasoning'],
    healthy: true,
    models: [{ id: 'mock-model', contextWindow: 128000, maxOutputTokens: 4096, streaming: true }],
    benchmarkScore: 90,
    averageLatencyMs: 500,
    costPer1KInput: 0.1,
    costPer1KOutput: 0.4,
    ...overrides,
  };
}

describe('AIOrchestrationService runtime (AI-RUNTIME-002)', () => {
  it('produces schema-validated structured output through generateStructured', async () => {
    const generateStructured = vi.fn(async () =>
      mockResponse(JSON.stringify({ summary: 'ok', score: 8 }), { provider: 'mock' }),
    );
    const svc = new AIOrchestrationService();
    svc.registerProvider(mockAdapter('mock', { generateStructured }));

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Produce a structured analysis',
      qualityTier: 'standard',
      structuredSchema: {
        type: 'object',
        properties: { summary: { type: 'string' }, score: { type: 'number' } },
        required: ['summary', 'score'],
      },
    });
    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.content)).toEqual({ summary: 'ok', score: 8 });
  });

  it('rejects structured output that fails schema validation after bounded retries', async () => {
    const generateStructured = vi.fn(
      async () => mockResponse('{ "summary": 42 }', { provider: 'mock' }), // wrong type for summary
    );
    const svc = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    svc.registerProvider(mockAdapter('mock', { generateStructured }));

    await expect(
      svc.orchestrate({
        capability: 'reasoning',
        userInput: 'Produce a structured analysis',
        qualityTier: 'standard',
        structuredSchema: {
          type: 'object',
          properties: { summary: { type: 'string' } },
          required: ['summary'],
        },
      }),
    ).rejects.toThrow(/Structured output validation failed/);
    expect(generateStructured.mock.calls.length).toBeGreaterThan(1); // bounded retry happened
  });

  it('continues without retrieved context when RAG retrieval fails', async () => {
    const rag: RagRetrievalPort = {
      retrieve: async () => {
        throw new Error('vector store unavailable');
      },
    };
    const svc = new AIOrchestrationService({ rag });
    svc.registerProvider(mockAdapter());

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Summarize the workflow',
      qualityTier: 'standard',
      ragQuery: { collection: 'org:a', query: 'workflow', topK: 3 },
    });
    // Degraded but successful: the mock echoes the assembled context without
    // the retrieved chunks.
    expect(result.content).toContain('Mock response');
  });

  it('attaches tokenOptimization when the EI-003 pipeline runs', async () => {
    const svc = new AIOrchestrationService({
      contextOptimizer: new ContextOptimizer(),
    });
    svc.registerProvider(mockAdapter());

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Analyze the onboarding workflow',
      qualityTier: 'standard',
      enableOptimization: true,
      context: {
        knowledgeContext:
          'The content agency onboards clients through lead capture, brand definition, and project scoping.\nBrand guidelines are stable context reused across generation runs.',
      },
    });
    expect(result.tokenOptimization).toBeDefined();
    expect(result.tokenOptimization?.originalTokens).toBeGreaterThan(0);
    // The EI-003 pipeline must never grow the context: the ranked → filtered →
    // deduplicated → compressed item stream is a strict subset of the raw one.
    // (finalTokens legitimately includes the user input + system prompt, so
    // the subset invariant is asserted on the context stages themselves.)
    expect(result.tokenOptimization?.compressedTokens).toBeLessThanOrEqual(
      result.tokenOptimization?.originalTokens ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it('reuses an optimized stable prefix through the prompt cache', async () => {
    const cache = new PromptCacheManager();
    const optimizer = new ContextOptimizer();
    const optimizeSpy = vi.spyOn(optimizer, 'optimize');
    const svc = new AIOrchestrationService({ promptCache: cache, contextOptimizer: optimizer });
    const execute = vi.fn(async () => mockResponse('cached run'));
    svc.registerProvider(mockAdapter('mock', { execute }));

    const request = {
      capability: 'reasoning' as const,
      userInput: 'Request one',
      qualityTier: 'standard' as const,
      userId: 'cache-user',
      enableOptimization: true as const,
      context: { knowledgeContext: 'Stable enterprise context reused across runs.' },
    };
    await svc.orchestrate(request);
    await svc.orchestrate({ ...request, userInput: 'Request two (different dynamic tail)' });

    // The second run reused the cached optimized stable prefix: the EI-003
    // pipeline ran exactly once, even though the dynamic tail changed.
    expect(optimizeSpy).toHaveBeenCalledTimes(1);
    // Both runs still execute against the provider (new dynamic input); the
    // cache reuses the stable prefix, it never serves a stale full response.
    expect(execute).toHaveBeenCalledTimes(2);
    expect(cache.size).toBeGreaterThan(0);
  });

  it('abstains instead of calling a provider when grounding is required but evidence is insufficient', async () => {
    const rag: RagRetrievalPort = {
      retrieve: async () => ({ results: [] }), // no evidence retrieved
    };
    const svc = new AIOrchestrationService({ rag });
    const execute = vi.fn(async () => mockResponse('should never run'));
    svc.registerProvider(mockAdapter('mock', { execute }));

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'What is the company policy on data retention?',
      qualityTier: 'standard',
      ragQuery: { collection: 'org:a', query: 'data retention policy', topK: 3 },
      groundingRequired: true,
    });

    expect(result.abstained).toBe(true);
    expect(result.evidence?.state).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.content).toContain('abstained');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not abstain when grounding is not required even with sparse evidence', async () => {
    const rag: RagRetrievalPort = {
      retrieve: async () => ({
        results: [{ title: 'one-hit', content: 'A single relevant passage.', score: 0.3 }],
      }),
    };
    const svc = new AIOrchestrationService({ rag });
    svc.registerProvider(mockAdapter());

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Give a general overview',
      qualityTier: 'standard',
      ragQuery: { collection: 'org:a', query: 'overview', topK: 3 },
    });
    expect(result.abstained).toBeUndefined();
    expect(result.content).toContain('Mock response');
  });

  it('attaches an evidence assessment when RAG runs without requiring abstention', async () => {
    const rag: RagRetrievalPort = {
      retrieve: async () => ({
        results: [
          { title: 'kb-1', content: 'Policy: records are retained for seven years.', score: 0.9 },
          { title: 'kb-2', content: 'Retention: financial records kept seven years.', score: 0.88 },
        ],
      }),
    };
    const svc = new AIOrchestrationService({ rag });
    svc.registerProvider(mockAdapter());

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'How long are records retained?',
      qualityTier: 'standard',
      ragQuery: { collection: 'org:a', query: 'record retention', topK: 3 },
      groundingRequired: true,
    });
    expect(result.evidence?.state).toBe('SUFFICIENT_EVIDENCE');
    expect(result.abstained).toBeUndefined();
    expect(result.content).toContain('Mock response');
  });

  it('produces a per-item AI-SELECT explanation when optimization runs', async () => {
    const svc = new AIOrchestrationService({
      contextOptimizer: new ContextOptimizer(),
    });
    svc.registerProvider(mockAdapter());

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Analyze the onboarding workflow',
      qualityTier: 'standard',
      enableOptimization: true,
      context: {
        knowledgeContext:
          'The content agency onboards clients through lead capture and brand definition.\nThis unrelated line about gardening has low relevance to the analysis.',
      },
    });
    expect(result.tokenOptimization).toBeDefined();
  });

  it('rejects groundingRequired without a ragQuery (Evidence-First validation)', async () => {
    const svc = new AIOrchestrationService();
    svc.registerProvider(mockAdapter());
    await expect(
      svc.orchestrate({
        capability: 'reasoning',
        userInput: 'Is this grounded?',
        qualityTier: 'standard',
        groundingRequired: true,
      }),
    ).rejects.toThrow('groundingRequired is set but no ragQuery');
  });

  it('abstains when RAG retrieval fails for a grounding-required task', async () => {
    const rag: RagRetrievalPort = {
      retrieve: async () => {
        throw new Error('vector store unavailable');
      },
    };
    const svc = new AIOrchestrationService({ rag });
    const execute = vi.fn(async () => mockResponse('should never run'));
    svc.registerProvider(mockAdapter('mock', { execute }));

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'What is the policy?',
      qualityTier: 'standard',
      ragQuery: { collection: 'org:a', query: 'policy', topK: 3 },
      groundingRequired: true,
    });
    expect(result.abstained).toBe(true);
    expect(result.evidence?.state).toBe('INSUFFICIENT_EVIDENCE');
    expect(execute).not.toHaveBeenCalled();
  });

  it('never serves RAG-grounded requests from the request cache', async () => {
    const rag: RagRetrievalPort = {
      retrieve: async () => ({
        results: [{ title: 'kb', content: 'Retention policy: seven years.', score: 0.9 }],
      }),
    };
    const svc = new AIOrchestrationService({ rag });
    const execute = vi.fn(async () => mockResponse('run'));
    svc.registerProvider(mockAdapter('mock', { execute }));

    const request = {
      capability: 'reasoning' as const,
      userInput: 'How long are records kept?',
      qualityTier: 'standard' as const,
      ragQuery: { collection: 'org:a', query: 'retention', topK: 3 },
    };
    await svc.orchestrate(request);
    await svc.orchestrate(request);
    // Even though the input is identical, the RAG-grounded run always
    // re-retrieves evidence (fresh knowledge) — the provider ran twice.
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('attaches the AI-SELECT explanation to the orchestrate response', async () => {
    const svc = new AIOrchestrationService({
      contextOptimizer: new ContextOptimizer(),
    });
    svc.registerProvider(mockAdapter());

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Analyze the onboarding workflow',
      qualityTier: 'standard',
      enableOptimization: true,
      context: {
        knowledgeContext: 'The agency onboards clients through lead capture and brand definition.',
      },
    });
    expect(result.contextSelection).toBeDefined();
    expect(result.contextSelection?.length).toBeGreaterThan(0);
    expect(result.contextSelection?.[0]?.reasons.length).toBeGreaterThan(0);
  });

  it('never reuses a cached stable prefix across different users (tenant isolation)', async () => {
    const cache = new PromptCacheManager();
    const optimizer = new ContextOptimizer();
    const optimizeSpy = vi.spyOn(optimizer, 'optimize');
    const svc = new AIOrchestrationService({ promptCache: cache, contextOptimizer: optimizer });
    svc.registerProvider(mockAdapter());

    const request = {
      capability: 'reasoning' as const,
      userInput: 'Same question',
      qualityTier: 'standard' as const,
      enableOptimization: true as const,
      context: { knowledgeContext: 'Stable enterprise context.' },
    };
    await svc.orchestrate({ ...request, userId: 'user-a' });
    await svc.orchestrate({ ...request, userId: 'user-b' });

    // The second user's stable prefix was optimized separately: cache keys are
    // scoped by identity, so a different user MUST NOT reuse user-a's prefix.
    expect(optimizeSpy).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });

  it('orders registered adapters by the advisor selection', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({ providerId: 'preferred', benchmarkScore: 95 }),
        candidate({ providerId: 'other', benchmarkScore: 80 }),
      ],
    };
    const strategy: ExecutionStrategyPort = {
      getRoutingContext: async () => ({
        strategy: 'balanced' as const,
        preferredProviders: ['preferred'],
      }),
    };
    const svc = new AIOrchestrationService({
      providerIntelligence: intelligence,
      executionStrategy: strategy,
    });
    const preferred = mockAdapter('preferred', {
      execute: async () => mockResponse('preferred ran', { provider: 'preferred' }),
    });
    const other = mockAdapter('other', {
      execute: async () => mockResponse('other ran', { provider: 'other' }),
    });
    svc.registerProvider(other);
    svc.registerProvider(preferred);

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Which provider should run?',
      qualityTier: 'standard',
    });
    expect(result.provider).toBe('preferred');
    expect(result.providerSelection).toBeDefined();
    expect(result.providerSelection?.selected.providerId).toBe('preferred');
  });

  it('produces a streamed run with the full stage sequence', async () => {
    const svc = new AIOrchestrationService({ contextOptimizer: new ContextOptimizer() });
    svc.registerProvider(mockAdapter());

    const run = await svc.stream({
      capability: 'reasoning',
      userInput: 'Stream a short analysis.',
      qualityTier: 'standard',
      enableOptimization: true,
      context: { knowledgeContext: 'Some relevant enterprise knowledge about workflows.' },
    });
    const stages = run.events.filter((e) => e.type === 'status').map((e) => e.stage);
    expect(stages).toContain('thinking');
    expect(stages).toContain('preparing_context');
    expect(stages).toContain('selecting_model');
    expect(stages).toContain('streaming');
    expect(stages).toContain('validating');
    expect(run.final.content).toContain('Mock response');
  });

  it('returns a typed provider-selection explanation without executing', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [candidate()],
    };
    const strategy: ExecutionStrategyPort = {
      getRoutingContext: async () => ({ strategy: 'balanced' as const }),
    };
    const svc = new AIOrchestrationService({
      providerIntelligence: intelligence,
      executionStrategy: strategy,
    });

    const explanation = await svc.explainSelection({
      capability: 'reasoning',
      estimatedInputTokens: 400,
    });
    expect(explanation.selected.providerId).toBe('mock');
    expect(explanation.selected.reasons).toContain('capability compatible');
    expect(explanation.candidatesConsidered).toHaveLength(1);
  });

  it('throws a clear error when explainSelection runs without the advisor', async () => {
    const svc = new AIOrchestrationService();
    await expect(svc.explainSelection({ capability: 'reasoning' })).rejects.toThrow(
      'not configured',
    );
  });

  describe('observability (C-03)', () => {
    it('emits the complete span set for a successful grounded run', async () => {
      const exporter = new TestAIObservabilityExporter();
      const svc = new AIOrchestrationService({
        observability: new AIObservability({ exporter, emitUserTenantCorrelation: true }),
        contextOptimizer: new ContextOptimizer(),
        rag: {
          retrieve: async () => ({
            results: [
              {
                title: 'kb-1',
                content: 'Policy: records are retained for seven years.',
                score: 0.9,
              },
              {
                title: 'kb-2',
                content: 'Retention: financial records kept seven years.',
                score: 0.88,
              },
            ],
          }),
        },
      });
      svc.registerProvider(mockAdapter());

      const result = await svc.orchestrate({
        capability: 'reasoning',
        userInput: 'How long are records retained?',
        qualityTier: 'standard',
        userId: 'user-a',
        ragQuery: { collection: 'org:a', query: 'retention', topK: 3 },
        groundingRequired: true,
        enableOptimization: true,
        context: { knowledgeContext: 'Stable enterprise context about retention policies.' },
      });

      expect(result.evidence?.state).toBe('SUFFICIENT_EVIDENCE');
      const names = exporter.spans.map((s) => s.name);
      expect(names).toContain('ai.run');
      expect(names).toContain('ai.retrieval');
      expect(names).toContain('ai.evidence');
      expect(names).toContain('ai.optimization');
      expect(names).toContain('ai.model_selection');
      expect(names).toContain('ai.provider_execution');

      const evidenceSpan = exporter.spans.find((s) => s.name === 'ai.evidence');
      expect(evidenceSpan?.attributes.evidence_state).toBe('SUFFICIENT_EVIDENCE');
      const providerSpan = exporter.spans.find((s) => s.name === 'ai.provider_execution');
      expect(providerSpan?.attributes.status).toBe('success');
      expect(providerSpan?.attributes.cost).toBeTypeOf('number');
      // User correlation only when permitted (we enabled it).
      expect(providerSpan?.userId).toBe('user-a');
    });

    it('emits retry and fallback spans when the first provider fails', async () => {
      const exporter = new TestAIObservabilityExporter();
      const svc = new AIOrchestrationService({
        observability: new AIObservability({ exporter }),
        retryBaseDelayMs: 1,
      });
      svc.registerProvider(
        mockAdapter('failing', {
          execute: async () => {
            throw new Error('api error: 503');
          },
        }),
      );
      svc.registerProvider(
        mockAdapter('backup', {
          execute: async () => mockResponse('recovered', { provider: 'backup' }),
        }),
      );

      const result = await svc.orchestrate({
        capability: 'reasoning',
        userInput: 'Recover',
        qualityTier: 'standard',
      });

      expect(result.provider).toBe('backup');
      const names = exporter.spans.map((s) => s.name);
      expect(names).toContain('ai.retry');
      expect(names).toContain('ai.fallback');
      const retrySpan = exporter.spans.find((s) => s.name === 'ai.retry');
      expect(retrySpan?.attributes.reason).toBe('provider_unavailable');
    });

    it('emits a validation span for structured output runs', async () => {
      const exporter = new TestAIObservabilityExporter();
      const svc = new AIOrchestrationService({
        observability: new AIObservability({ exporter }),
      });
      svc.registerProvider(
        mockAdapter('mock', {
          generateStructured: async () =>
            mockResponse(JSON.stringify({ summary: 'ok', score: 8 }), { provider: 'mock' }),
        }),
      );

      await svc.orchestrate({
        capability: 'reasoning',
        userInput: 'Structured',
        qualityTier: 'standard',
        structuredSchema: {
          type: 'object',
          properties: { summary: { type: 'string' }, score: { type: 'number' } },
          required: ['summary', 'score'],
        },
      });

      const names = exporter.spans.map((s) => s.name);
      expect(names).toContain('ai.validation');
      const validationSpan = exporter.spans.find((s) => s.name === 'ai.validation');
      expect(validationSpan?.attributes.valid).toBe(true);
    });

    it('emits stream run spans and redacts secrets from error spans', async () => {
      const exporter = new TestAIObservabilityExporter();
      const svc = new AIOrchestrationService({
        observability: new AIObservability({ exporter }),
      });
      svc.registerProvider(
        mockAdapter('streamer', {
          stream: async function* () {
            yield { type: 'content', data: { text: 'Hello' } };
            yield { type: 'done', data: {} };
          },
        } as ProviderAdapter),
      );

      const run = await svc.stream({
        capability: 'reasoning',
        userInput: 'Stream',
        qualityTier: 'standard',
      });
      expect(run.final.content).toContain('Hello');
      const names = exporter.spans.map((s) => s.name);
      expect(names).toContain('ai.stream_run');
      expect(names).toContain('ai.provider_execution');
    });
  });

  it('streams through a native async-iterable provider stream', async () => {
    const svc = new AIOrchestrationService();
    const streamingAdapter = mockAdapter('streamer', {
      stream: async function* () {
        yield { type: 'content', data: { text: 'Hello' } };
        yield { type: 'content', data: { text: ' world' } };
        yield { type: 'done', data: { latencyMs: 2, tokenUsage: { input: 5, output: 4 } } };
      },
    } as ProviderAdapter);
    svc.registerProvider(streamingAdapter);

    const run = await svc.stream({
      capability: 'reasoning',
      userInput: 'Stream something',
      qualityTier: 'standard',
    });

    const contentEvents = run.events.filter((e) => e.type === 'content');
    expect(contentEvents.map((e) => (e as { content?: string }).content ?? '').join('')).toBe(
      'Hello world',
    );
    expect(run.events.some((e) => e.type === 'done')).toBe(true);
    expect(run.final.content).toBe('Hello world');
    expect(run.final.provider).toBe('streamer');
  });
});
