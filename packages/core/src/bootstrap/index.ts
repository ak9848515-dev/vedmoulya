// ──────────────────────────────────────────────────────────────────
// VedMoulya — Application Bootstrap
// Initializes the platform: config, DI, modules, lifecycle, health
// Implements BLP-001/D01 — Application bootstrap sequence
// ──────────────────────────────────────────────────────────────────

import { ApplicationLifecycle, appLifecycle } from '../lifecycle/index.js';
import { GracefulShutdown } from '../lifecycle/gracefulShutdown.js';
import type { ShutdownResource } from '../lifecycle/gracefulShutdown.js';
import { HealthChecker, healthChecker, memoryHealthCheck } from '../health/index.js';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';
import { moduleRegistry } from '../modules/index.js';
import { MetricsRegistry, metrics } from '../metrics/index.js';
import { recordRuntimeMetrics } from '../observability/runtime.js';
import { env, defineStandardEnvVars } from '../env/index.js';

/** Interval for process-level runtime gauge collection (PH-002/T1). */
const RUNTIME_METRICS_INTERVAL_MS = 15_000;

export interface BootstrapOptions {
  /** Service name for logging and metrics */
  serviceName?: string;
  /** Whether to validate environment variables */
  validateEnv?: boolean;
  /** Custom lifecycle instance */
  lifecycle?: ApplicationLifecycle;
  /** Custom health checker */
  healthChecker?: HealthChecker;
  /** Custom metrics registry */
  metricsRegistry?: MetricsRegistry;
  /** Additional startup hooks */
  startupHooks?: Array<() => Promise<void>>;
  /** Additional shutdown hooks */
  shutdownHooks?: Array<() => Promise<void>>;
  /**
   * Enable graceful shutdown signal handling (SIGTERM/SIGINT).
   * PH-002 — Enterprise Operations & Reliability (T2).
   */
  gracefulShutdown?: {
    enabled?: boolean;
    /** Set to false to skip installing process signal handlers (tests). */
    installSignals?: boolean;
    /** Hook that stops the HTTP layer accepting new requests. */
    onStopAcceptingRequests?: () => void | Promise<void>;
    /** Hook that drains in-flight requests. */
    onDrainRequests?: () => void | Promise<void>;
    /** Hook that flushes metrics (e.g. OTLP exporter). */
    onFlushMetrics?: () => void | Promise<void>;
    /** Ordered resources to close: DB pools, Redis, AI, workers. */
    resources?: ShutdownResource[];
    /** Overall shutdown timeout in ms. Default 10s. */
    timeoutMs?: number;
  };
}

export interface BootstrapResult {
  lifecycle: ApplicationLifecycle;
  healthChecker: HealthChecker;
  metricsRegistry: MetricsRegistry;
  started: boolean;
  /** Graceful shutdown controller (PH-002/T2), when enabled. */
  shutdownController?: GracefulShutdown;
}

/**
 * Bootstrap the application platform
 */
export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const lifecycle = options.lifecycle ?? appLifecycle;
  const health = options.healthChecker ?? healthChecker;
  const metricsRegistry = options.metricsRegistry ?? metrics;

  const serviceName = options.serviceName ?? config.app.name;
  let shutdownController: GracefulShutdown | undefined;

  // Define standard env vars
  defineStandardEnvVars(env);

  // Validate environment if requested
  if (options.validateEnv ?? true) {
    env.validate();
  }

  // Register startup hooks
  lifecycle.onStart(() => {
    logger.info('Initializing modules', { serviceName });
    return moduleRegistry.initializeAll();
  });

  lifecycle.onStart(() => {
    logger.info('Registering health checks', { serviceName });
    health.register('memory', memoryHealthCheck());
    return Promise.resolve();
  });

  // PH-002/T1 — process-level runtime gauges (memory, CPU, uptime) so the
  // Prometheus exporter has real values to scrape. Collected immediately and
  // then on a fixed interval; the timer is unref'd so it never holds the
  // process open, and it is cleared during shutdown.
  let runtimeMetricsTimer: ReturnType<typeof setInterval> | undefined;
  lifecycle.onStart(() => {
    recordRuntimeMetrics(metricsRegistry);
    runtimeMetricsTimer = setInterval(() => {
      recordRuntimeMetrics(metricsRegistry);
    }, RUNTIME_METRICS_INTERVAL_MS);
    runtimeMetricsTimer.unref();
    return Promise.resolve();
  });

  lifecycle.onStop(() => {
    if (runtimeMetricsTimer !== undefined) {
      clearInterval(runtimeMetricsTimer);
      runtimeMetricsTimer = undefined;
    }
    return Promise.resolve();
  });

  // Register additional startup hooks
  if (options.startupHooks) {
    for (const hook of options.startupHooks) {
      lifecycle.onStart(hook);
    }
  }

  // Register shutdown hooks
  lifecycle.onStop(() => {
    logger.info('Cleaning up', { serviceName });
    metricsRegistry.reset();
    return Promise.resolve();
  });

  if (options.shutdownHooks) {
    for (const hook of options.shutdownHooks) {
      lifecycle.onStop(hook);
    }
  }

  // PH-002/T2 — Graceful shutdown: install signal handlers and drive the
  // ordered shutdown sequence (stop accepting → drain → flush metrics →
  // close DB/Redis/AI/workers). Resources are owned exclusively by the
  // GracefulShutdown instance so they are never double-closed; lifecycle.stop()
  // (the completion hook) only runs the generic hooks (metrics reset, caller
  // shutdownHooks), which do not re-close resources.
  const gsConfig = options.gracefulShutdown;
  if (gsConfig?.enabled ?? true) {
    const graceful = new GracefulShutdown({
      timeoutMs: gsConfig?.timeoutMs,
      onStopAcceptingRequests: gsConfig?.onStopAcceptingRequests,
      onDrainRequests: gsConfig?.onDrainRequests,
      onFlushMetrics: gsConfig?.onFlushMetrics,
      resources: gsConfig?.resources,
      onComplete: (): Promise<void> => lifecycle.stop(),
    });
    const defaultInstall = process.env.NODE_ENV !== 'test';
    if (gsConfig?.installSignals ?? defaultInstall) {
      graceful.install();
    }
    // Expose the instance so callers/tests can trigger and verify shutdown.
    shutdownController = graceful;
  }

  // Start the application
  await lifecycle.start();

  return {
    lifecycle,
    healthChecker: health,
    metricsRegistry,
    started: lifecycle.phase === 'started',
    shutdownController,
  };
}
