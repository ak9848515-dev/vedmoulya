// ──────────────────────────────────────────────────────────────────
// VedMoulya — End-to-End Production Path Test (AI-RUNTIME-002 C-12)
//
// Proves the complete pipeline contract for BOTH orchestrate() and stream():
//
//   USER → AUTH → REQUIREMENT ANALYSIS → RAG → EVIDENCE EVALUATION →
//   AI-SELECT → CONTEXT OPTIMIZATION → MODEL SELECTION → TOKEN BUDGET →
//   Vercel AI SDK → PROVIDER → STRUCTURED OUTPUT → QUALITY VALIDATION →
//   TELEMETRY → TYPED RESPONSE → UI
//
// Every stage is observable and asserted: retrieval evidence, evidence
// assessment, per-item AI-SELECT explanations, token optimization, provider
// selection, budget guarding, structured output validation, observability
// spans, and the typed DTO contract the UI consumes.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { AIOrchestrationService } from '../AIOrchestrationService.js';
import { ContextOptimizer } from '../runtime/ContextOptimizer.js';
import { PromptCacheManager } from '../runtime/PromptCacheManager.js';
import { AIObservability, TestAIObservabilityExporter } from '../runtime/AIObservability.js';
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

/**
 * A RAG port with agreeing evidence (sufficient grounding). The two docs
 * state the SAME policy with near-identical wording, so the conflict
 * heuristic (mid-band similarity = disagreement) does NOT fire — the runtime
 * must return SUFFICIENT_EVIDENCE and serve, not abstain.
 */
function groundedRag(): RagRetrievalPort {
  return {
    retrieve: async () => ({
      results: [
        {
          title: 'retention-hr',
          content:
            'According to the HR policy, personnel records are retained for seven years after an employee leaves the company.',
          score: 0.82,
          source: 'doc-retention-hr',
        },
        {
          title: 'retention-hr-copy',
          content:
            'According to the HR policy, personnel records are retained for seven years after an employee leaves the company.',
          score: 0.8,
          source: 'doc-retention-hr-copy',
        },
      ],
    }),
  };
}

function buildRuntime(
  options: { exporter?: TestAIObservabilityExporter; rag?: RagRetrievalPort } = {},
): {
  svc: AIOrchestrationService;
  exporter: TestAIObservabilityExporter;
} {
  const exporter = options.exporter ?? new TestAIObservabilityExporter();
  const svc = new AIOrchestrationService({
    contextOptimizer: new ContextOptimizer(),
    promptCache: new PromptCacheManager(),
    rag: options.rag ?? groundedRag(),
    observability: new AIObservability({
      exporter,
      emitUserTenantCorrelation: true,
      payloadCapture: {
        captureUserInput: true,
        captureRetrievedContent: true,
        captureModelOutput: true,
      },
    }),
  });
  svc.registerProvider(mockAdapter());
  return { svc, exporter };
}

const GROUNDED_REQUEST = {
  capability: 'reasoning' as const,
  userInput: 'How long are personnel records retained?',
  qualityTier: 'standard' as const,
  userId: 'user-a',
  ragQuery: { collection: 'org:retention', query: 'personnel records retention', topK: 5 },
  groundingRequired: true,
  enableOptimization: true,
  context: {
    knowledgeContext: [
      'Policy digest: records retention is governed by the HR and finance frameworks.',
      'The cafeteria menu rotates weekly.',
    ].join('\n'),
  },
  constraints: { maxInputTokens: 3000, maxOutputTokens: 200 },
};

describe('C-12 end-to-end production path: orchestrate()', () => {
  it('exercises the full chain and returns the typed UI contract', async () => {
    const { svc, exporter } = buildRuntime();

    const result = await svc.orchestrate(GROUNDED_REQUEST);

    // ── TYPED RESPONSE (UI contract) ───────────────────────────────
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.traceId).toBeDefined();

    // ── EVIDENCE EVALUATION ─────────────────────────────────────────
    expect(result.evidence).toBeDefined();
    expect(result.evidence?.state).toBe('SUFFICIENT_EVIDENCE');
    expect(result.evidence?.evidenceCount).toBe(2);
    expect(result.abstained).toBeUndefined();

    // ── AI-SELECT ───────────────────────────────────────────────────
    expect(result.contextSelection).toBeDefined();
    const selected = result.contextSelection?.filter((s) => s.selected);
    expect(selected?.length).toBeGreaterThan(0);
    for (const item of selected ?? []) {
      expect(item.reasons.length).toBeGreaterThan(0);
      expect(item.tokens).toBeGreaterThan(0);
    }

    // ── CONTEXT OPTIMIZATION ────────────────────────────────────────
    expect(result.tokenOptimization).toBeDefined();
    expect(result.tokenOptimization?.originalTokens).toBeGreaterThan(0);
    expect(result.tokenOptimization?.compressedTokens).toBeLessThanOrEqual(
      result.tokenOptimization?.originalTokens ?? Number.MAX_SAFE_INTEGER,
    );

    // ── PROVIDER SELECTION ──────────────────────────────────────────
    expect(result.provider).toBe('mock');

    // ── QUALITY VALIDATION ──────────────────────────────────────────
    expect(result.validation).toBeDefined();

    // ── TELEMETRY ───────────────────────────────────────────────────
    const names = exporter.spans.map((s) => s.name);
    expect(names).toContain('ai.run');
    expect(names).toContain('ai.retrieval');
    expect(names).toContain('ai.evidence');
    expect(names).toContain('ai.optimization');
    expect(names).toContain('ai.model_selection');
    expect(names).toContain('ai.provider_execution');
    const evidenceSpan = exporter.spans.find((s) => s.name === 'ai.evidence');
    expect(evidenceSpan?.attributes.evidence_state).toBe('SUFFICIENT_EVIDENCE');
    // Payload capture is enabled but redacted + truncated; user correlation
    // is permitted here.
    expect(exporter.spans.some((s) => s.userId === 'user-a')).toBe(true);
  });

  it('guards the token budget BEFORE any provider call', async () => {
    const { svc } = buildRuntime({ rag: undefined });
    const execute = vi.fn(async () => mockResponse('should not run'));
    svc.registerProvider(mockAdapter('mock', { execute }));

    await expect(
      svc.orchestrate({
        capability: 'reasoning',
        userInput: 'x'.repeat(2000),
        qualityTier: 'standard',
        constraints: { maxInputTokens: 60, maxOutputTokens: 64 },
      }),
    ).rejects.toThrow(/maxInputTokens budget/i);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a request that requires grounding without evidence retrieval', async () => {
    const { svc } = buildRuntime();
    await expect(
      svc.orchestrate({
        ...GROUNDED_REQUEST,
        ragQuery: undefined,
      }),
    ).rejects.toThrow(/groundingRequired is set but no ragQuery/i);
  });
});

