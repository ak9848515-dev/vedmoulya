// ──────────────────────────────────────────────────────────────────
// VedMoulya — Bootstrap Tests
// Application bootstrap sequence (BLP-001/D01)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bootstrap } from '../index.js';
import { ApplicationLifecycle, appLifecycle } from '../../lifecycle/index.js';
import { HealthChecker, healthChecker } from '../../health/index.js';
import { MetricsRegistry, metrics } from '../../metrics/index.js';
import { env } from '../../env/index.js';
import { moduleRegistry } from '../../modules/index.js';

describe('bootstrap', () => {
  beforeEach(() => {
    moduleRegistry.reset();
    appLifecycle.reset();
    env.clear();
    vi.restoreAllMocks();
  });

  it('boots the platform and registers the memory health check', async () => {
    const lifecycle = new ApplicationLifecycle();
    const checker = new HealthChecker();
    const registry = new MetricsRegistry();

    const result = await bootstrap({
      serviceName: 'test-service',
      validateEnv: false,
      lifecycle,
      healthChecker: checker,
      metricsRegistry: registry,
      gracefulShutdown: { enabled: false },
    });

    expect(result.started).toBe(true);
    expect(result.lifecycle).toBe(lifecycle);
    expect(result.healthChecker).toBe(checker);
    expect(result.metricsRegistry).toBe(registry);
    expect(result.shutdownController).toBeUndefined();
  });

  it('runs custom startup hooks and registers shutdown hooks', async () => {
    const lifecycle = new ApplicationLifecycle();
    const startup = vi.fn().mockResolvedValue(undefined);
    const shutdown = vi.fn().mockResolvedValue(undefined);

    await bootstrap({
      validateEnv: false,
      lifecycle,
      healthChecker: new HealthChecker(),
      metricsRegistry: new MetricsRegistry(),
      startupHooks: [startup],
      shutdownHooks: [shutdown],
      gracefulShutdown: { enabled: false },
    });

    expect(startup).toHaveBeenCalled();

    await lifecycle.stop();
    expect(shutdown).toHaveBeenCalled();
  });

  it('creates a graceful shutdown controller by default (no signal install in tests)', async () => {
    const result = await bootstrap({
      validateEnv: false,
      lifecycle: new ApplicationLifecycle(),
      healthChecker: new HealthChecker(),
      metricsRegistry: new MetricsRegistry(),
    });

    expect(result.shutdownController).toBeDefined();
    expect(result.shutdownController?.isShuttingDown).toBe(false);
  });

  it('honors installSignals: false without installing process handlers', async () => {
    const result = await bootstrap({
      validateEnv: false,
      lifecycle: new ApplicationLifecycle(),
      healthChecker: new HealthChecker(),
      metricsRegistry: new MetricsRegistry(),
      gracefulShutdown: { installSignals: false },
    });

    expect(result.shutdownController).toBeDefined();
  });

  it('uses the shared singletons by default', async () => {
    const result = await bootstrap({
      validateEnv: false,
      gracefulShutdown: { enabled: false },
    });

    expect(result.healthChecker).toBe(healthChecker);
    expect(result.metricsRegistry).toBe(metrics);
    expect(result.started).toBe(true);
  });
});
