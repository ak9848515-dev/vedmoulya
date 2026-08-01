// ──────────────────────────────────────────────────────────────────
// VedMoulya — OpenTelemetry Exporter
// Lightweight OTLP/HTTP exporter for spans and metrics
// Bridges the in-process TraceProvider/MetricsRegistry to an OTLP
// collector (config: OTEL_EXPORTER_OTLP_ENDPOINT, default :4318).
// PH-002 — Enterprise Operations & Reliability (T1 Observability)
// ──────────────────────────────────────────────────────────────────

import type { Span } from '../tracing/index.js';
import type { Metric, MetricListener } from '../metrics/index.js';

export interface OtelExporterOptions {
  /** OTLP/HTTP endpoint, e.g. http://localhost:4318 */
  endpoint?: string;
  serviceName?: string;
  serviceVersion?: string;
  /** Batch flush interval in ms. Default 5000. */
  flushIntervalMs?: number;
}

interface OtlpSpan {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTimeUnixNano: string;
  endTimeUnixNano?: string;
  attributes?: Array<{ key: string; value: { stringValue?: string; intValue?: string } }>;
  status?: { code: number };
}

/**
 * Minimal OpenTelemetry Protocol (OTLP) / HTTP JSON exporter.
 *
 * Spans recorded by a TraceProvider can be exported with
 * `exporter.exportSpans(provider.getSpans())`; metrics are exported
 * automatically via `exporter.attach(registry)`. Batches are flushed on
 * an interval and on `shutdown()`. Failures are swallowed so exporting
 * never affects request processing.
 */
export class OtelExporter {
  /** Boot-time epoch offset so hrtime.bigint() → Unix epoch nanoseconds. */
  private static readonly BOOT_EPOCH_NS = BigInt(Date.now()) * 1_000_000n - process.hrtime.bigint();

  private readonly endpoint: string;
  private readonly serviceName: string;
  private readonly serviceVersion: string;
  private readonly flushIntervalMs: number;
  private readonly pendingSpans: Span[] = [];
  private readonly pendingMetrics: Metric[] = [];
  private readonly timer?: ReturnType<typeof setInterval>;

  constructor(options: OtelExporterOptions = {}) {
    const endpoint = (options.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '')
      .trim()
      .replace(/\/$/, '');
    // Only enable the exporter when an endpoint is configured.
    this.endpoint = endpoint;
    this.serviceName = options.serviceName ?? process.env.OTEL_SERVICE_NAME ?? 'vedmoulya';
    this.serviceVersion = options.serviceVersion ?? process.env.APP_VERSION ?? '1.0.0';
    this.flushIntervalMs = options.flushIntervalMs ?? 5000;

    if (this.endpoint) {
      this.timer = setInterval(() => {
        void this.flush();
      }, this.flushIntervalMs);
      this.timer.unref();
    }
  }

  get isEnabled(): boolean {
    return this.endpoint !== '';
  }

  /** Queue spans for export (OTLP trace payload). */
  exportSpans(spans: Span[]): void {
    if (!this.isEnabled || spans.length === 0) return;
    this.pendingSpans.push(...spans);
  }

  /**
   * Attach a MetricsRegistry listener so emitted metrics are queued for
   * export as OTLP metrics. The registry has no listener removal API, so
   * this registers a permanent listener (bounded at 10k buffered metrics).
   */
  attach(onMetric: (listener: MetricListener) => void): void {
    if (!this.isEnabled) return;
    const listener: MetricListener = (metric: Metric) => {
      if (this.pendingMetrics.length < 10_000) {
        this.pendingMetrics.push(metric);
      }
    };
    onMetric(listener);
  }

  /** Convert a Span to an OTLP trace span (epoch-nanosecond timestamps). */
  toOtlpSpan(span: Span): OtlpSpan {
    const attributes = Object.entries(span.attributes).map(([key, value]) => ({
      key,
      value:
        typeof value === 'number' ? { intValue: String(value) } : { stringValue: String(value) },
    }));
    const epochNs = (start: bigint): string => String(OtelExporter.BOOT_EPOCH_NS + start);
    return {
      name: span.name,
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      startTimeUnixNano: epochNs(span.startTime),
      endTimeUnixNano: span.endTime !== undefined ? epochNs(span.endTime) : undefined,
      attributes,
      status:
        span.status === 'error' ? { code: 2 } : span.status === 'ok' ? { code: 1 } : undefined,
    };
  }

  /** Flush queued spans/metrics to the OTLP endpoint. */
  async flush(): Promise<void> {
    if (!this.isEnabled) return;

    if (this.pendingSpans.length > 0) {
      const spans = this.pendingSpans.splice(0, this.pendingSpans.length);
      const payload = this.buildTracePayload(spans);
      await this.post('/v1/traces', payload);
    }

    if (this.pendingMetrics.length > 0) {
      const metrics = this.pendingMetrics.splice(0, this.pendingMetrics.length);
      const payload = this.buildMetricPayload(metrics);
      await this.post('/v1/metrics', payload);
    }
  }

  /** Stop the flush timer and flush pending data. */
  async shutdown(): Promise<void> {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
    }
    await this.flush();
    this.pendingSpans.length = 0;
    this.pendingMetrics.length = 0;
  }

  private async post(path: string, body: unknown): Promise<void> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, 2000);
      await fetch(`${this.endpoint}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      // Swallow exporter errors — telemetry must not break the app.
    }
  }

  private buildTracePayload(spans: Span[]): Record<string, unknown> {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: this.serviceName } },
              { key: 'service.version', value: { stringValue: this.serviceVersion } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'vedmoulya' },
              spans: spans.map((s) => this.toOtlpSpan(s)),
            },
          ],
        },
      ],
    };
  }

  private buildMetricPayload(metrics: Metric[]): Record<string, unknown> {
    const metricsPayload = metrics.map((m) => {
      // OTLP metric data types: counters → sum, gauges → gauge, histograms →
      // sum (each emitted point is one observation; the collector aggregates).
      const dataPoint = {
        asDouble: m.value,
        timeUnixNano: new Date(m.timestamp).getTime() * 1_000_000,
      };
      if (m.type === 'gauge') {
        return {
          name: m.name,
          description: `vedmoulya ${m.type} metric`,
          unit: '1',
          gauge: { dataPoints: [dataPoint] },
        };
      }
      return {
        name: m.name,
        description: `vedmoulya ${m.type} metric`,
        unit: m.type === 'histogram' ? 'ms' : '1',
        sum: {
          dataPoints: [dataPoint],
          isMonotonic: m.type === 'counter',
          aggregationTemporality: 2, // CUMULATIVE
        },
      };
    });
    return {
      resourceMetrics: [
        {
          resource: {
            attributes: [{ key: 'service.name', value: { stringValue: this.serviceName } }],
          },
          scopeMetrics: [
            {
              scope: { name: 'vedmoulya' },
              metrics: metricsPayload,
            },
          ],
        },
      ],
    };
  }
}
