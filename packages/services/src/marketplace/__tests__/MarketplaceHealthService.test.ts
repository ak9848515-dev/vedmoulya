// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Health Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceHealthService } from '../MarketplaceHealthService.js';

describe('MarketplaceHealthService', () => {
  it('getHealth returns healthy with no services', () => {
    const svc = new MarketplaceHealthService();
    const health = svc.getHealth();
    expect(health.overall).toBe('healthy');
    expect(health.services).toEqual([]);
  });

  it('reportHealth and getHealth tracks service status', () => {
    const svc = new MarketplaceHealthService();
    svc.reportHealth('catalog', 'healthy', 10);
    svc.reportHealth('providers', 'healthy', 20);
    const health = svc.getHealth();
    expect(health.overall).toBe('healthy');
    expect(health.services.length).toBe(2);
  });

  it('degraded service sets degraded overall', () => {
    const svc = new MarketplaceHealthService();
    svc.reportHealth('catalog', 'healthy', 10);
    svc.reportHealth('compatibility', 'degraded', 500);
    const health = svc.getHealth();
    expect(health.overall).toBe('degraded');
    expect(health.warnings.some((w) => w.includes('degraded'))).toBe(true);
  });

  it('down service sets critical overall', () => {
    const svc = new MarketplaceHealthService();
    svc.reportHealth('registry', 'down', 0);
    const health = svc.getHealth();
    expect(health.overall).toBe('critical');
    expect(health.warnings.some((w) => w.includes('down'))).toBe(true);
  });

  it('isHealthy returns true only when all services healthy', () => {
    const svc = new MarketplaceHealthService();
    expect(svc.isHealthy()).toBe(false);
    svc.reportHealth('catalog', 'healthy', 10);
    expect(svc.isHealthy()).toBe(true);
    svc.reportHealth('providers', 'degraded', 100);
    expect(svc.isHealthy()).toBe(false);
  });

  it('reset clears all services', () => {
    const svc = new MarketplaceHealthService();
    svc.reportHealth('catalog', 'healthy', 10);
    svc.reset();
    expect(svc.isHealthy()).toBe(false);
    expect(svc.getHealth().services.length).toBe(0);
  });

  it('getHealth warns for stale services (5+ minutes)', () => {
    const svc = new MarketplaceHealthService();
    svc.reportHealth('old-service', 'healthy', 10);
    // Force lastChecked to be 6 minutes ago
    const services = (svc as any).services;
    const entry = services.get('old-service');
    entry.lastChecked = Date.now() - 360_001;
    services.set('old-service', entry);
    const health = svc.getHealth();
    expect(health.warnings.some((w) => w.includes('5+ minutes'))).toBe(true);
  });
});
