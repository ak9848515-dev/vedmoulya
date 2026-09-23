// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — TraceProvider OTel Bridge: branch coverage
// EPIC-012 — the AIObservability exporter seam. Each handle method has
// distinct branches: end(status) maps ok/error → OK/ERROR, setAttribute
// redacts strings but passes structured numbers through, and startSpan with
// no attributes must not throw. A fake ExecutionTraceProvider keeps this
// hermetic (no runtime, no vendor SDK).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { TraceProviderOtelBridge } from '../observability/TraceProviderOtelBridge.js';
import type { ExecutionTraceProvider, TelemetrySpanHandle } from '@vedmoulya/core';

function fakeProvider() {
  const endedWith: string[] = [];
  const setAttrs: Array<{ key: string; value: unknown }> = [];
  const provider = {
    startSpan: (_opts: unknown): TelemetrySpanHandle => ({
      end: (status: string) => {
        endedWith.push(status);
      },
      setAttribute: (key: string, value: unknown) => {
        setAttrs.push({ key, value });
      },
    }),
  } as unknown as ExecutionTraceProvider;
  return { provider, endedWith, setAttrs };
}

describe('TraceProviderOtelBridge', () => {
  it('defaults end() to OK and maps an explicit ok status to OK', () => {
    const { provider, endedWith } = fakeProvider();
    const bridge = new TraceProviderOtelBridge(provider);

    bridge.startSpan('ai.run').end();
    bridge.startSpan('ai.run').end('ok');
    expect(endedWith).toEqual(['OK', 'OK']);
  });

  it('maps an error status to ERROR', () => {
    const { provider, endedWith } = fakeProvider();
    const bridge = new TraceProviderOtelBridge(provider);
    bridge.startSpan('ai.provider_execution').end('error');
    expect(endedWith).toEqual(['ERROR']);
  });

  it('setAttribute passes numeric values through untouched (no string redaction)', () => {
    const { provider, setAttrs } = fakeProvider();
    const bridge = new TraceProviderOtelBridge(provider);
    const handle = bridge.startSpan('ai.run');
    handle.setAttribute('duration_ms', 42);
    handle.setAttribute('ok', true);
    expect(setAttrs).toEqual([
      { key: 'duration_ms', value: 42 },
      { key: 'ok', value: true },
    ]);
  });

  it('startSpan with undefined attributes does not throw and yields a usable handle', () => {
    const { provider, endedWith } = fakeProvider();
    const bridge = new TraceProviderOtelBridge(provider);
    const handle = bridge.startSpan('ai.retrieval');
    expect(() => handle.setAttribute('k', 'v')).not.toThrow();
    handle.end('ok');
    expect(endedWith).toEqual(['OK']);
  });
});
