// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI usage telemetry: owner-scoped traces → per-user CostLedger
//
// Phase B proves the AI Usage & Economics screen reflects REAL execution:
//
//   direct ai.stream / ai.orchestrate  → owner-scoped trace → CostLedger
//   Mission autonomous AI generation   → owner-scoped trace → CostLedger (same)
//
// The AI runtime records `input_tokens` / `output_tokens` / `cost` (USD) and
// marks a span `status: 'success'` only when a provider generation completed.
// The CostLedger now normalizes those attributes into its `tokens_total` /
// `cost_usd` semantics WITHOUT changing any existing engine trace result, and a
// failed provider selection fabricates nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { ExecutionTraceProvider, InMemoryTraceStore } from '@vedmoulya/core';
import {
  AIOrchestrationService,
  AIObservability,
  OtelAIObservabilityExporter,
} from '@vedmoulya/services';
import type { ProviderAdapter } from '@vedmoulya/services';
import type {
  AIResponse,
  CapabilityType,
  ProviderHealth,
  ValidationResult,
} from '@vedmoulya/orchestrator';
import { MockProvider, OllamaProvider } from '@vedmoulya/orchestrator';
import { createMissionRuntime } from '@vedmoulya/mission-runtime';
import type { AISpan } from '@vedmoulya/services';
import { TraceProviderOtelBridge } from '../observability/TraceProviderOtelBridge.js';
import { CostLedger } from '../observability/CostLedger.js';
import { createAIRouter } from '../routers/AIRouter.js';
import { MissionService } from '../services/MissionService.js';

const TOKENS_IN = 11;
const TOKENS_OUT = 22;
const COST_USD = 0.0012;

const OK_VALIDATION: ValidationResult = {
  passed: true,
  checks: [],
  overallScore: 1,
  decision: 'pass',
};

/** Deterministic adapter with REAL (known) usage + USD cost. No network. */
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
      cost: COST_USD,
      tokenUsage: { input: TOKENS_IN, output: TOKENS_OUT, total: TOKENS_IN + TOKENS_OUT },
      validation: OK_VALIDATION,
      traceId: `trace-${this.name}`,
      metadata: {
        providerFamily: 'custom',
        modelVersion: 'recording-model',
        processingTime: 5,
        contextUsed: [],
        routingDecision: {
          selectedProvider: this.name,
          reason: 'recording adapter',
          alternativesConsidered: [],
          strategy: 'balanced',
        },
        validationDetails: [],
      },
    });
  }
}

/** The SAME observability pipeline the gateway composes. */
function makeObservability(traceProvider: ExecutionTraceProvider): AIObservability {
  return new AIObservability({
    exporter: new OtelAIObservabilityExporter(new TraceProviderOtelBridge(traceProvider)),
    emitUserTenantCorrelation: true,
  });
}

/** The SAME owner-scoped boundary trace the gateway installs. */
function withOwnerTraceFor(traceProvider: ExecutionTraceProvider) {
  return <T>(userId: string, fn: () => Promise<T>): Promise<T> =>
    traceProvider.withSpan(
      { name: 'ai.request', kind: 'engine', userId, attributes: {} },
      async () => await fn(),
    );
}

function setup(): {
  store: InMemoryTraceStore;
  traceProvider: ExecutionTraceProvider;
  adapter: RecordingAdapter;
  router: ReturnType<typeof createAIRouter>;
  ledger: CostLedger;
  ai: AIOrchestrationService;
} {
  const store = new InMemoryTraceStore();
  const traceProvider = new ExecutionTraceProvider({ store });
  const observability = makeObservability(traceProvider);
  const adapter = new RecordingAdapter('user-gemini', 'google');
  const ai = new AIOrchestrationService({ observability, retryBaseDelayMs: 1 });
  ai.registerProvider(adapter);
  const router = createAIRouter(ai, undefined, withOwnerTraceFor(traceProvider));
  return { store, traceProvider, adapter, router, ledger: new CostLedger(), ai };
}

