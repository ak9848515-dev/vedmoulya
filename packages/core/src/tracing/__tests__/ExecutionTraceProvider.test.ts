// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Trace Provider tests
// EPIC-012 — Production Observability & Control Plane
// Verifies: ALS parenting (nested spans form one trace), root-span
// trace completion, status propagation, owner scoping, bounded store
// eviction, idempotent span end, and telemetry-never-throws.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionTraceProvider } from '../execution-trace-provider.js';
import { InMemoryTraceStore } from '../trace-store.js';
import { normalizeTraceStatus } from '../execution-trace-provider.js';

describe('normalizeTraceStatus', () => {
  it('maps engine outcomes onto the fixed TraceStatus vocabulary', () => {
    expect(normalizeTraceStatus('SUCCESS')).toBe('OK');
    expect(normalizeTraceStatus('READY')).toBe('OK');
    expect(normalizeTraceStatus('ABSTAINED')).toBe('ABSTAINED');
    expect(normalizeTraceStatus('BUDGET_EXCEEDED')).toBe('BUDGET_EXCEEDED');
    expect(normalizeTraceStatus('TIMEOUT')).toBe('TIMEOUT');
    expect(normalizeTraceStatus('PROVIDER_FAILURE')).toBe('PROVIDER_FAILURE');
    expect(normalizeTraceStatus('VALIDATION_FAILURE')).toBe('VALIDATION_FAILURE');
    expect(normalizeTraceStatus('SECURITY_BLOCK')).toBe('SECURITY_BLOCK');
    expect(normalizeTraceStatus('USER_CANCELLED')).toBe('USER_CANCELLED');
    expect(normalizeTraceStatus('CANCELLED')).toBe('USER_CANCELLED');
    expect(normalizeTraceStatus('FAILED')).toBe('FAILED');
    expect(normalizeTraceStatus('ERROR')).toBe('ERROR');
    // Unknown/typo'd statuses must NEVER silently become success — the epic's
    // "never silent" rule maps unrecognized outcomes conservatively to FAILED.
    expect(normalizeTraceStatus('gibberish')).toBe('FAILED');
    expect(normalizeTraceStatus(undefined)).toBe('FAILED');
  });
});

