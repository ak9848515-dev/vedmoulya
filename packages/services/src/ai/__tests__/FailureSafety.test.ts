// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Runtime Failure-Safety Suite (AI-RUNTIME-002 C-05)
//
// Proves the failure behaviour contract:
//   - OPTIONAL infrastructure failure may degrade safely.
//   - GROUNDING-REQUIRED failure MUST NOT fabricate (abstain).
//   - Telemetry failure MUST NOT break the AI request.
//   - Cache failure MUST NOT expose another user's data.
//   - Provider failure uses bounded retry/fallback.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { AIOrchestrationService } from '../AIOrchestrationService.js';
import { ContextOptimizer } from '../runtime/ContextOptimizer.js';
import { PromptCacheManager } from '../runtime/PromptCacheManager.js';
import { AIObservability, TestAIObservabilityExporter } from '../runtime/AIObservability.js';
import { ToolRegistry, registerSafeTools, ECHO_TOOL } from '../runtime/ToolRuntime.js';
import type { RagRetrievalPort } from '../runtime/index.js';
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

const ragThatThrows = (message: string): RagRetrievalPort => ({
  retrieve: async () => {
    throw new Error(message);
  },
});

describe('C-05 failure safety: optional infrastructure may degrade safely', () => {
  it('database unavailable — non-grounding request continues without retrieved context', async () => {
    const svc = new AIOrchestrationService({ rag: ragThatThrows('database connection refused') });
    svc.registerProvider(mockAdapter());
    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Summarize',
      qualityTier: 'standard',
      ragQuery: { collection: 'org:a', query: 'x', topK: 3 },
    });
    expect(result.content).toContain('Mock response');
    expect(result.abstained).toBeUndefined();
  });

  it('vector store unavailable — non-grounding request degrades to context-free execution', async () => {
    const svc = new AIOrchestrationService({ rag: ragThatThrows('vector store unavailable') });
    svc.registerProvider(mockAdapter());
    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Analyze',
      qualityTier: 'standard',
      ragQuery: { collection: 'org:a', query: 'x', topK: 3 },
    });
    expect(result.content).toContain('Mock response');
  });

  it('retrieval timeout — non-grounding request still completes', async () => {
    const svc = new AIOrchestrationService({
      rag: {
        retrieve: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw new Error('retrieval timed out');
        },
      },
    });
    svc.registerProvider(mockAdapter());
    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Analyze',
      qualityTier: 'standard',
      ragQuery: { collection: 'org:a', query: 'x', topK: 3 },
    });
    expect(result.content).toContain('Mock response');
  });
});