const orchestrateInput = (userId: string, userInput = 'What should I focus on today?') => ({
  userId,
  capability: 'reasoning' as const,
  userInput,
  qualityTier: 'standard' as const,
  constraints: { outputFormat: 'markdown' as const, maxOutputTokens: 1200 },
});

const CTX = { userId: 'unused', email: 'x@example.com', role: 'user' };

// ── Direct AI execution: owner-scoped trace + ledger aggregation ─────────────

describe('direct AI execution — owner-scoped trace and usage', () => {
  it('ai.stream creates an owner-scoped trace carrying the authenticated user', async () => {
    const { store, router } = setup();
    await router.stream(orchestrateInput('user-a'), CTX);

    const traces = store.list({ userId: 'user-a' });
    expect(traces.length).toBeGreaterThan(0);
    expect(traces.every((t) => t.userId === 'user-a')).toBe(true);
    expect(
      traces.some((t) =>
        t.spans.some((s) => s.kind === 'ai' && s.name === 'ai.provider_execution'),
      ),
    ).toBe(true);
  });

  it('ai.orchestrate creates an owner-scoped trace carrying the authenticated user', async () => {
    const { store, router } = setup();
    await router.orchestrate(orchestrateInput('user-a'), CTX);

    const traces = store.list({ userId: 'user-a' });
    expect(traces.length).toBeGreaterThan(0);
    const providerExecutions = traces.flatMap((t) =>
      t.spans.filter((s) => s.name === 'ai.provider_execution'),
    );
    expect(providerExecutions.length).toBeGreaterThan(0);
    // The trace record itself is owned by the authenticated user.
    expect(providerExecutions[0]?.traceId).toBeDefined();
    expect(traces.find((t) => t.spans.includes(providerExecutions[0]!))?.userId).toBe('user-a');
  });

  it('aggregates input_tokens + output_tokens and the real USD cost', async () => {
    const { router, ledger, store } = setup();
    await router.orchestrate(orchestrateInput('user-a'), CTX);

    const totals = ledger.compute(store, { userId: 'user-a' }).totals;
    expect(totals.tokensInput).toBe(TOKENS_IN);
    expect(totals.tokensOutput).toBe(TOKENS_OUT);
    expect(totals.tokensTotal).toBe(TOKENS_IN + TOKENS_OUT);
    expect(totals.costUsd).toBeCloseTo(COST_USD, 6);
  });

  it('aggregates cache hits ONLY when the runtime actually reports a hit', async () => {
    const { router, ledger, store, adapter } = setup();
    // First call misses; the identical second call is served from the request
    // cache, and the runtime marks that run span `cache: 'hit'`.
    await router.orchestrate(orchestrateInput('user-a'), CTX);
    await router.orchestrate(orchestrateInput('user-a'), CTX);

    expect(adapter.executions).toHaveLength(1);
    const totals = ledger.compute(store, { userId: 'user-a' }).totals;
    expect(totals.cacheHits).toBe(1);
    // The cache hit performs NO provider call, so usage is counted once.
    expect(totals.tokensTotal).toBe(TOKENS_IN + TOKENS_OUT);
  });

  it('a failed provider selection fabricates NO usage (error trace only)', async () => {
    const store = new InMemoryTraceStore();
    const traceProvider = new ExecutionTraceProvider({ store });
    const emptyAi = new AIOrchestrationService({
      observability: makeObservability(traceProvider),
      retryBaseDelayMs: 1,
    });
    const router = createAIRouter(emptyAi, undefined, withOwnerTraceFor(traceProvider));

    await expect(router.orchestrate(orchestrateInput('user-a'), CTX)).rejects.toThrow(
      /Provider not found/,
    );

    const totals = new CostLedger().compute(store, { userId: 'user-a' }).totals;
    expect(totals.aiCalls).toBe(0);
    expect(totals.tokensTotal).toBe(0);
    expect(totals.costUsd).toBe(0);
  });

  it("keeps one user's AI usage invisible to another user", async () => {
    const { router, ledger, store } = setup();
    await router.orchestrate(orchestrateInput('user-a'), CTX);
    await router.orchestrate(orchestrateInput('user-b'), CTX);

    expect(store.list({ userId: 'user-a' }).every((t) => t.userId === 'user-a')).toBe(true);
    expect(store.list({ userId: 'user-b' }).every((t) => t.userId === 'user-b')).toBe(true);

    const forA = ledger.compute(store, { userId: 'user-a' }).totals;
    const forB = ledger.compute(store, { userId: 'user-b' }).totals;
    const forC = ledger.compute(store, { userId: 'user-c' }).totals;
    expect(forA.tokensTotal).toBe(TOKENS_IN + TOKENS_OUT);
    expect(forB.tokensTotal).toBe(TOKENS_IN + TOKENS_OUT);
    expect(forC.tokensTotal).toBe(0);
    expect(forC.aiCalls).toBe(0);
  });

  it('does NOT double count engine-rolled-up traces (existing behavior preserved)', async () => {
    const store = new InMemoryTraceStore();
    const traceProvider = new ExecutionTraceProvider({ store });
    await traceProvider.withSpan({ name: 'factory.build', userId: 'owner' }, async (root) => {
      root.setAttribute('tokens_total', 5000);
      root.setAttribute('cost_usd', 0.05);
      root.setAttribute('cache_hits', 2);
      // A nested AI provider execution with its OWN usage attributes must not be
      // added on top of the engine rollup.
      const aiSpan = traceProvider.startSpan({
        name: 'ai.provider_execution',
        kind: 'ai',
        attributes: {
          provider: 'google',
          status: 'success',
          input_tokens: 2000,
          output_tokens: 1000,
          cost: 0.02,
        },
      });
      aiSpan.end('OK');
      root.end('OK');
    });

    const totals = new CostLedger().compute(store, { userId: 'owner' }).totals;
    expect(totals.tokensTotal).toBe(5000);
    expect(totals.costUsd).toBeCloseTo(0.05, 6);
    expect(totals.cacheHits).toBe(2);
  });
});

