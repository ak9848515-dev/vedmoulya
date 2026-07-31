import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessHealthService } from '../BusinessHealthService.js';

describe('BusinessHealthService', () => {
  let svc: BusinessHealthService;
  beforeEach(() => {
    vi.useFakeTimers();
    svc = new BusinessHealthService();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('getHealth returns healthy when no services reported', () => {
    const h = svc.getHealth();
    expect(h.overall).toBe('healthy');
    expect(h.warnings).toEqual([]);
  });

  it('reportHealth stores service status', () => {
    svc.reportHealth('identity', 'healthy', 10);
    svc.reportHealth('business', 'healthy', 20);
    const h = svc.getHealth();
    expect(h.services.length).toBe(2);
  });

  it('getHealth sets critical when a service is down', () => {
    svc.reportHealth('identity', 'healthy', 10);
    svc.reportHealth('database', 'down', 0);
    const h = svc.getHealth();
    expect(h.overall).toBe('critical');
    expect(h.warnings).toContain('database is down');
  });

  it('getHealth sets degraded when service is degraded', () => {
    svc.reportHealth('identity', 'degraded', 500);
    const h = svc.getHealth();
    expect(h.overall).toBe('degraded');
    expect(h.warnings).toContain('identity is degraded (500ms)');
  });

  it('stays critical even if degraded appears after down', () => {
    svc.reportHealth('db', 'down', 0);
    svc.reportHealth('api', 'degraded', 200);
    const h = svc.getHealth();
    expect(h.overall).toBe('critical');
  });

  it('warns about stale services', () => {
    svc.reportHealth('identity', 'healthy', 10);
    vi.advanceTimersByTime(310_000);
    const h = svc.getHealth();
    expect(h.warnings.some((w) => w.includes("hasn't reported"))).toBe(true);
  });

  it('isHealthy returns true when all services healthy', () => {
    svc.reportHealth('identity', 'healthy', 10);
    svc.reportHealth('business', 'healthy', 20);
    expect(svc.isHealthy()).toBe(true);
  });

  it('isHealthy returns false when no services reported', () => {
    expect(svc.isHealthy()).toBe(false);
  });

  it('isHealthy returns false when any service degraded', () => {
    svc.reportHealth('identity', 'healthy', 10);
    svc.reportHealth('db', 'down', 0);
    expect(svc.isHealthy()).toBe(false);
  });

  it('reset clears all services', () => {
    svc.reportHealth('identity', 'healthy', 10);
    svc.reset();
    expect(svc.isHealthy()).toBe(false);
    expect(svc.getHealth().services).toEqual([]);
  });
});