describe('ExecutionTraceProvider', () => {
  it('parents nested spans under the ambient withSpan context', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store });

    let childTraceId: string | undefined;
    await provider.withSpan(
      { name: 'factory.build', kind: 'engine', userId: 'u1', applicationId: 'app-1' },
      async (root) => {
        const child = provider.startSpan({ name: 'ai.run', kind: 'ai' });
        child.setAttribute('provider', 'mock');
        child.end('OK');
        root.addEvent('loop.step', { specialist: 'frontend-engineer' });
        childTraceId = child.traceId;
      },
    );

    expect(childTraceId).toBeDefined();
    const traces = store.list();
    expect(traces).toHaveLength(1);
    const trace = traces[0];
    if (!trace) throw new Error('missing trace');
    expect(trace.name).toBe('factory.build');
    expect(trace.userId).toBe('u1');
    expect(trace.applicationId).toBe('app-1');
    expect(trace.status).toBe('OK');
    // Root span + child span are correlated under ONE traceId.
    expect(trace.spans).toHaveLength(2);
    const aiSpan = trace.spans.find((s) => s.name === 'ai.run');
    expect(aiSpan).toBeDefined();
    expect(aiSpan?.parentSpanId).toBe(trace.spans.find((s) => s.name === 'factory.build')?.spanId);
    expect(aiSpan?.attributes.provider).toBe('mock');
    expect(trace.spans.find((s) => s.name === 'factory.build')?.events[0]?.name).toBe('loop.step');
    expect(trace.spans.find((s) => s.name === 'factory.build')?.durationMs).toBeGreaterThanOrEqual(
      0,
    );
  });

  it('propagates a child failure to the trace status', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store });

    await provider.withSpan({ name: 'rag.search', kind: 'rag', userId: 'u2' }, async (root) => {
      const child = provider.startSpan({ name: 'ai.provider_execution', kind: 'ai' });
      child.end('PROVIDER_FAILURE', { code: 'PROVIDER_TIMEOUT', message: 'timed out' });
      root.end('OK');
    });

    const trace = store.list()[0];
    expect(trace?.status).toBe('PROVIDER_FAILURE');
    const child = trace?.spans.find((s) => s.name === 'ai.provider_execution');
    expect(child?.error?.code).toBe('PROVIDER_TIMEOUT');
  });

  it('roots separate withSpan calls as separate traces', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store });

    await provider.withSpan({ name: 'requirements.plan', userId: 'u1' }, async () => {});
    await provider.withSpan({ name: 'factory.create', userId: 'u1' }, async () => {});

    const traces = store.list();
    expect(traces).toHaveLength(2);
    expect(new Set(traces.map((t) => t.traceId)).size).toBe(2);
  });

  it('end is idempotent and never throws', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store });

    const span = provider.startSpan({ name: 'factory.approve', userId: 'u1' });
    span.end('OK');
    span.end('ERROR'); // second end is a no-op
    const trace = store.list()[0];
    expect(trace?.status).toBe('OK');
  });

  it('owner-scoped listing refuses cross-user telemetry access', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store });

    await provider.withSpan({ name: 'a', userId: 'alice' }, async () => {});
    await provider.withSpan({ name: 'b', userId: 'bob' }, async () => {});

    const alice = provider.listTraces({ userId: 'alice' });
    const bob = provider.listTraces({ userId: 'bob' });
    const all = provider.listTraces();
    expect(alice).toHaveLength(1);
    expect(alice[0]?.name).toBe('a');
    expect(bob).toHaveLength(1);
    expect(bob[0]?.name).toBe('b');
    expect(all).toHaveLength(2);
  });

  it('applies a hard FIFO cap on retained traces', () => {
    const store = new InMemoryTraceStore({ maxTraces: 3 });
    const provider = new ExecutionTraceProvider({ store });
    for (let i = 0; i < 10; i++) {
      provider.startSpan({ name: `span-${i}`, userId: 'u1' }).end();
    }
    expect(store.size()).toBe(3);
  });

  it('expires traces beyond the retention TTL', () => {
    let now = 1_000;
    const store = new InMemoryTraceStore({ retentionMs: 5_000, now: () => now });
    const provider = new ExecutionTraceProvider({ store, now: () => now });
    provider.startSpan({ name: 'old', userId: 'u1' }).end();
    now = 1_000 + 10_000;
    provider.startSpan({ name: 'fresh', userId: 'u1' }).end();
    const traces = store.list();
    expect(traces).toHaveLength(1);
    expect(traces[0]?.name).toBe('fresh');
  });

  it('records a thrown withSpan callback as FAILED and rethrows', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store });

    await expect(
      provider.withSpan({ name: 'factory.build', userId: 'u1' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const trace = store.list()[0];
    expect(trace?.status).toBe('FAILED');
    const root = trace?.spans.find((s) => s.name === 'factory.build');
    expect(root?.status).toBe('FAILED');
    expect(root?.error?.code).toBe('SPAN_CALLBACK_ERROR');
    expect(root?.error?.message).toContain('boom');
  });

  it('applies the optional attribute redactor to all string values', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({
      store,
      redact: (value: string) => value.replace(/sk-[a-z0-9]+/gi, 'sk-***'),
    });

    await provider.withSpan(
      { name: 'factory.create', userId: 'u1', attributes: { goal: 'build sk-abc123 now' } },
      async (root) => {
        root.setAttribute('prompt', 'use sk-xyz789');
        root.addEvent('loop.step', { provider: 'openai', apiKey: 'sk-secret1' });
      },
    );

    const trace = store.list()[0];
    const root = trace?.spans.find((s) => s.name === 'factory.create');
    expect(root?.attributes.goal).toBe('build sk-*** now');
    expect(root?.attributes.prompt).toBe('use sk-***');
    expect(root?.events[0]?.attributes?.apiKey).toBe('sk-***');
  });

  it('caps in-flight traces by finalizing the oldest as FAILED (leak guard)', () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store, maxOpenTraces: 2 });

    provider.startSpan({ name: 't1', userId: 'u1' });
    provider.startSpan({ name: 't2', userId: 'u1' });
    // Third root span forces eviction of t1 (never ended → leak guard).
    provider.startSpan({ name: 't3', userId: 'u1' });

    expect(store.list()).toHaveLength(1);
    const evicted = store.list()[0];
    expect(evicted?.name).toBe('t1');
    expect(evicted?.status).toBe('FAILED');
    expect(evicted?.attributes.termination).toBe('trace_evicted_open');
  });

  it('getTrace materializes open traces and returns stored completed ones', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store });

    await provider.withSpan(
      { name: 'loop.run', executionId: 'run-1', userId: 'u1' },
      async () => {},
    );
    const stored = provider.getTrace(provider.listTraces()[0]?.traceId ?? '');
    expect(stored?.executionId).toBe('run-1');

    // Open (not yet ended) trace is still queryable.
    const open = provider.startSpan({ name: 'factory.create', userId: 'u2' });
    const openTrace = provider.getTrace(open.traceId);
    expect(openTrace?.name).toBe('factory.create');
    open.end();
  });
});

describe('InMemoryTraceStore', () => {
  it('filters by status and applicationId', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store });
    await provider.withSpan(
      { name: 'build-ok', userId: 'u1', applicationId: 'a1' },
      async () => {},
    );
    const failing = provider.startSpan({ name: 'build-fail', userId: 'u1', applicationId: 'a2' });
    failing.end('FAILED');

    expect(store.list({ status: 'FAILED' })).toHaveLength(1);
    expect(store.list({ applicationId: 'a1' })).toHaveLength(1);
    expect(store.list({ userId: 'nobody' })).toHaveLength(0);
  });
});
