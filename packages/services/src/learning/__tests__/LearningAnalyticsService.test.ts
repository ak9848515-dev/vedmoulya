import { describe, it, expect } from 'vitest';
import { LearningAnalyticsService } from '../LearningAnalyticsService.js';

describe('LearningAnalyticsService', () => {
  it('starts with zero analytics', () => {
    const svc = new LearningAnalyticsService();
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(0);
    expect(a.averageLoadTime).toBe(0);
    expect(a.cacheHitRate).toBe(0);
  });

  it('tracks loads', () => {
    const svc = new LearningAnalyticsService();
    svc.trackLoad('learning', 50, true);
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(1);
    expect(a.recentEvents.length).toBe(1);
    expect(a.recentEvents[0].type).toBe('load_success');
  });

  it('tracks cache hits and misses', () => {
    const svc = new LearningAnalyticsService();
    svc.trackCacheHit();
    svc.trackCacheHit();
    svc.trackCacheMiss();
    const a = svc.getAnalytics();
    expect(a.cacheHitRate).toBeCloseTo(2 / 3);
  });

  it('tracks failed loads', () => {
    const svc = new LearningAnalyticsService();
    svc.trackLoad('learning', 100, false);
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(1);
    expect(a.recentEvents[0].type).toBe('load_error');
  });

  it('reset clears all data', () => {
    const svc = new LearningAnalyticsService();
    svc.trackLoad('learning', 50, true);
    svc.trackCacheHit();
    svc.reset();
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(0);
    expect(a.cacheHitRate).toBe(0);
  });
});
