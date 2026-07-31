// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Metrics Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceMetricsService } from '../MarketplaceMetricsService.js';

describe('MarketplaceMetricsService', () => {
  it('calculateMarketplaceScore returns 0 for zero components', () => {
    const svc = new MarketplaceMetricsService();
    const score = svc.calculateMarketplaceScore({
      catalogCompleteness: 0,
      installationSuccessRate: 0,
      compatibilityScore: 0,
      averageRating: 0,
      providerHealth: 0,
      updateCoverage: 0,
    });
    expect(score).toBe(0);
  });

  it('calculateMarketplaceScore returns correct weighted value', () => {
    const svc = new MarketplaceMetricsService();
    const score = svc.calculateMarketplaceScore({
      catalogCompleteness: 100,
      installationSuccessRate: 100,
      compatibilityScore: 100,
      averageRating: 100,
      providerHealth: 100,
      updateCoverage: 100,
    });
    // (100*0.2 + 100*0.2 + 100*0.15 + 100*0.15 + 100*0.15 + 100*0.15) * 10 = 1000
    expect(score).toBe(1000);
  });

  it('calculateMarketplaceScore handles balanced values', () => {
    const svc = new MarketplaceMetricsService();
    const score = svc.calculateMarketplaceScore({
      catalogCompleteness: 50,
      installationSuccessRate: 80,
      compatibilityScore: 70,
      averageRating: 60,
      providerHealth: 90,
      updateCoverage: 40,
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1000);
  });

  it('calculateMarketplaceScore handles mixed values', () => {
    const svc = new MarketplaceMetricsService();
    const score = svc.calculateMarketplaceScore({
      catalogCompleteness: 30,
      installationSuccessRate: 50,
      compatibilityScore: 20,
      averageRating: 10,
      providerHealth: 40,
      updateCoverage: 60,
    });
    expect(score).toBeGreaterThan(0);
  });

  it('aggregate returns complete metrics DTO', () => {
    const svc = new MarketplaceMetricsService();
    const m = svc.aggregate({
      totalAssets: 100,
      installedCount: 20,
      activeCount: 15,
      availableUpdates: 5,
      providerCount: 3,
      templateCount: 8,
      packCount: 4,
      averageRating: 4.5,
      totalDownloads: 1000,
      compatibilityScore: 90,
      installationSuccessRate: 95,
      catalogCompleteness: 80,
      providerHealth: 85,
      updateCoverage: 75,
    });
    expect(m.totalAssets).toBe(100);
    expect(m.installedCount).toBe(20);
    expect(m.activeCount).toBe(15);
    expect(m.availableUpdates).toBe(5);
    expect(m.averageRating).toBe(4.5);
    expect(m.overallHealth).toBeGreaterThan(0);
  });
});
