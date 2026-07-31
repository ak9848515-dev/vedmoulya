import { describe, it, expect } from 'vitest';
import { BusinessAnalyticsService } from '../BusinessAnalyticsService.js';

describe('BusinessAnalyticsService', () => {
  let svc: BusinessAnalyticsService;
  beforeEach(() => {
    svc = new BusinessAnalyticsService();
  });

  it('getAnalytics returns zero state initially', () => {
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(0);
    expect(a.averageLoadTime).toBe(0);
    expect(a.cacheHitRate).toBe(0);
  });

  it('trackLoad records event', () => {
    svc.trackLoad('business', 100, true);
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(1);
    expect(a.averageLoadTime).toBe(100);
    expect(a.recentEvents.length).toBe(1);
    expect(a.recentEvents[0].success).toBe(true);
  });

  it('trackLoad records failure events', () => {
    svc.trackLoad('business', 200, false);
    const a = svc.getAnalytics();
    expect(a.recentEvents[0].success).toBe(false);
    expect(a.recentEvents[0].type).toBe('load_error');
  });

  it('trackCacheHit and trackCacheMiss compute hit rate', () => {
    svc.trackCacheHit();
    svc.trackCacheHit();
    svc.trackCacheMiss();
    expect(svc.getAnalytics().cacheHitRate).toBeCloseTo(2 / 3);
  });

  it('limits recent events to 1000', () => {
    for (let i = 0; i < 1010; i++) svc.trackLoad('section', i, true);
    expect(svc.getAnalytics().recentEvents.length).toBeLessThanOrEqual(1000);
  });

  it('reset clears all state', () => {
    svc.trackLoad('biz', 50, true);
    svc.trackCacheHit();
    svc.reset();
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(0);
    expect(a.cacheHitRate).toBe(0);
    expect(a.recentEvents.length).toBe(0);
  });

  it('trackLoad computes average across multiple loads', () => {
    svc.trackLoad('biz', 100, true);
    svc.trackLoad('biz', 200, true);
    svc.trackLoad('biz', 300, true);
    expect(svc.getAnalytics().averageLoadTime).toBe(200);
  });
});
