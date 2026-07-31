// ──────────────────────────────────────────────────────────────────
// VedMoulya — Application Bootstrap
// Initializes the platform: config, DI, modules, lifecycle, health
// Implements BLP-001/D01 — Application bootstrap sequence
// ──────────────────────────────────────────────────────────────────

import { ApplicationLifecycle, appLifecycle } from '../lifecycle/index.js';
import { HealthChecker, healthChecker, memoryHealthCheck } from '../health/index.js';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';
import { moduleRegistry } from '../modules/index.js';
import { MetricsRegistry, metrics } from '../metrics/index.js';
import { env, defineStandardEnvVars } from '../env/index.js';

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
}

export interface BootstrapResult {
  lifecycle: ApplicationLifecycle;
  healthChecker: HealthChecker;
  metricsRegistry: MetricsRegistry;
  started: boolean;
}

/**
 * Bootstrap the application platform
 */
export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const lifecycle = options.lifecycle ?? appLifecycle;
  const health = options.healthChecker ?? healthChecker;
  const metricsRegistry = options.metricsRegistry ?? metrics;

  const serviceName = options.serviceName ?? config.app.name;

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

  // Start the application
  await lifecycle.start();

  return {
    lifecycle,
    healthChecker: health,
    metricsRegistry,
    started: lifecycle.phase === 'started',
  };
}
