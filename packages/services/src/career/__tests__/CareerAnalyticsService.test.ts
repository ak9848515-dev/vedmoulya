import { describe, it, expect } from 'vitest';
import { CareerAnalyticsService } from '../CareerAnalyticsService.js';

describe('CareerAnalyticsService', () => {
  it('starts with zero analytics', () => {
    const a = new CareerAnalyticsService();
    const analytics = a.getAnalytics();
    expect(analytics.totalLoads).toBe(0);
    expect(analytics.averageLoadTime).toBe(0);
    expect(analytics.cacheHitRate).toBe(0);
  });

  it('tracks loads', () => {
    const a = new CareerAnalyticsService();
    a.trackLoad('career', 50, true);
    const analytics = a.getAnalytics();
    expect(analytics.totalLoads).toBe(1);
    expect(analytics.averageLoadTime).toBe(50);
  });

  it('tracks cache hits and misses', () => {
    const a = new CareerAnalyticsService();
    a.trackCacheHit();
    a.trackCacheMiss();
    const analytics = a.getAnalytics();
    expect(analytics.cacheHitRate).toBe(0.5);
  });

  it('tracks failed loads', () => {
    const a = new CareerAnalyticsService();
    a.trackLoad('career', 100, false);
    expect(a.getAnalytics().totalLoads).toBe(1);
  });

  it('reset clears all data', () => {
    const a = new CareerAnalyticsService();
    a.trackLoad('career', 50, true);
    a.reset();
    expect(a.getAnalytics().totalLoads).toBe(0);
  });

  it('recentEvents returns last events', () => {
    const a = new CareerAnalyticsService();
    a.trackLoad('career', 50, true);
    const analytics = a.getAnalytics();
    expect(analytics.recentEvents).toHaveLength(1);
    expect(analytics.recentEvents[0]!.section).toBe('career');
  });
});