// ── Streaming execution: REAL provider usage/cost, not an estimate ───────────

const STREAM_IN = 123;
const STREAM_OUT = 45;
const STREAM_COST = 0.0075;

/**
 * A streaming adapter that reports the provider SDK's REAL usage on its
 * terminal `done` chunk — the same shape GoogleGeminiProvider /
 * OpenAICompatibleProvider / VercelAIProvider / DeepSeekProvider now emit.
 */
class StreamingRecordingAdapter implements ProviderAdapter {
  constructor(
    public name: string,
    public family: string,
    public capabilities: CapabilityType[] = ['reasoning'],
    private readonly reportedCost?: number,
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
    return Promise.reject(new Error('streaming adapter must use stream()'));
  }

  async *stream(): AsyncIterable<unknown> {
    yield { type: 'content', data: { text: 'Hello ' } };
    yield { type: 'content', data: { text: 'world' } };
    const data: Record<string, unknown> = {
      modelId: 'gemini-3.5-flash',
      latencyMs: 3,
      tokenUsage: { input: STREAM_IN, output: STREAM_OUT, total: STREAM_IN + STREAM_OUT },
    };
    if (this.reportedCost !== undefined) data.cost = this.reportedCost;
    yield { type: 'done', data };
  }
}

function streamingSetup(reportedCost?: number) {
  const store = new InMemoryTraceStore();
  const traceProvider = new ExecutionTraceProvider({ store });
  const adapter = new StreamingRecordingAdapter(
    'stream-gemini',
    'google',
    ['reasoning'],
    reportedCost,
  );
  const ai = new AIOrchestrationService({
    observability: makeObservability(traceProvider),
    retryBaseDelayMs: 1,
  });
  ai.registerProvider(adapter);
  const router = createAIRouter(ai, undefined, withOwnerTraceFor(traceProvider));
  return { store, traceProvider, adapter, router, ledger: new CostLedger() };
}

