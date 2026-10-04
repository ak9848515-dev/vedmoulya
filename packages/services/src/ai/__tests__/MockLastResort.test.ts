// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mock is a LAST-RESORT provider (PRODUCT-001)
//
// PRODUCTION-001 fact: the deterministic mock can score HIGHER than a real
// adapter in provider intelligence (cheap, instant, "healthy"), which would
// make the autonomous loop appear to work while executing fake AI. This test
// wires an advisor that deliberately ranks the mock first and proves the
// runtime still executes the REAL registered adapter.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { metrics } from '@vedmoulya/core';
import { AIOrchestrationService } from '../AIOrchestrationService.js';
import { AIObservability, OtelAIObservabilityExporter } from '../runtime/AIObservability.js';
import type { ProviderAdapter } from '../AIOrchestrationService.js';
import type { AIResponse, CapabilityType, ProviderFamily, ProviderHealth } from '@vedmoulya/ai';
import type { OrchestrateRequestDTO } from '../AIDTO.js';

function makeResponse(provider: string): AIResponse {
  return {
    content: `response from ${provider}`,
    provider,
    model: `${provider}-model`,
    confidence: 0.9,
    qualityScore: 8,
    latency: 10,
    cost: 0,
    tokenUsage: { input: 10, output: 20, total: 30 },
    validation: {
      passed: true,
      checks: [{ name: 'format', passed: true, score: 10 }],
      overallScore: 8,
      decision: 'pass',
    },
    traceId: `trace-${provider}`,
    metadata: {
      providerFamily: provider as ProviderFamily,
      modelVersion: `${provider}-model`,
      processingTime: 10,
      contextUsed: ['system', 'user'],
      routingDecision: {
        selectedProvider: provider,
        reason: 'test',
        alternativesConsidered: [],
        strategy: 'balanced',
      },
      validationDetails: [],
    },
  };
}

function makeProvider(name: string, family: string): ProviderAdapter {
  const health: ProviderHealth = {
    providerId: name,
    status: 'healthy',
    latency: 5,
    errorRate: 0,
    lastChecked: new Date(),
    isRateLimited: false,
    rateLimitRemaining: 100,
    rateLimitReset: null,
  };
  return {
    name,
    family,
    capabilities: ['reasoning'] as CapabilityType[],
    isHealthy: async () => true,
    getHealth: async () => health,
    execute: async () => makeResponse(name),
  };
}

const request: OrchestrateRequestDTO = {
  capability: 'reasoning',
  userInput: 'Explain why the mock must never outrank a real provider',
  qualityTier: 'standard',
};

