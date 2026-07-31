import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardAnalyticsService } from '../DashboardAnalyticsService.js';

describe('DashboardAnalyticsService', () => {
  let service: DashboardAnalyticsService;

  beforeEach(() => {
    service = new DashboardAnalyticsService();
  });

  describe('trackLoad', () => {
    it('tracks successful load', () => {
      service.trackLoad('identity', 50, true);
      const analytics = service.getAnalytics();
      expect(analytics.totalLoads).toBe(1);
      expect(analytics.averageLoadTime).toBe(50);
    });

    it('tracks failed load', () => {
      service.trackLoad('execution', 100, false);
      const section = service.getSectionAnalytics('execution');
      expect(section?.errorCount).toBe(1);
    });

    it('aggregates multiple loads', () => {
      service.trackLoad('identity', 50, true);
      service.trackLoad('identity', 150, true);
      const section = service.getSectionAnalytics('identity');
      expect(section?.loadCount).toBe(2);
      expect(section?.averageLatency).toBe(100);
    });
  });

  describe('trackCacheHit / trackCacheMiss', () => {
    it('tracks cache hit rate', () => {
      service.trackCacheHit();
      service.trackCacheHit();
      service.trackCacheHit();
      service.trackCacheMiss();
      const analytics = service.getAnalytics();
      expect(analytics.cacheHitRate).toBeCloseTo(0.75);
    });

    it('handles zero cache operations', () => {
      expect(service.getAnalytics().cacheHitRate).toBe(0);
    });
  });

  describe('trackEvent', () => {
    it('tracks custom analytics events', () => {
      service.trackEvent('widget_render', 'focus', 25, { widgetSize: 'large' });
      const analytics = service.getAnalytics();
      expect(analytics.recentEvents).toHaveLength(1);
      expect(analytics.recentEvents[0]!.eventType).toBe('widget_render');
    });
  });

  describe('getSectionAnalytics', () => {
    it('returns section-specific analytics', () => {
      service.trackLoad('memory', 30, true);
      const section = service.getSectionAnalytics('memory');
      expect(section).toBeDefined();
      expect(section!.sectionId).toBe('memory');
      expect(section!.loadCount).toBe(1);
    });

    it('returns undefined for untracked section', () => {
      expect(service.getSectionAnalytics('nonexistent')).toBeUndefined();
    });
  });

  describe('getPerformanceSummary', () => {
    it('returns aggregated performance summary', () => {
      service.trackLoad('a', 50, true);
      service.trackLoad('b', 100, false);
      service.trackCacheHit();
      service.trackCacheMiss();
      const summary = service.getPerformanceSummary();
      expect(summary.averageLoadTime).toBe(75);
      expect(summary.totalSections).toBe(2);
      expect(summary.totalEvents).toBe(2);
      expect(summary.errorRate).toBe(0.5);
    });
  });

  describe('reset', () => {
    it('clears all analytics data', () => {
      service.trackLoad('identity', 50, true);
      service.trackCacheHit();
      service.reset();
      const analytics = service.getAnalytics();
      expect(analytics.totalLoads).toBe(0);
      expect(analytics.sectionAnalytics).toHaveLength(0);
      expect(analytics.recentEvents).toHaveLength(0);
    });
  });

  describe('topSections / slowestSections', () => {
    it('identifies top and slowest sections', () => {
      service.trackLoad('fast', 10, true);
      service.trackLoad('fast', 10, true);
      service.trackLoad('slow', 500, true);
      service.trackLoad('medium', 100, true);
      const analytics = service.getAnalytics();
      expect(analytics.topSections).toContain('fast');
      expect(analytics.slowestSections).toContain('slow');
    });
  });
});
