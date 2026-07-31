import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardHealthService } from '../DashboardHealthService.js';

describe('DashboardHealthService', () => {
  let service: DashboardHealthService;

  beforeEach(() => {
    service = new DashboardHealthService();
  });

  describe('reportHealth / getHealth', () => {
    it('reports and retrieves health status', () => {
      service.reportHealth('identity', 'healthy', 5);
      service.reportHealth('memory', 'healthy', 10);
      const health = service.getHealth();
      expect(health.overall).toBe('healthy');
      expect(health.services).toHaveLength(2);
      expect(health.warnings).toHaveLength(0);
    });

    it('detects degraded services', () => {
      service.reportHealth('identity', 'healthy', 5);
      service.reportHealth('memory', 'degraded', 500);
      const health = service.getHealth();
      expect(health.overall).toBe('degraded');
      expect(health.warnings).toHaveLength(1);
    });

    it('detects down services (critical)', () => {
      service.reportHealth('ai', 'down', 0);
      const health = service.getHealth();
      expect(health.overall).toBe('critical');
      expect(health.warnings).toHaveLength(1);
      expect(health.warnings[0]).toContain('ai is down');
    });

    it('critical takes precedence over degraded', () => {
      service.reportHealth('identity', 'degraded', 500);
      service.reportHealth('memory', 'down', 0);
      const health = service.getHealth();
      expect(health.overall).toBe('critical');
    });
  });

  describe('isHealthy', () => {
    it('returns true when all services are healthy', () => {
      service.reportHealth('identity', 'healthy', 5);
      service.reportHealth('memory', 'healthy', 10);
      expect(service.isHealthy()).toBe(true);
    });

    it('returns false when no services reported', () => {
      expect(service.isHealthy()).toBe(false);
    });

    it('returns false when any service is degraded', () => {
      service.reportHealth('identity', 'healthy', 5);
      service.reportHealth('memory', 'degraded', 100);
      expect(service.isHealthy()).toBe(false);
    });
  });

  describe('getServiceCounts', () => {
    it('counts services by status', () => {
      service.reportHealth('id1', 'healthy', 5);
      service.reportHealth('id2', 'healthy', 10);
      service.reportHealth('id3', 'degraded', 100);
      service.reportHealth('id4', 'down', 0);
      const counts = service.getServiceCounts();
      expect(counts.healthy).toBe(2);
      expect(counts.degraded).toBe(1);
      expect(counts.down).toBe(1);
    });
  });

  describe('reset', () => {
    it('clears all health data', () => {
      service.reportHealth('identity', 'healthy', 5);
      service.reset();
      expect(service.isHealthy()).toBe(false);
      expect(service.getHealth().services).toHaveLength(0);
    });
  });
});