function providerExecutionSpans(store: InMemoryTraceStore, userId: string) {
  return store
    .list({ userId })
    .flatMap((trace) => trace.spans)
    .filter((span) => span.name === 'ai.provider_execution');
}

describe('streaming execution — real provider usage is preserved', () => {
  it('records the provider-reported input and output tokens and its cost', async () => {
    const { router, store, ledger } = streamingSetup(STREAM_COST);
    const result = await router.stream(orchestrateInput('user-a'), CTX);

    const spans = providerExecutionSpans(store, 'user-a');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.attributes.input_tokens).toBe(STREAM_IN);
    expect(spans[0]?.attributes.output_tokens).toBe(STREAM_OUT);
    expect(spans[0]?.attributes.cost).toBe(STREAM_COST);
    expect(spans[0]?.attributes.model).toBe('gemini-3.5-flash');
    expect(spans[0]?.attributes.provider_family).toBe('google');
    expect(store.list({ userId: 'user-a' })[0]?.userId).toBe('user-a');

    // The streamed response carries the REAL usage too (no estimate, no zero).
    expect(result.data?.final.tokenUsage.input).toBe(STREAM_IN);
    expect(result.data?.final.tokenUsage.output).toBe(STREAM_OUT);
    expect(result.data?.final.cost).toBe(STREAM_COST);

    // Aggregated EXACTLY once (the run span carries no usage of its own).
    const totals = ledger.compute(store, { userId: 'user-a' }).totals;
    expect(totals.aiCalls).toBe(1);
    expect(totals.tokensInput).toBe(STREAM_IN);
    expect(totals.tokensOutput).toBe(STREAM_OUT);
    expect(totals.tokensTotal).toBe(STREAM_IN + STREAM_OUT);
    expect(totals.costUsd).toBeCloseTo(STREAM_COST, 8);
    expect(totals.aiCalls).toBe(1);
  });

  it('leaves cost unavailable when the provider cannot price the call', async () => {
    const { router, store, ledger } = streamingSetup();
    await router.stream(orchestrateInput('user-a'), CTX);

    const span = providerExecutionSpans(store, 'user-a')[0];
    expect(span?.attributes.input_tokens).toBe(STREAM_IN);
    expect(span?.attributes.output_tokens).toBe(STREAM_OUT);
    // No cost attribute at all — never a fabricated zero-cost "estimate".
    expect(span?.attributes.cost).toBeUndefined();

    const totals = ledger.compute(store, { userId: 'user-a' }).totals;
    expect(totals.tokensTotal).toBe(STREAM_IN + STREAM_OUT);
    expect(totals.costUsd).toBe(0);
  });

  it('keeps a streaming Ask owner-scoped and invisible to other users', async () => {
    const { router, store, ledger } = streamingSetup(STREAM_COST);
    await router.stream(orchestrateInput('user-a'), CTX);

    expect(store.list({ userId: 'user-a' }).every((t) => t.userId === 'user-a')).toBe(true);
    expect(store.list({ userId: 'user-b' })).toHaveLength(0);
    expect(ledger.compute(store, { userId: 'user-b' }).totals.tokensTotal).toBe(0);
    expect(ledger.compute(store, { userId: 'user-b' }).totals.costUsd).toBe(0);
  });
});

// ── MissionService wiring: the service really forwards the pipeline ──────────

describe('MissionService — forwards AI observability into its composed runtime', () => {
  it('gives the runtime it composes the deployment AI observability pipeline', async () => {
    const spans: AISpan[] = [];
    const observability = new AIObservability({
      exporter: {
        exportSpan: (span: AISpan): void => {
          spans.push(span);
        },
        flush: (): Promise<void> => Promise.resolve(),
      },
    });

    const service = new MissionService({
      aiObservability: observability,
      runtimeOptions: {
        registerProviders: (orchestrator) => {
          orchestrator.registerProvider(new RecordingAdapter('service-ai', 'google'));
        },
      },
    });
    // Composes the runtime lazily (same path a real mission request takes).
    await service.recoverAllActive();
    const runtime = service.getComposedRuntime();
    expect(runtime).toBeDefined();

    await runtime!.orchestrator.orchestrate(orchestrateInput('owner'), CTX);

    expect(spans.some((span) => span.name === 'ai.provider_execution')).toBe(true);
  });
});