describe('C-05 failure safety: grounding-required failures MUST NOT fabricate', () => {
  it('database unavailable on a grounding-required task → typed abstention, provider never called', async () => {
    const svc = new AIOrchestrationService({ rag: ragThatThrows('database connection refused') });
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
    expect(result.content).toContain('abstained');
    expect(execute).not.toHaveBeenCalled();
  });

  it('retrieval timeout on a grounding-required task → abstention', async () => {
    const svc = new AIOrchestrationService({
      rag: {
        retrieve: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw new Error('retrieval timed out');
        },
      },
    });
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
    expect(execute).not.toHaveBeenCalled();
  });

  it('conflicting evidence → abstention (never pick a side by fabricating)', async () => {
    const rag: RagRetrievalPort = {
      retrieve: async () => ({
        results: [
          {
            title: 'source-a',
            content: 'Records are retained for seven years.',
            score: 0.9,
            source: 'doc-retention-a',
          },
          {
            title: 'source-b',
            content: 'Records are deleted after thirty days.',
            score: 0.88,
            source: 'doc-retention-b',
          },
        ],
      }),
    };
    const svc = new AIOrchestrationService({ rag });
    const execute = vi.fn(async () => mockResponse('should never run'));
    svc.registerProvider(mockAdapter('mock', { execute }));
    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'How long are records retained?',
      qualityTier: 'standard',
      ragQuery: { collection: 'org:a', query: 'retention', topK: 3 },
      groundingRequired: true,
    });
    expect(result.abstained).toBe(true);
    expect(result.evidence?.state).toBe('CONFLICTING_EVIDENCE');
    expect(execute).not.toHaveBeenCalled();
  });

  it('insufficient evidence on a grounding-required task → abstention', async () => {
    const svc = new AIOrchestrationService({
      rag: { retrieve: async () => ({ results: [] }) },
    });
    const execute = vi.fn(async () => mockResponse('should never run'));
    svc.registerProvider(mockAdapter('mock', { execute }));
    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Unknown topic',
      qualityTier: 'standard',
      ragQuery: { collection: 'org:a', query: 'unknown', topK: 3 },
      groundingRequired: true,
    });
    expect(result.abstained).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('C-05 failure safety: provider failures use bounded retry/fallback', () => {
  it('provider 429 (rate limited) → retries then recovers on the same provider', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('api error: 429 rate limit exceeded'))
      .mockResolvedValueOnce(mockResponse('recovered'));
    const svc = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    svc.registerProvider(mockAdapter('mock', { execute }));

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Retry me',
      qualityTier: 'standard',
    });
    expect(result.content).toContain('recovered');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('provider 5xx → retries, then falls back to the next provider', async () => {
    const failing = vi.fn(async () => {
      throw new Error('api error: 503 service unavailable');
    });
    const svc = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    svc.registerProvider(mockAdapter('failing', { execute: failing }));
    svc.registerProvider(
      mockAdapter('backup', {
        execute: async () => mockResponse('backup answered', { provider: 'backup' }),
      }),
    );

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Fall back',
      qualityTier: 'standard',
    });
    expect(result.provider).toBe('backup');
    expect(failing).toHaveBeenCalled();
  });

  it('provider timeout → classified, retried, then falls back', async () => {
    const timeoutProvider = vi.fn(async () => {
      throw new Error('request timed out after 60000ms');
    });
    const svc = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    svc.registerProvider(mockAdapter('slow', { execute: timeoutProvider }));
    svc.registerProvider(
      mockAdapter('fast', {
        execute: async () => mockResponse('fast answer', { provider: 'fast' }),
      }),
    );

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Timeout test',
      qualityTier: 'standard',
    });
    expect(result.provider).toBe('fast');
  });

  it('all providers failing → clear typed error, never a fabricated answer', async () => {
    const svc = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    svc.registerProvider(
      mockAdapter('a', {
        execute: async () => {
          throw new Error('api error: 500 internal server error');
        },
      }),
    );
    svc.registerProvider(
      mockAdapter('b', {
        execute: async () => {
          throw new Error('api error: 502 bad gateway');
        },
      }),
    );

    await expect(
      svc.orchestrate({
        capability: 'reasoning',
        userInput: 'Both down',
        qualityTier: 'standard',
      }),
    ).rejects.toThrow(/500|502|failed|unavailable/i);
  });
});

