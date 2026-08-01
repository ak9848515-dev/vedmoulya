// ──────────────────────────────────────────────────────────────────
// VedMoulya — Coverage Gap Tests
// Additional branch coverage for observability, lifecycle, and health
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConsoleErrorReporter,
  HttpErrorReporter,
  ErrorReporterHub,
  errorReporter,
} from '../errorReporter.js';
import { GracefulShutdown } from '../../lifecycle/gracefulShutdown.js';
import {
  HealthChecker,
  databaseHealthCheck,
  redisHealthCheck,
  memoryHealthCheck,
  cpuHealthCheck,
  uptimeHealthCheck,
} from '../../health/index.js';
import { OtelExporter } from '../otel.js';
import { MetricsRegistry } from '../../metrics/index.js';

describe('ConsoleErrorReporter', () => {
  it('writes a structured JSON entry to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const reporter = new ConsoleErrorReporter();
      reporter.report(new Error('boom'), { service: 's', correlationId: 'c' });
      expect(spy).toHaveBeenCalledTimes(1);
      const json = JSON.parse(spy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
      expect(json.level).toBe('error');
      expect(json.message).toBe('boom');
      expect(json.service).toBe('s');
      expect(json.correlationId).toBe('c');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('HttpErrorReporter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs a JSON payload with the api key header', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const reporter = new HttpErrorReporter({
      endpoint: 'https://errors.internal/ingest',
      service: 'api',
      apiKey: 'key-123',
    });
    reporter.report(new Error('boom'), { correlationId: 'c1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://errors.internal/ingest',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer key-123' }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.service).toBe('api');
    expect((body.error as { message: string }).message).toBe('boom');
  });

  it('swallows network failures', () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const reporter = new HttpErrorReporter({ endpoint: 'https://x', service: 's' });
    expect(() => reporter.report(new Error('boom'))).not.toThrow();
  });

  it('sends no auth header when no api key is configured', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const reporter = new HttpErrorReporter({ endpoint: 'https://x', service: 's' });
    reporter.report(new Error('boom'));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('authorization');
  });
});

describe('ErrorReporterHub default', () => {
  it('includes the console reporter by default', () => {
    expect(errorReporter).toBeInstanceOf(ErrorReporterHub);
    const hub = new ErrorReporterHub();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      hub.report(new Error('default sink'));
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('GracefulShutdown install/uninstall', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('installs and uninstalls signal handlers', () => {
    const on = vi.spyOn(process, 'on').mockImplementation(() => process);
    const remove = vi.spyOn(process, 'removeListener').mockImplementation(() => process);

    const gs = new GracefulShutdown();
    gs.install(['SIGTERM', 'SIGINT']);
    expect(on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(on).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    // Idempotent install
    gs.install();
    expect(on).toHaveBeenCalledTimes(2);

    gs.uninstall();
    expect(remove).toHaveBeenCalledTimes(2);

    // Idempotent uninstall
    gs.uninstall();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('records errors from each shutdown phase', async () => {
    const gs = new GracefulShutdown({
      onStopAcceptingRequests: () => {
        throw new Error('stop failed');
      },
      onDrainRequests: async () => {
        throw new Error('drain failed');
      },
      onFlushMetrics: async () => {
        throw new Error('flush failed');
      },
      resources: [
        {
          name: 'db',
          close: async () => {
            throw new Error('close failed');
          },
        },
      ],
      onComplete: async () => {
        throw new Error('complete failed');
      },
    });

    const result = await gs.shutdown();
    expect(result.completed).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('exposes isShuttingDown during and after shutdown', async () => {
    const gs = new GracefulShutdown();
    expect(gs.isShuttingDown).toBe(false);
    const promise = gs.shutdown();
    expect(gs.isShuttingDown).toBe(true);
    await promise;
    expect(gs.isShuttingDown).toBe(true);
  });
});

describe('Health checks', () => {
  it('databaseHealthCheck healthy path', async () => {
    const checker = new HealthChecker();
    checker.register(
      'database',
      databaseHealthCheck('database', async () => true),
    );
    const result = await checker.check();
    const db = result.checks.find((c) => c.name === 'database');
    expect(db?.status).toBe('healthy');
  });

  it('redisHealthCheck healthy path', async () => {
    const checker = new HealthChecker();
    checker.register(
      'redis',
      redisHealthCheck('redis', async () => true),
    );
    const result = await checker.check();
    const redis = result.checks.find((c) => c.name === 'redis');
    expect(redis?.status).toBe('healthy');
  });

  it('memoryHealthCheck healthy under threshold', () => {
    const checker = new HealthChecker();
    checker.register('memory', memoryHealthCheck('memory', 10_000));
    const result = checker.check();
    return result.then((r) => {
      const mem = r.checks.find((c) => c.name === 'memory');
      expect(mem?.status).toBe('healthy');
    });
  });

  it('cpuHealthCheck reports healthy at low load and degraded at threshold 0', async () => {
    const checker = new HealthChecker();
    checker.register('cpu', cpuHealthCheck('cpu', 80));
    const healthy = await checker.check();
    expect(healthy.checks.find((c) => c.name === 'cpu')?.status).toBe('healthy');

    const degraded = new HealthChecker();
    degraded.register('cpu', cpuHealthCheck('cpu', 0));
    const dResult = await degraded.check();
    expect(dResult.checks.find((c) => c.name === 'cpu')?.status).toBe('degraded');
  });

  it('uptimeHealthCheck always reports healthy', async () => {
    const checker = new HealthChecker();
    checker.register('uptime', uptimeHealthCheck('uptime'));
    const result = await checker.check();
    expect(result.checks.find((c) => c.name === 'uptime')?.status).toBe('healthy');
  });
});

describe('OtelExporter data paths', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exportSpans queues spans and flush posts a trace payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new OtelExporter({ endpoint: 'http://otel:4318' });
    const span = {
      name: 'op',
      traceId: 't1',
      spanId: 's1',
      parentSpanId: 'p1',
      startTime: 100n,
      endTime: 200n,
      attributes: { a: 1, b: 'x' },
      status: 'error' as const,
    };
    exporter.exportSpans([span]);
    expect(exporter.isEnabled).toBe(true);
    await exporter.flush();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://otel:4318/v1/traces',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('queues gauges and histograms as OTLP metric payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new OtelExporter({ endpoint: 'http://otel:4318' });
    const registry = new MetricsRegistry();
    exporter.attach((listener) => registry.onMetric(listener));
    registry.setGauge('runtime.memory', 512);
    registry.observe('api.latency', 10);
    registry.increment('http.requests');

    await exporter.flush();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://otel:4318/v1/metrics',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shutdown clears the flush timer and flushes pending data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new OtelExporter({ endpoint: 'http://otel:4318', flushIntervalMs: 1000 });
    const span = {
      name: 'op',
      traceId: 't',
      spanId: 's',
      startTime: 100n,
      endTime: 200n,
      attributes: {},
      status: 'ok' as const,
    };
    exporter.exportSpans([span]);
    await exporter.shutdown();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('post failures are swallowed', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('refused'));
    vi.stubGlobal('fetch', fetchMock);
    const exporter = new OtelExporter({ endpoint: 'http://otel:4318' });
    const span = {
      name: 'op',
      traceId: 't',
      spanId: 's',
      startTime: 100n,
      endTime: 200n,
      attributes: {},
      status: 'ok' as const,
    };
    exporter.exportSpans([span]);
    await expect(exporter.flush()).resolves.toBeUndefined();
  });

  it('flush is a no-op when disabled', async () => {
    const exporter = new OtelExporter({ endpoint: '' });
    await expect(exporter.flush()).resolves.toBeUndefined();
  });

  it('attach is a no-op when disabled', () => {
    const exporter = new OtelExporter({ endpoint: '' });
    const listener = vi.fn();
    exporter.attach(listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it('toOtlpSpan maps ok status and omits undefined end time', () => {
    const exporter = new OtelExporter({ endpoint: '' });
    const span = {
      name: 'op',
      traceId: 't',
      spanId: 's',
      startTime: 100n,
      endTime: undefined,
      attributes: {},
      status: 'ok' as const,
    };
    const otlp = exporter.toOtlpSpan(span);
    expect(otlp.status).toEqual({ code: 1 });
    expect(otlp.endTimeUnixNano).toBeUndefined();
  });
});