describe('mock is a last-resort provider (PRODUCT-001)', () => {
  beforeEach(() => metrics.reset());
  afterEach(() => vi.restoreAllMocks());

  it('executes the REAL adapter even when the advisor ranks the mock first', async () => {
    const service = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const real = makeProvider('ollama', 'ollama');
    const mock = makeProvider('mock', 'mock');
    const mockExecute = vi.spyOn(mock, 'execute');
    const realExecute = vi.spyOn(real, 'execute');
    service.registerProvider(real);
    service.registerProvider(mock);

    // Advisor deliberately values the mock highest and the real adapter lowest.
    service.configureIntelligence({
      providerIntelligence: {
        getCandidates: async () =>
          Promise.resolve([
            {
              providerId: 'mock',
              family: 'mock',
              capabilities: ['reasoning'],
              healthy: true,
              models: [
                { id: 'mock-1', contextWindow: 131072, maxOutputTokens: 8192, streaming: true },
              ],
              benchmarkScore: 100,
              averageLatencyMs: 1,
              costPer1KInput: 0,
              costPer1KOutput: 0,
            },
            {
              providerId: 'ollama',
              family: 'ollama',
              capabilities: ['reasoning'],
              healthy: true,
              models: [
                {
                  id: 'qwen2.5-coder:7b-instruct',
                  contextWindow: 131072,
                  maxOutputTokens: 8192,
                  streaming: true,
                },
              ],
              benchmarkScore: 10,
              averageLatencyMs: 5000,
              costPer1KInput: 0.01,
              costPer1KOutput: 0.01,
            },
          ]),
      },
      executionStrategy: {
        getRoutingContext: async () => Promise.resolve({ strategy: 'balanced' as const }),
      },
    });

    const result = await service.orchestrate(request);

    expect(result.provider).toBe('ollama');
    expect(realExecute).toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('still serves the mock when NO real adapter can serve the capability', async () => {
    const service = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const mock = makeProvider('mock', 'mock');
    const mockExecute = vi.spyOn(mock, 'execute');
    service.registerProvider(mock);

    const result = await service.orchestrate(request);

    expect(result.provider).toBe('mock');
    expect(mockExecute).toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────
  // MISSION SOURCE TAGGING (Phase 3)
  //
  // A live Mission's AI usage was recorded with source = OTHER because the
  // runtime had no way to know WHICH product surface owned the execution.
  // `aiSource` is now carried on the request and recorded as the `ai_source`
  // span attribute — the SAME field the durable usage ledger already reads
  // (AiUsageRecorder.inferSource), so no new telemetry field was introduced.
  // ──────────────────────────────────────────────────────────────────
  describe('mission AI usage is attributed to the MISSION source', () => {
    beforeEach(() => metrics.reset());
    afterEach(() => vi.restoreAllMocks());

    /** Captures every span the runtime emits, with its attributes. */
    function captureSpans() {
      const spans: Array<{ name: string; attributes: Record<string, unknown> }> = [];
      return {
        spans,
        observability: new AIObservability({
          exporter: new OtelAIObservabilityExporter({
            startSpan: (name, attributes = {}) => {
              const record = { name, attributes: attributes as Record<string, unknown> };
              spans.push(record);
              return {
                end: () => undefined,
                setAttribute: (key: string, value: string | number | boolean) => {
                  record.attributes[key] = value;
                },
              };
            },
          }),
        }),
      };
    }

    it('records ai_source=MISSION on the provider execution span', async () => {
      const { spans, observability } = captureSpans();
      const service = new AIOrchestrationService({ retryBaseDelayMs: 1, observability });
      service.registerProvider(makeProvider('ollama', 'ollama'));

      await service.orchestrate({ ...request, aiSource: 'MISSION' });

      const execution = spans.find((s) => s.name === 'ai.provider_execution');
      expect(execution).toBeDefined();
      expect(execution?.attributes.ai_source).toBe('MISSION');
    });

    it('does not invent a source when the caller declares none', async () => {
      const { spans, observability } = captureSpans();
      const service = new AIOrchestrationService({ retryBaseDelayMs: 1, observability });
      service.registerProvider(makeProvider('ollama', 'ollama'));

      await service.orchestrate(request);

      const execution = spans.find((s) => s.name === 'ai.provider_execution');
      // Absent ⇒ the ledger falls back to its own inference; nothing is faked.
      expect(execution).toBeDefined();
      expect(execution?.attributes.ai_source).toBeUndefined();
    });

    it('honours a different surface (ASK) so the field is genuinely per-surface', async () => {
      const { spans, observability } = captureSpans();
      const service = new AIOrchestrationService({ retryBaseDelayMs: 1, observability });
      service.registerProvider(makeProvider('ollama', 'ollama'));

      await service.orchestrate({ ...request, aiSource: 'ASK' });

      const execution = spans.find((s) => s.name === 'ai.provider_execution');
      expect(execution?.attributes.ai_source).toBe('ASK');
    });

    // ── Mission identity on the provider execution span ──────────────
    it('records the real missionId/objectiveId on the Mission execution span', async () => {
      const { spans, observability } = captureSpans();
      const service = new AIOrchestrationService({ retryBaseDelayMs: 1, observability });
      service.registerProvider(makeProvider('ollama', 'ollama'));

      await service.orchestrate({
        ...request,
        aiSource: 'MISSION',
        missionId: 'mission_muqz94v1_1',
        objectiveId: 'obj_muqz94v1_2',
      });

      const execution = spans.find((s) => s.name === 'ai.provider_execution');
      expect(execution?.attributes.ai_source).toBe('MISSION');
      expect(execution?.attributes.mission_id).toBe('mission_muqz94v1_1');
      expect(execution?.attributes.objective_id).toBe('obj_muqz94v1_2');
    });

    it.each(['ASK', 'BRAIN', 'DAILY_AI'] as const)(
      '%s never receives Mission identity',
      async (source) => {
        const { spans, observability } = captureSpans();
        const service = new AIOrchestrationService({ retryBaseDelayMs: 1, observability });
        service.registerProvider(makeProvider('ollama', 'ollama'));

        await service.orchestrate({ ...request, aiSource: source });

        const execution = spans.find((s) => s.name === 'ai.provider_execution');
        expect(execution?.attributes.ai_source).toBe(source);
        // Identity is never inferred from the surface label.
        expect(execution?.attributes.mission_id).toBeUndefined();
        expect(execution?.attributes.objective_id).toBeUndefined();
      },
    );

    it('every provider execution in a fallback chain keeps the same Mission identity', async () => {
      const { spans, observability } = captureSpans();
      const service = new AIOrchestrationService({ retryBaseDelayMs: 1, observability });
      const failing = makeProvider('openai', 'openai');
      vi.spyOn(failing, 'execute').mockRejectedValue(new Error('openai 503'));
      service.registerProvider(failing);
      service.registerProvider(makeProvider('ollama', 'ollama'));

      await service.orchestrate({
        ...request,
        aiSource: 'MISSION',
        missionId: 'mission_fallback_1',
        objectiveId: 'obj_fallback_1',
      });

      const executions = spans.filter((s) => s.name === 'ai.provider_execution');
      expect(executions.length).toBeGreaterThan(1); // failure + success both recorded
      // Retries/fallbacks do not duplicate or mutate identity.
      for (const span of executions) {
        expect(span.attributes.mission_id).toBe('mission_fallback_1');
        expect(span.attributes.objective_id).toBe('obj_fallback_1');
      }
      // No duplicate accounting: the fallback produced exactly one execution
      // per provider — one failed attempt, one successful one.
      expect(executions.filter((s) => s.attributes.provider === 'openai')).toHaveLength(1);
      expect(executions.filter((s) => s.attributes.provider === 'ollama')).toHaveLength(1);
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// SYNTHETIC-SUCCESS SAFETY (this sprint)
//
// A live autonomous Mission failed after every real provider had failed.
// The deterministic mock was still registered as a non-production
// last-resort, so a real execution could silently become a SYNTHETIC
// SUCCESS. These tests pin the corrected semantics:
//   - a real provider is ALWAYS preferred over the mock;
//   - if a real provider existed and FAILED, the mock must NOT run and
//     the request must fail honestly;
//   - the mock still serves when NO real provider could serve at all
//     (explicit test/dev fixtures).
// ──────────────────────────────────────────────────────────────────

/** A real provider that always fails, with an observable execution count. */
function makeFailingProvider(name: string, family: string) {
  const provider = makeProvider(name, family);
  const execute = vi
    .spyOn(provider, 'execute')
    .mockRejectedValue(new Error(`${name} is unavailable`));
  return { provider, execute };
}

describe('synthetic success is impossible (mock safety)', () => {
  beforeEach(() => metrics.reset());
  afterEach(() => vi.restoreAllMocks());

  it('Case 1: a real provider is available — the mock cannot win', async () => {
    const service = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const real = makeProvider('ollama', 'ollama');
    const mock = makeProvider('mock', 'mock');
    const realExecute = vi.spyOn(real, 'execute');
    const mockExecute = vi.spyOn(mock, 'execute');
    service.registerProvider(mock);
    service.registerProvider(real);

    const result = await service.orchestrate(request);

    expect(result.provider).toBe('ollama');
    expect(realExecute).toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('Case 2: first real provider fails, a second real provider succeeds — the mock never runs', async () => {
    const service = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const broken = makeFailingProvider('openai', 'openai');
    const working = makeProvider('ollama', 'ollama');
    const mock = makeProvider('mock', 'mock');
    const mockExecute = vi.spyOn(mock, 'execute');
    const workingExecute = vi.spyOn(working, 'execute');
    service.registerProvider(broken.provider);
    service.registerProvider(working);
    service.registerProvider(mock);

    const result = await service.orchestrate(request);

    expect(broken.execute).toHaveBeenCalled();
    expect(result.provider).toBe('ollama');
    expect(workingExecute).toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('Case 3: every real provider fails — the mock must NOT execute and the failure is honest', async () => {
    const service = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const google = makeFailingProvider('google', 'google');
    const openai = makeFailingProvider('openai', 'openai');
    const ollama = makeFailingProvider('ollama', 'ollama');
    const mock = makeProvider('mock', 'mock');
    const mockExecute = vi.spyOn(mock, 'execute');
    service.registerProvider(google.provider);
    service.registerProvider(openai.provider);
    service.registerProvider(ollama.provider);
    service.registerProvider(mock);

    const failure = await service.orchestrate(request).catch((e: unknown) => e as Error);

    expect(failure).toBeInstanceOf(Error);
    // The reported failure is a REAL provider failure — never the mock's
    // fabricated success. (The mock was last in line and never ran.)
    expect(failure.message).toMatch(/is unavailable|No synthetic provider was used/);
    expect(failure.message).not.toMatch(/response from mock/);

    // The synthetic provider never ran — so no synthetic success is possible.
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('Case 3b: the honest failure names the real providers and the last real failure', async () => {
    const service = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const quota = makeFailingProvider('openai', 'openai');
    quota.execute.mockRejectedValue(new Error('QUOTA_EXHAUSTED'));
    const mock = makeProvider('mock', 'mock');
    service.registerProvider(quota.provider);
    service.registerProvider(mock);

    const failure = await service.orchestrate(request).catch((e: unknown) => e as Error);

    expect(failure).toBeInstanceOf(Error);
    // "Configured but all failed" is named explicitly, with the real cause.
    expect(failure.message).toMatch(/All configured AI providers failed/);
    expect(failure.message).toContain('openai');
    expect(failure.message).toContain('QUOTA_EXHAUSTED');
    expect(failure.name).toBe('ProviderExecutionFailed');
  });

  it('Case 4: explicit mock-only mode still executes the mock', async () => {
    const service = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const mock = makeProvider('mock', 'mock');
    const mockExecute = vi.spyOn(mock, 'execute');
    service.registerProvider(mock);

    const result = await service.orchestrate(request);

    expect(result.provider).toBe('mock');
    expect(mockExecute).toHaveBeenCalled();
  });

  it('Case 6/7: no synthetic success and no mock usage is produced on all-real-provider failure', async () => {
    const service = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const failed = makeFailingProvider('ollama', 'ollama');
    const mock = makeProvider('mock', 'mock');
    const mockExecute = vi.spyOn(mock, 'execute');
    service.registerProvider(failed.provider);
    service.registerProvider(mock);

    const outcome = await service.orchestrate(request).then(
      () => undefined,
      (e: unknown) => e as Error,
    );

    // No response object can exist ⇒ nothing can be recorded downstream as a
    // successful (real) AI usage event attributed to the synthetic provider.
    expect(outcome).toBeInstanceOf(Error);
    expect(mockExecute).not.toHaveBeenCalled();
    expect(failed.execute).toHaveBeenCalled();
  });
});