describe('C-05 failure safety: malformed model output and budgets', () => {
  it('malformed structured output → bounded retry → safe typed failure (no unvalidated truth)', async () => {
    const generateStructured = vi.fn(async () =>
      mockResponse('{ not valid json', { provider: 'mock' }),
    );
    const svc = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    svc.registerProvider(mockAdapter('mock', { generateStructured }));

    await expect(
      svc.orchestrate({
        capability: 'reasoning',
        userInput: 'Structured',
        qualityTier: 'standard',
        structuredSchema: {
          type: 'object',
          properties: { summary: { type: 'string' } },
          required: ['summary'],
        },
      }),
    ).rejects.toThrow(/Structured output validation failed|failed/i);
    // Bounded: 3 retries + first attempt = 4 calls max; must not loop forever.
    expect(generateStructured.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('token budget exceeded → request fails cheaply with a ValidationError before the provider', async () => {
    const execute = vi.fn(async () => mockResponse('should never run'));
    const svc = new AIOrchestrationService();
    svc.registerProvider(mockAdapter('mock', { execute }));

    await expect(
      svc.orchestrate({
        capability: 'reasoning',
        userInput: 'x'.repeat(2000),
        qualityTier: 'standard',
        constraints: { maxInputTokens: 50 },
      }),
    ).rejects.toThrow(/maxInputTokens budget/i);
    expect(execute).not.toHaveBeenCalled();
  });

  it('context window exceeded even after optimization → fails clearly, never silently truncates', async () => {
    // 2 000 DISTINCT sentences (no dedupe target): compression cannot reduce
    // this to a 200-token budget, so the pipeline must fail loudly instead of
    // silently dropping required evidence.
    const hugeContext = Array.from(
      { length: 2_000 },
      (_, i) =>
        `Enterprise policy clause ${String(i)} requires distinct relevant content that cannot be compressed away from the grounded analysis pipeline.`,
    ).join('\n');
    const svc = new AIOrchestrationService({
      contextOptimizer: new ContextOptimizer(),
    });
    svc.registerProvider(mockAdapter());

    await expect(
      svc.orchestrate({
        capability: 'reasoning',
        userInput: 'Analyze every clause of the enterprise policy.',
        qualityTier: 'standard',
        enableOptimization: true,
        context: { knowledgeContext: hugeContext },
        constraints: { maxInputTokens: 200 },
      }),
    ).rejects.toThrow(/maxInputTokens budget|exceeds/i);
  });
});

describe('C-05 failure safety: telemetry, cache and authorization failures', () => {
  it('telemetry failure never breaks the AI request', async () => {
    const exporter = {
      exportSpan: (): void => {
        throw new Error('exporter crashed');
      },
    };
    const svc = new AIOrchestrationService({
      observability: new AIObservability({ exporter }),
    });
    svc.registerProvider(mockAdapter());

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Run with broken telemetry',
      qualityTier: 'standard',
    });
    expect(result.content).toContain('Mock response');
  });

  it('request-cache failures do not expose another user’s data', async () => {
    const svc = new AIOrchestrationService();
    const execute = vi.fn(async () => mockResponse('user-scoped'));
    svc.registerProvider(mockAdapter('mock', { execute }));

    const request = {
      capability: 'reasoning' as const,
      userInput: 'Same input',
      qualityTier: 'standard' as const,
    };
    const a = await svc.orchestrate({ ...request, userId: 'user-a' });
    const b = await svc.orchestrate({ ...request, userId: 'user-b' });
    // Different users never share a cached response: both reached the provider.
    expect(execute).toHaveBeenCalledTimes(2);
    expect(a.content).toBe(b.content); // same deterministic mock — but computed twice
  });

  it('prompt-cache failures degrade safely (cache miss, provider still runs)', async () => {
    const failingCache = {
      keyFor: (): string => 'key',
      get: (): unknown => {
        throw new Error('cache corrupted');
      },
      set: (): void => {
        throw new Error('cache corrupted');
      },
      size: 0,
    } as unknown as PromptCacheManager;
    const svc = new AIOrchestrationService({ promptCache: failingCache });
    const execute = vi.fn(async () => mockResponse('ran'));
    svc.registerProvider(mockAdapter('mock', { execute }));

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Cache test',
      qualityTier: 'standard',
      context: { knowledgeContext: 'Some context.' },
    });
    expect(result.content).toContain('ran');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('tool authorization failure blocks execution before the handler', async () => {
    const registry = new ToolRegistry({
      denylist: ['echo'],
      grantedCapabilities: ['reasoning'],
    });
    registerSafeTools(registry);
    const result = await registry.execute({
      toolName: 'echo',
      arguments: { text: 'ping' },
      userId: 'user-a',
    });
    expect(result.denied).toBe(true);
    expect(result.outcome).toBe('authorization_error');
    expect(registry.getAuditTrail().some((e) => e.toolName === 'echo' && e.denied)).toBe(true);
  });

  it('stream() failures surface typed errors and never fabricate a success', async () => {
    const svc = new AIOrchestrationService();
    svc.registerProvider(
      mockAdapter('broken-stream', {
        stream: async function* () {
          throw new Error('stream connection reset');
        },
      } as ProviderAdapter),
    );

    await expect(
      svc.stream({
        capability: 'reasoning',
        userInput: 'Stream',
        qualityTier: 'standard',
      }),
    ).rejects.toThrow(/stream/i);
  });
});

describe('C-05 failure safety: observability error spans are redacted', () => {
  it('a provider error containing a credential does not leak it into telemetry', async () => {
    const exporter = new TestAIObservabilityExporter();
    const svc = new AIOrchestrationService({
      observability: new AIObservability({ exporter }),
      retryBaseDelayMs: 1,
    });
    svc.registerProvider(
      mockAdapter('leaky', {
        execute: async () => {
          throw new Error('api error: 401 unauthorized with key sk-abc12345def67890ghi');
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
      userInput: 'Leak test',
      qualityTier: 'standard',
    });
    expect(result.provider).toBe('backup');
    const errors = exporter.spans.map((s) => s.error ?? '').join('\n');
    expect(errors).not.toMatch(/sk-abc12345def67890ghi/);
  });
});