// ── Mission autonomous AI execution: same telemetry pipeline ─────────────────

const INSTALLED_MODEL = 'qwen2.5-coder:7b-instruct';
const tagsResponse = (): Response =>
  new Response(
    JSON.stringify({ models: [{ name: INSTALLED_MODEL, capabilities: ['completion', 'tools'] }] }),
    { status: 200 },
  );
const chatResponse = (content: string): Response =>
  new Response(
    JSON.stringify({
      model: INSTALLED_MODEL,
      message: { role: 'assistant', content },
      prompt_eval_count: 12,
      eval_count: 9,
    }),
    { status: 200 },
  );

const tempRoots: string[] = [];
function newWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vedmoulya-phase-b-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  vi.unstubAllGlobals();
});
afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

describe('Mission AI execution — owner-scoped telemetry in the SAME ledger', () => {
  it('reports a real autonomous generation to the Mission owner, alongside direct AI usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const href = String(url);
        return href.endsWith('/api/tags')
          ? tagsResponse()
          : chatResponse('verified: real local model summary output');
      }),
    );

    const store = new InMemoryTraceStore();
    const traceProvider = new ExecutionTraceProvider({ store });
    const observability = makeObservability(traceProvider);
    const workspace = newWorkspace();
    const owner = 'mission-owner';

    const runtime = createMissionRuntime({
      workspaceRoot: workspace,
      // The Mission runtime's OWN orchestrators receive the SAME observability
      // pipeline the direct AI path uses.
      orchestratorOptions: { retryBaseDelayMs: 1, observability },
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' }));
        orchestrator.registerProvider(new MockProvider());
      },
    });

    const mission = await runtime.controller.createMission({
      userId: owner,
      title: 'Phase B telemetry',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: {
        allowedTools: ['workspace_write', 'workspace_read'],
        grantedPermissionClasses: ['READ', 'WRITE'],
      },
      initialObjectives: [
        'Create the workspace file phase-b-one.md with the first sprint summary content',
        'Create the workspace file phase-b-two.md with the second sprint summary content',
      ],
    });
    await runtime.controller.startMission(mission.missionId);
    const done = await runtime.controller.runAutonomousLoop(mission.missionId);
    expect(done.state).toBe('COMPLETED');
    expect(existsSync(path.join(workspace, 'phase-b-two.md'))).toBe(true);

    // ── Actual provider executions produced owner-scoped telemetry ──────────
    const ledger = new CostLedger();
    const missionTotals = ledger.compute(store, { userId: owner }).totals;
    expect(missionTotals.aiCalls).toBeGreaterThan(0);
    expect(missionTotals.tokensTotal).toBeGreaterThan(0);
    expect(
      store
        .list({ userId: owner })
        .some((t) => t.spans.some((s) => s.kind === 'ai' && s.name === 'ai.provider_execution')),
    ).toBe(true);
    // Attribution is exclusive: no other user sees the mission's usage.
    expect(ledger.compute(store, { userId: 'someone-else' }).totals.tokensTotal).toBe(0);

    // ── Direct AI usage lands in the SAME ledger for the same owner ─────────
    const directAdapter = new RecordingAdapter('user-gemini', 'google');
    const directAi = new AIOrchestrationService({ observability, retryBaseDelayMs: 1 });
    directAi.registerProvider(directAdapter);
    const router = createAIRouter(directAi, undefined, withOwnerTraceFor(traceProvider));
    await router.orchestrate(orchestrateInput(owner), CTX);

    const combined = ledger.compute(store, { userId: owner }).totals;
    expect(combined.tokensTotal).toBeGreaterThan(missionTotals.tokensTotal);
    expect(combined.costUsd).toBeGreaterThanOrEqual(missionTotals.costUsd);
  });
});