describe('C-12 end-to-end production path: stream()', () => {
  it('exercises the full chain and returns the typed run + final DTO', async () => {
    const exporter = new TestAIObservabilityExporter();
    const svc = new AIOrchestrationService({
      contextOptimizer: new ContextOptimizer(),
      promptCache: new PromptCacheManager(),
      rag: groundedRag(),
      observability: new AIObservability({
        exporter,
        emitUserTenantCorrelation: true,
      }),
    });
    const streamingMock = mockAdapter('streamer', {
      stream: async function* () {
        yield { type: 'content', data: { text: 'Records are retained for seven years. ' } };
        yield { type: 'content', data: { text: 'Financial records for ten years.' } };
        yield { type: 'done', data: { latencyMs: 1, tokenUsage: { input: 10, output: 8 } } };
      },
    } as ProviderAdapter);
    svc.registerProvider(streamingMock);

    const run = await svc.stream(GROUNDED_REQUEST);

    // ── STAGE SEQUENCE (the UI renders these) ───────────────────────
    const stages = run.events.filter((e) => e.type === 'status').map((e) => e.stage);
    expect(stages).toContain('thinking');
    expect(stages).toContain('preparing_context');
    expect(stages).toContain('selecting_model');
    expect(stages).toContain('streaming');
    expect(stages).toContain('validating');
    expect(run.events.some((e) => e.type === 'done')).toBe(true);

    // ── STREAMED CONTENT ────────────────────────────────────────────
    expect(run.final.content).toContain('seven years');
    expect(run.final.provider).toBe('streamer');

    // ── EVIDENCE + OPTIMIZATION + AI-SELECT on the streamed path ────
    expect(run.final.evidence?.state).toBe('SUFFICIENT_EVIDENCE');
    expect(run.final.abstained).toBeUndefined();
    expect(run.final.tokenOptimization).toBeDefined();
    expect(run.final.contextSelection?.length).toBeGreaterThan(0);

    // ── TELEMETRY on the streamed path ──────────────────────────────
    const names = exporter.spans.map((s) => s.name);
    expect(names).toContain('ai.stream_run');
    expect(names).toContain('ai.retrieval');
    expect(names).toContain('ai.evidence');
    expect(names).toContain('ai.provider_execution');
  });

  it('streams an abstention when grounding is required but evidence is conflicting', async () => {
    const svc = new AIOrchestrationService({
      rag: {
        retrieve: async () => ({
          results: [
            {
              title: 'a',
              content: 'Personnel records are retained for seven years after an employee leaves.',
              score: 0.8,
              source: 'doc-a',
            },
            {
              title: 'b',
              content: 'Personnel records are deleted thirty days after an employee leaves.',
              score: 0.79,
              source: 'doc-b',
            },
          ],
        }),
      },
    });
    const execute = vi.fn(async () => mockResponse('should never stream'));
    svc.registerProvider(mockAdapter('mock', { execute }));

    const run = await svc.stream({
      ...GROUNDED_REQUEST,
      ragQuery: { collection: 'org:retention', query: 'retention', topK: 5 },
    });
    expect(run.final.abstained).toBe(true);
    expect(run.final.evidence?.state).toBe('CONFLICTING_EVIDENCE');
    expect(run.events.some((e) => e.type === 'done')).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('C-12 end-to-end production path: structured output', () => {
  it('validates model structured output before it becomes application truth', async () => {
    const exporter = new TestAIObservabilityExporter();
    const svc = new AIOrchestrationService({
      observability: new AIObservability({ exporter }),
    });
    svc.registerProvider(
      mockAdapter('mock', {
        generateStructured: async () =>
          mockResponse(JSON.stringify({ policy: 'seven years', risk: 3 }), { provider: 'mock' }),
      }),
    );

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'Extract the retention policy',
      qualityTier: 'standard',
      structuredSchema: {
        type: 'object',
        properties: {
          policy: { type: 'string', maxLength: 100 },
          risk: { type: 'number', minimum: 1, maximum: 5 },
        },
        required: ['policy', 'risk'],
      },
    });
    const parsed = JSON.parse(result.content) as { policy: string; risk: number };
    expect(parsed.policy).toBe('seven years');
    expect(parsed.risk).toBe(3);
    // Validation span proves the accepted output was schema-checked.
    const validationSpan = exporter.spans.find((s) => s.name === 'ai.validation');
    expect(validationSpan?.attributes.valid).toBe(true);
  });
});
