import { describe, it, expect, vi } from 'vitest';
import { LearningHealthService } from '../LearningHealthService.js';

describe('LearningHealthService', () => {
  it('returns critical when service is down', () => {
    const svc = new LearningHealthService();
    svc.reportHealth('cache', 'down', 0);
    const h = svc.getHealth();
    expect(h.overall).toBe('critical');
    expect(h.warnings).toContain('cache is down');
  });

  it('returns degraded when service is degraded', () => {
    const svc = new LearningHealthService();
    svc.reportHealth('cache', 'degraded', 200);
    const h = svc.getHealth();
    expect(h.overall).toBe('degraded');
    expect(h.warnings).toContain('cache is degraded (200ms)');
  });

  it('returns healthy when all services are healthy', () => {
    const svc = new LearningHealthService();
    svc.reportHealth('profile', 'healthy', 10);
    svc.reportHealth('cache', 'healthy', 5);
    const h = svc.getHealth();
    expect(h.overall).toBe('healthy');
    expect(h.warnings.length).toBe(0);
  });

  it('isHealthy returns true only with healthy services', () => {
    const svc = new LearningHealthService();
    expect(svc.isHealthy()).toBe(false);
    svc.reportHealth('profile', 'healthy', 10);
    expect(svc.isHealthy()).toBe(true);
    svc.reportHealth('cache', 'down', 0);
    expect(svc.isHealthy()).toBe(false);
  });

  it('reset clears all services', () => {
    const svc = new LearningHealthService();
    svc.reportHealth('profile', 'healthy', 10);
    svc.reset();
    expect(svc.isHealthy()).toBe(false);
    expect(svc.getHealth().services.length).toBe(0);
  });

  it('warns about stale services', () => {
    const svc = new LearningHealthService();
    vi.useFakeTimers();
    svc.reportHealth('profile', 'healthy', 10);
    vi.advanceTimersByTime(400_000);
    const h = svc.getHealth();
    expect(h.warnings.some((w) => w.includes("hasn't reported"))).toBe(true);
    vi.useRealTimers();
  });
});
