// ──────────────────────────────────────────────────────────────────
// VedMoulya — Reliability Tests (PH-002/T9)
// Failure scenarios: graceful shutdown ordering, drain timeout,
// correlation propagation, error reporter fan-out, health degradation,
// Prometheus rendering, OTel epoch timestamps.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { metricsToPrometheus, prometheusMetrics } from '../prometheus.js';
import {
  createCorrelationId,
  runWithCorrelation,
  withNewCorrelation,
  getCorrelationId,
} from '../correlation.js';
import { ErrorReporterHub, ConsoleErrorReporter } from '../errorReporter.js';
import { OtelExporter } from '../otel.js';
import { GracefulShutdown } from '../../lifecycle/gracefulShutdown.js';
import { MetricsRegistry } from '../../metrics/index.js';
import {
  HealthChecker,
  databaseHealthCheck,
  redisHealthCheck,
  memoryHealthCheck,
} from '../../health/index.js';

describe('GracefulShutdown', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the ordered shutdown sequence (stop → drain → flush → resources)', async () => {
    const order: string[] = [];
    const gs = new GracefulShutdown({
      onStopAcceptingRequests: async () => {
        order.push('stop');
      },
      onDrainRequests: async () => {
        order.push('drain');
      },
      onFlushMetrics: async () => {
        order.push('flush');
      },
      resources: [
        { name: 'db', close: async () => order.push('db') },
        { name: 'redis', close: async () => order.push('redis') },
        { name: 'ai', close: async () => order.push('ai') },
      ],
      onComplete: async () => order.push('complete'),
    });

    const result = await gs.shutdown();

    expect(order).toEqual(['stop', 'drain', 'flush', 'db', 'redis', 'ai', 'complete']);
    expect(result.completed).toBe(true);
  });

  it('closes resources in declaration order even when a hook fails', async () => {
    const order: string[] = [];
    const gs = new GracefulShutdown({
      onDrainRequests: async () => {
        throw new Error('drain failed');
      },
      resources: [
        { name: 'db', close: async () => order.push('db') },
        { name: 'redis', close: async () => order.push('redis') },
      ],
    });

    const result = await gs.shutdown();

    expect(order).toEqual(['db', 'redis']);
    expect(result.completed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('is idempotent — second shutdown call is a no-op', async () => {
    const close = vi.fn();
    const gs = new GracefulShutdown({ resources: [{ name: 'db', close }] });
    await gs.shutdown();
    await gs.shutdown();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('times out a hung drain step', async () => {
    const gs = new GracefulShutdown({
      timeoutMs: 50,
      onDrainRequests: () => new Promise<void>(() => {}), // never resolves
    });
    const result = await gs.shutdown();
    expect(result.completed).toBe(false);
    expect(result.errors.some((e) => e.message.includes('timed out'))).toBe(true);
  });
});

describe('CorrelationContext', () => {
  it('propagates correlation ID through async boundaries', async () => {
    const captured: Array<string | undefined> = [];
    await runWithCorrelation('corr-abc', async () => {
      captured.push(getCorrelationId());
      await Promise.resolve();
      captured.push(getCorrelationId());
      await new Promise((r) => setTimeout(r, 5));
      captured.push(getCorrelationId());
    });
    expect(captured).toEqual(['corr-abc', 'corr-abc', 'corr-abc']);
  });

  it('generates unique correlation IDs', () => {
    const a = createCorrelationId();
    const b = createCorrelationId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^corr_/);
  });

  it('withNewCorrelation creates and applies a fresh context', () => {
    const outer = getCorrelationId();
    let inner: string | undefined;
    withNewCorrelation(() => {
      inner = getCorrelationId();
    });
    expect(inner).toBeDefined();
    expect(inner).not.toBe(outer);
  });
});

describe('ErrorReporterHub', () => {
  it('fans out to all reporters', () => {
    const hub = new ErrorReporterHub();
    const first = vi.fn();
    const second = vi.fn();
    hub.clearReporters();
    hub.addReporter({ report: first });
    hub.addReporter({ report: second });

    const error = new Error('boom');
    hub.report(error, { service: 'test', correlationId: 'c1' });

    expect(first).toHaveBeenCalledWith(error, { service: 'test', correlationId: 'c1' });
    expect(second).toHaveBeenCalledWith(error, { service: 'test', correlationId: 'c1' });
  });

  it('never throws when a reporter throws', () => {
    const hub = new ErrorReporterHub();
    hub.clearReporters();
    hub.addReporter({
      report: () => {
        throw new Error('reporter broken');
      },
    });

    expect(() => hub.report(new Error('app error'))).not.toThrow();
  });
});

describe('MetricsToPrometheus', () => {
  it('renders counters, gauges and histograms in text format', () => {
    const registry = new MetricsRegistry();
    registry.increment('http.requests', 3);
    registry.setGauge('runtime.memory', 512);
    registry.observe('api.latency', 10);
    registry.observe('api.latency', 30);

    const output = metricsToPrometheus(registry);

    expect(output).toContain('# TYPE http_requests counter');
    expect(output).toContain('http_requests 3');
    expect(output).toContain('# TYPE runtime_memory gauge');
    expect(output).toContain('runtime_memory 512');
    expect(output).toContain('# TYPE api_latency summary');
    expect(output).toContain('api_latency_count 2');
    expect(output).toContain('api_latency_sum 40');
    expect(output).toContain('quantile="0.5"');
  });

  it('includes process gauges', () => {
    const output = prometheusMetrics();
    expect(output).toContain('vedmoulya_process_memory_bytes');
    expect(output).toContain('vedmoulya_process_uptime_seconds');
  });
});

describe('OtelExporter', () => {
  it('converts span timestamps to epoch nanoseconds', () => {
    const exporter = new OtelExporter({ endpoint: 'http://localhost:4318' });
    const span = {
      name: 'test',
      traceId: 'abcdef',
      spanId: '123456',
      startTime: 1_000_000n,
      endTime: 2_000_000n,
      attributes: { ok: true, n: 5 },
      status: 'ok' as const,
    };
    const otlp = exporter.toOtlpSpan(span);
    // epoch ns must be much larger than the monotonic start (boot offset added)
    expect(BigInt(otlp.startTimeUnixNano)).toBeGreaterThan(1_000_000_000_000n);
    expect(BigInt(otlp.endTimeUnixNano ?? '0')).toBeGreaterThan(BigInt(otlp.startTimeUnixNano));
    expect(otlp.attributes).toEqual([
      { key: 'ok', value: { stringValue: 'true' } },
      { key: 'n', value: { intValue: '5' } },
    ]);
  });

  it('is disabled when no endpoint is configured', () => {
    const exporter = new OtelExporter({ endpoint: '' });
    expect(exporter.isEnabled).toBe(false);
    // flush with no endpoint must not throw
    void exporter.flush();
  });
});

describe('HealthChecker failure scenarios (PH-002/T9)', () => {
  it('reports unhealthy when the database is unavailable', async () => {
    const checker = new HealthChecker();
    checker.register(
      'database',
      databaseHealthCheck('database', async () => {
        throw new Error('connection refused');
      }),
    );
    const result = await checker.check();
    expect(result.status).toBe('unhealthy');
    const db = result.checks.find((c) => c.name === 'database');
    expect(db?.status).toBe('unhealthy');
    expect(db?.error).toBe('connection refused');
  });

  it('degrades (not unhealthy) when Redis is unavailable', async () => {
    const checker = new HealthChecker();
    checker.register(
      'redis',
      redisHealthCheck('redis', async () => {
        throw new Error('redis down');
      }),
    );
    const result = await checker.check();
    expect(result.status).toBe('degraded');
    const redis = result.checks.find((c) => c.name === 'redis');
    expect(redis?.status).toBe('degraded');
  });

  it('reports degraded memory above threshold', async () => {
    const checker = new HealthChecker();
    checker.register('memory', memoryHealthCheck('memory', 0));
    const result = await checker.check();
    const mem = result.checks.find((c) => c.name === 'memory');
    expect(mem?.status).toBe('degraded');
  });
});
