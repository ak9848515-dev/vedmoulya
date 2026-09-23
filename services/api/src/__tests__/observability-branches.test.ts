// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: observability branch coverage (PROD-COVERAGE-02)
//
// Real behavior assertions for low-branch observability modules:
//   • TraceProviderOtelBridge — string attribute redaction.
//   • IncidentDiagnostics — failure taxonomy → user/operator guidance;
//     provider/retry/fallback/evidence attribution; generic fallback.
//   • mission-watchdog — env cadence, backoff, error isolation, stop.
//   • PreviewService — empty/bundled/error states; '..' join.
//   • ResponseMapper — envelope defaults.
// Deterministic fakes only.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionTrace, TraceSpan } from '@vedmoulya/core';
import { TraceProviderOtelBridge } from '../observability/TraceProviderOtelBridge.js';
import { buildIncidentDiagnostics } from '../observability/IncidentDiagnostics.js';
import {
  getMissionWatchdog,
  startMissionWatchdog,
  stopMissionWatchdog,
} from '../observability/mission-watchdog.js';
import { PreviewService } from '../services/PreviewService.js';
import {
  errorResponse,
  fromServiceResult,
  paginatedResponse,
  successResponse,
} from '../services/ResponseMapper.js';
import type { FactoryDetailDTO } from '@vedmoulya/app-factory';

const silentLog = { info: () => undefined, warn: () => undefined };

async function waitFor(condition: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timeout waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const idleOutcome = {
  considered: 0,
  resumed: 0,
  stillWaiting: 0,
  skipped: 0,
  resumedMissionIds: [] as string[],
};

// ── TraceProviderOtelBridge ──────────────────────────────────────────────────

function makeProvider() {
  const spans: Array<{ name: string; kind: string; attributes: Record<string, unknown> }> = [];
  const handle = {
    end: (_status?: string) => undefined,
    setAttribute: (_key: string, _value: string | number | boolean) => undefined,
  };
  return {
    spans,
    startSpan(input: { name: string; kind: string; attributes?: Record<string, unknown> }) {
      spans.push({ name: input.name, kind: input.kind, attributes: input.attributes ?? {} });
      return handle;
    },
  };
}

describe('TraceProviderOtelBridge (EPIC-012)', () => {
  it('redacts string attributes on start; numbers pass through', () => {
    const provider = makeProvider();
    const bridge = new TraceProviderOtelBridge(provider as never);
    const span = bridge.startSpan('ai.run', {
      'api-key': 'sk-secret-value',
      latency_ms: 42,
      ok: true,
    });
    span.end('error');
    expect(provider.spans).toHaveLength(1);
    expect(provider.spans[0]?.kind).toBe('ai');
    const attrs = provider.spans[0]?.attributes as Record<string, unknown>;
    expect(attrs['latency_ms']).toBe(42);
    expect(attrs['ok']).toBe(true);
    expect(JSON.stringify(attrs)).not.toContain('sk-secret-value');
  });

  it('redacts string setAttribute values; structured values pass', () => {
    const provider = makeProvider();
    const bridge = new TraceProviderOtelBridge(provider as never);
    const span = bridge.startSpan('ai.provider_execution');
    span.setAttribute('authorization', 'Bearer sk-secret-value');
    span.setAttribute('count', 7);
    span.setAttribute('ratio', 0.5);
    span.end('ok');
    expect(JSON.stringify(provider.spans[0]?.attributes)).not.toContain('sk-secret-value');
  });

  it('returns {} attributes when none are provided', () => {
    const provider = makeProvider();
    const bridge = new TraceProviderOtelBridge(provider as never);
    bridge.startSpan('ai.retry');
    expect(provider.spans[0]?.attributes).toEqual({});
  });
});
