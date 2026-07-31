import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CareerHealthService } from '../CareerHealthService.js';

describe('CareerHealthService', () => {
  let health: CareerHealthService;
  beforeEach(() => {
    vi.useFakeTimers();
    health = new CareerHealthService();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('isHealthy returns false with no services', () => {
    expect(health.isHealthy()).toBe(false);
  });

  it('isHealthy returns true when all services healthy', () => {
    health.reportHealth('career', 'healthy', 5);
    health.reportHealth('skills', 'healthy', 10);
    expect(health.isHealthy()).toBe(true);
  });

  it('isHealthy returns false when a service is degraded', () => {
    health.reportHealth('career', 'healthy', 5);
    health.reportHealth('skills', 'degraded', 500);
    expect(health.isHealthy()).toBe(false);
  });

  it('getHealth returns healthy overall', () => {
    health.reportHealth('career', 'healthy', 5);
    const h = health.getHealth();
    expect(h.overall).toBe('healthy');
    expect(h.services).toHaveLength(1);
  });

  it('getHealth returns critical when down', () => {
    health.reportHealth('db', 'down', 0);
    expect(health.getHealth().overall).toBe('critical');
  });

  it('getHealth returns degraded', () => {
    health.reportHealth('svc', 'degraded', 500);
    expect(health.getHealth().overall).toBe('degraded');
  });

  it('includes stale service warnings', () => {
    health.reportHealth('svc', 'healthy', 5);
    vi.advanceTimersByTime(301_000);
    const h = health.getHealth();
    expect(h.warnings.some((w) => w.includes("hasn't reported"))).toBe(true);
  });

  it('reset clears all health data', () => {
    health.reportHealth('svc', 'healthy', 5);
    health.reset();
    expect(health.isHealthy()).toBe(false);
    expect(health.getHealth().services).toHaveLength(0);
  });
});
