// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Observability Startup
// Wires the OTLP exporter and process-level runtime metrics into the API
// gateway lifecycle so metrics are actually exported in production.
// PH-002 — Enterprise Operations & Reliability (T1 Observability)
// ─────────────────────────────────────────────────────────────────────────────

import { OtelExporter, logger, metrics, recordRuntimeMetrics } from '@vedmoulya/core';

/** Interval for process-level runtime gauge collection (PH-002/T1). */
const RUNTIME_METRICS_INTERVAL_MS = 15_000;

export interface GatewayObservabilityOptions {
  /** OTLP/HTTP endpoint, e.g. http://otel-collector:4318. */
  endpoint?: string;
  serviceName?: string;
  serviceVersion?: string;
  /** OTLP batch flush interval in ms. Default 5000. */
  flushIntervalMs?: number;
  /** Runtime gauge collection interval in ms. Default 15000. */
  runtimeMetricsIntervalMs?: number;
  /**
   * Install SIGTERM/SIGINT handlers that flush the exporter on shutdown.
   * Defaults to true outside NODE_ENV=test.
   */
  installSignals?: boolean;
}

export interface GatewayObservability {
  /** The OTLP exporter (disabled when no endpoint is configured). */
  exporter: OtelExporter;
  /** Whether the exporter is actually exporting. */
  enabled: boolean;
  /** Flush pending spans/metrics to the OTLP endpoint. */
  flush(): Promise<void>;
  /** Clear the runtime timer and shut the exporter down. */
  shutdown(): Promise<void>;
}

let instance: GatewayObservability | undefined;
let runtimeTimer: ReturnType<typeof setInterval> | undefined;
let signalCleanup: Array<() => void> = [];

/**
 * Initialize gateway observability. Idempotent — subsequent calls return the
 * existing instance. Creates an OtelExporter (enabled only when an OTLP
 * endpoint is configured), attaches the global metrics registry so every
 * emitted metric is exported, and starts collecting process-level runtime
 * gauges (memory / CPU / uptime) on an interval.
 *
 * Failures are swallowed by the exporter itself, so observability never
 * affects request processing.
 */
export function initGatewayObservability(
  options: GatewayObservabilityOptions = {},
): GatewayObservability {
  if (instance) return instance;

  // Enable only when an endpoint is explicitly configured (option or env).
  // The exporter's own convention is "no endpoint = disabled" so we never
  // spam an absent collector with the config's localhost default.
  const endpoint = (options.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '').trim();

  const exporter = new OtelExporter({
    endpoint,
    serviceName: options.serviceName ?? process.env.OTEL_SERVICE_NAME ?? 'vedmoulya-api',
    serviceVersion: options.serviceVersion ?? process.env.APP_VERSION ?? '1.0.0',
    flushIntervalMs: options.flushIntervalMs,
  });

  if (exporter.isEnabled) {
    // Bridge the global MetricsRegistry into the exporter so counters,
    // gauges and histograms emitted anywhere in the gateway are exported.
    // Note: the registry has no listener-removal API, so this listener is
    // permanent (bounded at 10k buffered metrics by the exporter) — fine for
    // a once-per-process gateway.
    exporter.attach((listener) => {
      metrics.onMetric(listener);
    });
    logger.info('OpenTelemetry exporter enabled', { endpoint });
  } else {
    logger.info(
      'OpenTelemetry exporter disabled — set OTEL_EXPORTER_OTLP_ENDPOINT to enable metric export',
    );
  }

  // PH-002/T1 — process-level runtime gauges so the exported registry has
  // real memory/CPU/uptime values. Collected immediately, then on an unref'd
  // interval so it never holds the process open.
  recordRuntimeMetrics(metrics);
  runtimeTimer = setInterval(() => {
    recordRuntimeMetrics(metrics);
  }, options.runtimeMetricsIntervalMs ?? RUNTIME_METRICS_INTERVAL_MS);
  runtimeTimer.unref();

  const flush = async (): Promise<void> => {
    await exporter.flush();
  };

  const shutdown = async (): Promise<void> => {
    if (runtimeTimer !== undefined) {
      clearInterval(runtimeTimer);
      runtimeTimer = undefined;
    }
    await exporter.shutdown();
  };

  const installSignals = options.installSignals ?? process.env.NODE_ENV !== 'test';
  if (installSignals) {
    const onSignal = (): void => {
      void flush();
    };
    process.on('SIGTERM', onSignal);
    process.on('SIGINT', onSignal);
    signalCleanup = [
      (): void => {
        process.removeListener('SIGTERM', onSignal);
      },
      (): void => {
        process.removeListener('SIGINT', onSignal);
      },
    ];
  }

  instance = { exporter, enabled: exporter.isEnabled, flush, shutdown };
  return instance;
}

/** Flush pending metrics to the OTLP endpoint (no-op when not initialized). */
export async function flushGatewayObservability(): Promise<void> {
  if (instance) await instance.flush();
}

/**
 * Shut down gateway observability: clear the runtime timer, flush and stop
 * the exporter, and remove signal handlers. Resets the singleton so the
 * gateway can be re-initialized (e.g. in tests).
 */
export async function shutdownGatewayObservability(): Promise<void> {
  if (!instance) return;
  for (const cleanup of signalCleanup) cleanup();
  signalCleanup = [];
  const handle = instance;
  instance = undefined;
  await handle.shutdown();
}
