// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Observability Startup Tests
// Verifies the OtelExporter + runtime metrics wiring (PH-002/T1).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { metrics } from '@vedmoulya/core';
import {
  initGatewayObservability,
  flushGatewayObservability,
  shutdownGatewayObservability,
} from '../observability/startup.js';

// Hermetic against a host-inherited environment (D-family): a shell that
// sources `.env.local` exports OTEL_EXPORTER_OTLP_ENDPOINT into every child
// process, which flips the exporter ON and breaks the "no endpoint" default
// test. NODE_ENV is intentionally left as-is here (development under the
// injected env): the lazy core config refuses localhost URLs outside
// development, so the suite must not force NODE_ENV=test globally — the
// signal-handler default test scopes its own NODE_ENV=test stub below.
beforeEach(() => {
  vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');
  vi.stubEnv('OTEL_SERVICE_NAME', '');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  return shutdownGatewayObservability();
});

describe('initGatewayObservability', () => {
  it('returns a disabled exporter when no endpoint is configured', () => {
    const obs = initGatewayObservability();
    expect(obs.enabled).toBe(false);
    expect(obs.exporter.isEnabled).toBe(false);
  });

  it('is idempotent — returns the same singleton instance', () => {
    const first = initGatewayObservability();
    const second = initGatewayObservability();
    expect(second).toBe(first);
  });

  it('records runtime metrics immediately on the global registry', () => {
    initGatewayObservability();
    expect(metrics.getGauge('runtime.memory.rss_bytes')).toBeGreaterThan(0);
    expect(metrics.getGauge('runtime.uptime_seconds')).toBeGreaterThanOrEqual(0);
    expect(metrics.getGauge('runtime.cpu.usage_percent')).toBeTypeOf('number');
  });

  it('enables the exporter and bridges the metrics registry when an endpoint is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const obs = initGatewayObservability({ endpoint: 'http://otel:4318' });
    expect(obs.enabled).toBe(true);

    // Emit a metric — it must be queued by the attached listener and exported.
    metrics.increment('gateway.observability.test', 7);
    await obs.flush();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://otel:4318/v1/metrics',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not install signal handlers by default in tests', () => {
    vi.stubEnv('NODE_ENV', 'test'); // installSignals defaults to true outside NODE_ENV=test
    const on = vi.spyOn(process, 'on');
    initGatewayObservability();
    expect(on).not.toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(on).not.toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('installs and removes SIGTERM/SIGINT handlers when requested', async () => {
    const on = vi.spyOn(process, 'on');
    const off = vi.spyOn(process, 'removeListener');

    initGatewayObservability({ installSignals: true, endpoint: '' });
    expect(on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(on).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    await shutdownGatewayObservability();
    expect(off).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(off).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('clears the runtime timer and stops the exporter on shutdown', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const obs = initGatewayObservability({ endpoint: 'http://otel:4318' });
    expect(obs.enabled).toBe(true);

    await shutdownGatewayObservability();
    // The singleton is reset so a fresh init creates a fresh state.
    const fresh = initGatewayObservability();
    expect(fresh).not.toBe(obs);
    expect(clearSpy).toHaveBeenCalled();
  });
});

describe('flushGatewayObservability', () => {
  it('is a no-op when not initialized', async () => {
    await expect(flushGatewayObservability()).resolves.toBeUndefined();
  });
});
