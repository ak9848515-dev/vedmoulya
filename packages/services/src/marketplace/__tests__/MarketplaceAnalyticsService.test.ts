// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Analytics Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceAnalyticsService } from '../MarketplaceAnalyticsService.js';

describe('MarketplaceAnalyticsService', () => {
  it('getAnalytics returns zeros initially', () => {
    const svc = new MarketplaceAnalyticsService();
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(0);
    expect(a.averageLoadTime).toBe(0);
    expect(a.cacheHitRate).toBe(0);
    expect(a.recentEvents).toEqual([]);
  });

  it('trackLoad tracks section and latency', () => {
    const svc = new MarketplaceAnalyticsService();
    svc.trackLoad('catalog', 100, true);
    svc.trackLoad('install', 200, true);
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(2);
    expect(a.averageLoadTime).toBe(150);
    expect(a.recentEvents.length).toBe(2);
  });

  it('trackLoad records success and error events', () => {
    const svc = new MarketplaceAnalyticsService();
    svc.trackLoad('catalog', 100, true);
    svc.trackLoad('providers', 300, false);
    const a = svc.getAnalytics();
    expect(a.recentEvents[0].success).toBe(false);
    expect(a.recentEvents[1].success).toBe(true);
  });

  it('trackCacheHit and trackCacheMiss update hit rate', () => {
    const svc = new MarketplaceAnalyticsService();
    svc.trackCacheHit();
    svc.trackCacheHit();
    svc.trackCacheMiss();
    const a = svc.getAnalytics();
    expect(a.cacheHitRate).toBeCloseTo(2 / 3);
  });

  it('reset clears all state', () => {
    const svc = new MarketplaceAnalyticsService();
    svc.trackLoad('catalog', 100, true);
    svc.trackCacheHit();
    svc.reset();
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(0);
    expect(a.recentEvents.length).toBe(0);
    expect(a.cacheHitRate).toBe(0);
  });
});
