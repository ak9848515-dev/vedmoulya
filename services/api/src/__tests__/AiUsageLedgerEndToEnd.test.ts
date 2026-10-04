// ─────────────────────────────────────────────────────────────────────────────
// SPRINT — End-to-end: a REAL AI execution lands in the DURABLE usage ledger.
//
// Proves the whole spine with the REAL runtime (no mocks of the accounting):
//   AIOrchestrationService.stream → AIObservability → TraceProviderOtelBridge
//   → AiUsageRecorder.recordFromSpan → durable store
//
//   • exactly ONE usage event for the run (streaming is counted once)
//   • the event carries the REAL provider/model/tokens
//   • cloud + local always reconstruct the measured total
//   • user isolation holds through the real span path
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionTraceProvider, InMemoryTraceStore } from '@vedmoulya/core';
import {
  AIOrchestrationService,
  AIObservability,
  OtelAIObservabilityExporter,
} from '@vedmoulya/services';
import type { ProviderAdapter } from '@vedmoulya/services';
import type { AIResponse, CapabilityType, ProviderHealth } from '@vedmoulya/orchestrator';
import { MockProvider } from '@vedmoulya/orchestrator';
import { TraceProviderOtelBridge } from '../observability/TraceProviderOtelBridge.js';
import { InMemoryAiUsageStore } from '../observability/AiUsageLedger.js';
import { AiUsageRecorder } from '../observability/AiUsageRecorder.js';
import { aggregateAiUsage } from '../observability/AiUsageBoard.js';

const TOKENS_IN = 40;
const TOKENS_OUT = 90;
const COST_USD = 0.0025;

class UsageAdapter implements ProviderAdapter {
  readonly capabilities: CapabilityType[] = ['reasoning'];

  constructor(
    public name: string,
    public family: string,
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
  }): Promise<AIResponse> {
    return Promise.resolve({
      content: `${this.name} answered`,
      provider: this.name,
      model: 'usage-model',
      confidence: 1,
      qualityScore: 1,
      latency: 5,
      cost: COST_USD,
      tokenUsage: { input: TOKENS_IN, output: TOKENS_OUT, total: TOKENS_IN + TOKENS_OUT },
      validation: { passed: true, checks: [], overallScore: 1, decision: 'pass' },
      traceId: `trace-${this.name}`,
    } as unknown as AIResponse);
  }
}

/** The REAL gateway composition: trace spine + usage-aware bridge. */
function makeRuntime(usage: AiUsageRecorder): {
  runtime: AIOrchestrationService;
  traceProvider: ExecutionTraceProvider;
} {
  const store = new InMemoryTraceStore();
  const traceProvider = new ExecutionTraceProvider({ store });
  const observability = new AIObservability({
    exporter: new OtelAIObservabilityExporter(
      new TraceProviderOtelBridge(traceProvider, (info) => {
        if (info.name !== 'ai.provider_execution') return;
        const trace = traceProvider.getTrace(info.traceId);
        if (trace === undefined || trace.userId === undefined) return;
        const span = trace.spans.find((s) => s.spanId === info.spanId);
        if (span === undefined) return;
        void usage.recordFromSpan({
          traceId: trace.traceId,
          spanId: span.spanId,
          attributes: span.attributes,
          userId: trace.userId,
          traceName: trace.name,
          startedAt: span.startedAt,
          ...(span.durationMs !== undefined ? { durationMs: span.durationMs } : {}),
        });
      }),
    ),
    emitUserTenantCorrelation: true,
  });
  const runtime = new AIOrchestrationService({ observability, retryBaseDelayMs: 1 });
  return { runtime, traceProvider };
}

async function runAs(
  runtime: AIOrchestrationService,
  traceProvider: ExecutionTraceProvider,
  userId: string,
  userInput: string,
): Promise<void> {
  await traceProvider.withSpan(
    { name: 'ai.request', kind: 'engine', userId, attributes: {} },
    async () => {
      await runtime.stream({
        capability: 'reasoning' as CapabilityType,
        userInput,
        userId,
        qualityTier: 'standard' as never,
      });
    },
  );
}

describe('durable usage ledger — REAL AI execution end to end', () => {
  it('records exactly one event carrying the real provider/model/tokens', async () => {
    const store = new InMemoryAiUsageStore();
    const usage = new AiUsageRecorder(store);
    const { runtime, traceProvider } = makeRuntime(usage);
    runtime.registerProvider(new UsageAdapter('user-gemini', 'google'));
    await runAs(runtime, traceProvider, 'owner-a', 'Explain the accounting spine');

    const events = await store.list({ userId: 'owner-a' });
    expect(events).toHaveLength(1);
    expect(events[0]?.provider).toBe('user-gemini');
    expect(events[0]?.model).toBe('usage-model');
    expect(events[0]?.inputTokens).toBe(TOKENS_IN);
    expect(events[0]?.outputTokens).toBe(TOKENS_OUT);
    expect(events[0]?.totalTokens).toBe(TOKENS_IN + TOKENS_OUT);
    expect(events[0]?.costUsd).toBeCloseTo(COST_USD, 6);
    expect(events[0]?.costUnknown).toBe(false);
  });

  it('records a SECOND event for a second run (no dedupe by request)', async () => {
    const store = new InMemoryAiUsageStore();
    const usage = new AiUsageRecorder(store);
    const { runtime, traceProvider } = makeRuntime(usage);
    runtime.registerProvider(new UsageAdapter('user-gemini', 'google'));
    await runAs(runtime, traceProvider, 'owner-a', 'run 1');
    await runAs(runtime, traceProvider, 'owner-a', 'run 2');

    expect(await store.count('owner-a')).toBe(2);
    const board = aggregateAiUsage(await store.list({ userId: 'owner-a' }));
    expect(board.cloud.totalTokens).toBe(2 * (TOKENS_IN + TOKENS_OUT));
  });

  it('reconstructs the measured total: cloud + local always equals every event', async () => {
    const store = new InMemoryAiUsageStore();
    const usage = new AiUsageRecorder(store);
    const { runtime, traceProvider } = makeRuntime(usage);
    runtime.registerProvider(new MockProvider());
    await runAs(runtime, traceProvider, 'owner-a', 'local run');

    const events = await store.list({ userId: 'owner-a' });
    const board = aggregateAiUsage(events);
    expect(events.length).toBeGreaterThan(0);
    expect(board.cloud.totalTokens + board.local.totalTokens).toBe(
      events.reduce((sum, e) => sum + e.totalTokens, 0),
    );
  });

  it('never attributes one owner usage to another', async () => {
    const store = new InMemoryAiUsageStore();
    const usage = new AiUsageRecorder(store);
    const { runtime, traceProvider } = makeRuntime(usage);
    runtime.registerProvider(new UsageAdapter('user-gemini', 'google'));
    await runAs(runtime, traceProvider, 'owner-b', 'other owner');

    expect(await store.count('owner-a')).toBe(0);
    expect(await store.count('owner-b')).toBe(1);
  });

  it('stores no secret material from a real run', async () => {
    const store = new InMemoryAiUsageStore();
    const usage = new AiUsageRecorder(store);
    const { runtime, traceProvider } = makeRuntime(usage);
    runtime.registerProvider(new UsageAdapter('user-gemini', 'google'));
    await runAs(runtime, traceProvider, 'owner-a', 'hi');
    const serialised = JSON.stringify(await store.list({ userId: 'owner-a' }));
    expect(serialised).not.toMatch(/sk-|AIza|Bearer /);
  });
});
