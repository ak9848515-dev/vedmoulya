// ──────────────────────────────────────────────────────────────────
// VedMoulya — Observability Export Tests
// Edge-case coverage for the Prometheus exporter and the OTLP/HTTP
// exporter: JSON snapshots, name escaping, non-finite values, empty
// registries, env-derived configuration, trailing slashes, empty span
// batches, the flush interval, and the post() abort timeout.
// PH-002 — Enterprise Operations & Reliability (T1 Observability)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import { metricsToPrometheus, metricsSnapshotJson } from '../prometheus.js';
import { OtelExporter } from '../otel.js';
import { MetricsRegistry } from '../../metrics/index.js';
import type { Span } from '../../tracing/index.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function makeSpan(): Span {
  return {
    name: 'op',
    traceId: 't1',
    spanId: 's1',
    startTime: 100n,
    endTime: 200n,
    attributes: { a: 1 },
    status: 'ok',
  };
}

describe('metricsSnapshotJson', () => {
  it('returns the registry snapshot as a JSON-safe object', () => {
    const registry = new MetricsRegistry();
    registry.increment('http.requests', 2);
    registry.setGauge('runtime.memory', 128);
    registry.observe('api.latency', 5);

    const snap = metricsSnapshotJson(registry) as {
      counters?: Record<string, number>;
      gauges?: Record<string, number>;
      histograms?: Record<string, unknown>;
    };

    expect(snap.counters).toEqual({ 'http.requests': 2 });
    expect(snap.gauges).toEqual({ 'runtime.memory': 128 });
    expect(snap.histograms).toHaveProperty('api.latency');
  });
});

describe('Prometheus formatting edge cases', () => {
  it('escapes invalid characters but keeps valid Prometheus chars in metric names', () => {
    const registry = new MetricsRegistry();
    registry.increment('http.requests.total', 1);
    registry.setGauge('queue.depth', 3);
    registry.setGauge('app:active', 5); // ':' is a valid Prometheus name char

    const output = metricsToPrometheus(registry);

    expect(output).toContain('# TYPE http_requests_total counter');
    expect(output).toContain('http_requests_total 1');
    expect(output).toContain('# TYPE queue_depth gauge');
    expect(output).toContain('queue_depth 3');
    expect(output).toContain('# TYPE app:active gauge');
    expect(output).toContain('app:active 5');
  });

  it('renders non-finite gauge values as 0', () => {
    const registry = new MetricsRegistry();
    registry.setGauge('nan_value', Number.NaN);
    registry.setGauge('inf_value', Number.POSITIVE_INFINITY);

    const output = metricsToPrometheus(registry);

    expect(output).toContain('nan_value 0');
    expect(output).toContain('inf_value 0');
  });

  it('renders only process gauges for an empty registry', () => {
    const output = metricsToPrometheus(new MetricsRegistry());

    expect(output).toContain('# TYPE vedmoulya_process_memory_bytes gauge');
    expect(output).toContain('vedmoulya_process_uptime_seconds');
    expect(output).toMatch(/\n$/);

    const typeLines = output.split('\n').filter((line) => line.startsWith('# TYPE'));
    expect(typeLines.length).toBe(2);
  });
});

describe('OtelExporter configuration', () => {
  it('reads endpoint, service name and version from the environment', async () => {
    const savedEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const savedService = process.env.OTEL_SERVICE_NAME;
    const savedVersion = process.env.APP_VERSION;
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    try {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector.example:4318';
      process.env.OTEL_SERVICE_NAME = 'env-service';
      process.env.APP_VERSION = '9.9.9';

      const exporter = new OtelExporter();
      expect(exporter.isEnabled).toBe(true);

      exporter.exportSpans([makeSpan()]);
      await exporter.flush();
      await exporter.shutdown();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://collector.example:4318/v1/traces');

      const body = JSON.parse(String(init.body)) as {
        resourceSpans: Array<{
          resource: { attributes: Array<{ key: string; value: { stringValue?: string } }> };
        }>;
      };
      const attrs = body.resourceSpans[0].resource.attributes;
      expect(attrs).toEqual(
        expect.arrayContaining([
          { key: 'service.name', value: { stringValue: 'env-service' } },
          { key: 'service.version', value: { stringValue: '9.9.9' } },
        ]),
      );
    } finally {
      if (savedEndpoint === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = savedEndpoint;
      if (savedService === undefined) delete process.env.OTEL_SERVICE_NAME;
      else process.env.OTEL_SERVICE_NAME = savedService;
      if (savedVersion === undefined) delete process.env.APP_VERSION;
      else process.env.APP_VERSION = savedVersion;
    }
  });

  it('strips a trailing slash from the endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new OtelExporter({ endpoint: 'http://otel:4318/' });
    exporter.exportSpans([makeSpan()]);
    await exporter.flush();
    await exporter.shutdown();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://otel:4318/v1/traces');
  });

  it('ignores empty span batches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new OtelExporter({ endpoint: 'http://otel:4318' });
    exporter.exportSpans([]);
    await exporter.flush();
    await exporter.shutdown();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('OtelExporter timers', () => {
  it('flushes queued spans on the configured interval', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new OtelExporter({
      endpoint: 'http://otel:4318',
      flushIntervalMs: 1000,
    });
    exporter.exportSpans([makeSpan()]);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/v1/traces');

    await exporter.shutdown();
  });

  it('aborts an export that hangs past the 2s timeout', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        capturedSignal = init.signal;
        return new Promise(() => {}); // never resolves
      }),
    );

    const exporter = new OtelExporter({
      endpoint: 'http://otel:4318',
      flushIntervalMs: 60_000,
    });
    exporter.exportSpans([makeSpan()]);
    // Intentionally NOT awaited: fetch never resolves, so the flush promise
    // stays pending. We only need the abort timeout to fire; afterEach's
    // vi.useRealTimers()/vi.unstubAllGlobals() cleans everything up.
    void exporter.flush();

    vi.advanceTimersByTime(2000); // fires the abort timeout

    expect(capturedSignal?.aborted).toBe(true);
    expect(exporter.isEnabled).toBe(true);
  });
});
