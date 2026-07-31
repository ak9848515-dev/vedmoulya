// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Infrastructure Service Tests
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { LifeOSCacheService } from '../LifeOSCacheService.js';
import { LifeOSConfigurationService } from '../LifeOSConfigurationService.js';
import { LifeOSHealthService } from '../LifeOSHealthService.js';
import { LifeOSAnalyticsService } from '../LifeOSAnalyticsService.js';
import { LifeOSMetricsService } from '../LifeOSMetricsService.js';
import { LifeOSNavigationService } from '../LifeOSNavigationService.js';

describe('LifeOSCacheService', () => {
  it('get returns hit false for missing key', () => {
    const svc = new LifeOSCacheService();
    expect(svc.get('nonexistent')).toEqual({ hit: false });
  });
  it('set and get returns cached data', () => {
    const svc = new LifeOSCacheService();
    svc.set('k1', { data: 'test' });
    expect(svc.get('k1').hit).toBe(true);
  });
  it('invalidateByPrefix removes matching', () => {
    const svc = new LifeOSCacheService();
    svc.set('lifeos_u1', 'a');
    svc.set('lifeos_u2', 'b');
    svc.set('other', 'c');
    svc.invalidateByPrefix('lifeos_');
    expect(svc.get('lifeos_u1').hit).toBe(false);
    expect(svc.get('other').hit).toBe(true);
  });
  it('get returns hit false for expired entry', () => {
    const svc = new LifeOSCacheService(-1);
    svc.set('expired', 'v', -1000); // negative TTL = already expired
    expect(svc.get('expired').hit).toBe(false);
  });
  it('has returns false for expired entry', () => {
    const svc = new LifeOSCacheService(-1);
    svc.set('expired', 'v', -1000);
    expect(svc.has('expired')).toBe(false);
  });
  it('clear resets metrics', () => {
    const svc = new LifeOSCacheService();
    svc.set('a', 1);
    svc.get('a');
    svc.get('miss');
    svc.clear();
    expect(svc.getMetrics().hitRate).toBe(0);
  });
  it('has returns true for valid entry', () => {
    const svc = new LifeOSCacheService();
    svc.set('k', 'v');
    expect(svc.has('k')).toBe(true);
    expect(svc.has('nope')).toBe(false);
  });
  it('getMetrics returns correct stats', () => {
    const svc = new LifeOSCacheService();
    svc.set('a', 1);
    svc.set('b', 2);
    svc.get('a');
    svc.get('none');
    const m = svc.getMetrics();
    expect(m.totalEntries).toBe(2);
    expect(m.hitRate).toBeCloseTo(0.5);
  });

  // ── Performance Microbenchmarks ────────────────────────────────

  it('performance: set/get completes under 50ms', () => {
    const svc = new LifeOSCacheService();
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      svc.set(`k${i}`, { data: i });
      svc.get(`k${i}`);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('performance: miss completes under 50ms', () => {
    const svc = new LifeOSCacheService();
    const start = performance.now();
    for (let i = 0; i < 1000; i++) svc.get(`nonexistent_${i}`);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});

describe('LifeOSConfigurationService', () => {
  it('getConfig returns defaults', () => {
    const svc = new LifeOSConfigurationService();
    const c = svc.getConfig('u1');
    expect(c.userId).toBe('u1');
    expect(c.enabledModules).toContain('dashboard');
    expect(c.enabledModules).toContain('marketplace');
  });
  it('updateConfig merges', () => {
    const svc = new LifeOSConfigurationService();
    svc.getConfig('u2');
    const u = svc.updateConfig('u2', { maxRecommendations: 5 });
    expect(u.maxRecommendations).toBe(5);
    expect(u.cacheTTL).toBe(300_000);
  });
  it('resetConfig restores defaults', () => {
    const svc = new LifeOSConfigurationService();
    svc.getConfig('u3');
    svc.updateConfig('u3', { enableGlobalSearch: false });
    const r = svc.resetConfig('u3');
    expect(r.enableGlobalSearch).toBe(true);
  });
  it('isModuleEnabled returns correct', () => {
    const svc = new LifeOSConfigurationService();
    svc.getConfig('u4');
    expect(svc.isModuleEnabled('u4', 'dashboard')).toBe(true);
    expect(svc.isModuleEnabled('u4', 'marketplace')).toBe(true);
  });
});

describe('LifeOSHealthService', () => {
  it('isHealthy returns false with no modules', () => {
    const svc = new LifeOSHealthService();
    expect(svc.isHealthy()).toBe(false);
  });
  it('reportModuleHealth and getModuleHealth roundtrips', () => {
    const svc = new LifeOSHealthService();
    svc.reportModuleHealth('dashboard', 'healthy', 10);
    svc.reportModuleHealth('career', 'degraded', 200);
    const modules = svc.getModuleHealth();
    expect(modules.length).toBe(2);
    expect(modules.find((m) => m.name === 'career')?.status).toBe('degraded');
  });
  it('isHealthy returns false when any module degraded', () => {
    const svc = new LifeOSHealthService();
    svc.reportModuleHealth('dashboard', 'healthy', 10);
    svc.reportModuleHealth('career', 'down', 0);
    expect(svc.isHealthy()).toBe(false);
  });
  it('reset clears modules', () => {
    const svc = new LifeOSHealthService();
    svc.reportModuleHealth('dashboard', 'healthy', 10);
    svc.reset();
    expect(svc.isHealthy()).toBe(false);
  });
});

describe('LifeOSAnalyticsService', () => {
  it('getAnalytics returns zeros initially', () => {
    const svc = new LifeOSAnalyticsService();
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(0);
    expect(a.searchCount).toBe(0);
  });
  it('trackLoad tracks latency', () => {
    const svc = new LifeOSAnalyticsService();
    svc.trackLoad('lifeos', 150, true);
    expect(svc.getAnalytics().averageLoadTime).toBe(150);
  });
  it('trackSearch increments count', () => {
    const svc = new LifeOSAnalyticsService();
    svc.trackSearch();
    svc.trackSearch();
    expect(svc.getAnalytics().searchCount).toBe(2);
  });
  it('trackTimelineMerge increments count', () => {
    const svc = new LifeOSAnalyticsService();
    svc.trackTimelineMerge();
    expect(svc.getAnalytics().timelineMerges).toBe(1);
  });
  it('trackCacheHit and Miss update rate', () => {
    const svc = new LifeOSAnalyticsService();
    svc.trackCacheHit();
    svc.trackCacheHit();
    svc.trackCacheMiss();
    expect(svc.getAnalytics().cacheHitRate).toBeCloseTo(2 / 3);
  });
  it('trackLoad with success=false tracks error event', () => {
    const svc = new LifeOSAnalyticsService();
    svc.trackLoad('lifeos', 100, false);
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(1);
    expect(a.recentEvents[0].type).toBe('load_error');
  });
  it('reset clears all', () => {
    const svc = new LifeOSAnalyticsService();
    svc.trackLoad('lifeos', 100, true);
    svc.trackSearch();
    svc.reset();
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(0);
    expect(a.searchCount).toBe(0);
  });
});

describe('LifeOSMetricsService', () => {
  it('calculateLifeScore returns 0 for zero components', () => {
    const svc = new LifeOSMetricsService();
    const s = svc.calculateLifeScore({
      moduleEngagement: 0,
      notificationResponse: 0,
      recommendationFollow: 0,
      timelineActivity: 0,
      searchEngagement: 0,
      overallConsistency: 0,
    });
    expect(s).toBe(0);
  });
  it('calculateLifeScore returns correct weighted value', () => {
    const svc = new LifeOSMetricsService();
    const s = svc.calculateLifeScore({
      moduleEngagement: 100,
      notificationResponse: 100,
      recommendationFollow: 100,
      timelineActivity: 100,
      searchEngagement: 100,
      overallConsistency: 100,
    });
    expect(s).toBe(1000);
  });
  it('aggregate returns complete metrics DTO', () => {
    const svc = new LifeOSMetricsService();
    const m = svc.aggregate({
      moduleEngagement: { dashboard: 1, career: 1 },
      totalNotifications: 10,
      unreadNotifications: 3,
      totalRecommendations: 8,
      activeRecommendations: 5,
      searchPerformed: 20,
      timelineEntries: 50,
      quickActionsUsed: 15,
      engagementScore: 80,
      notificationResponse: 70,
      recommendationFollow: 60,
      timelineActivity: 75,
      searchEngagement: 50,
      overallConsistency: 65,
    });
    expect(m.lifeScore).toBeGreaterThan(0);
    expect(m.totalNotifications).toBe(10);
    expect(m.unreadNotifications).toBe(3);
  });
});

describe('LifeOSNavigationService', () => {
  it('getNavigation returns all modules sorted', () => {
    const svc = new LifeOSNavigationService();
    const nav = svc.getNavigation();
    expect(nav.length).toBe(5);
    expect(nav[0].module).toBe('dashboard');
    expect(nav[4].module).toBe('marketplace');
  });
  it('getNavigation includes badges', () => {
    const svc = new LifeOSNavigationService();
    const nav = svc.getNavigation({ dashboard: 3, career: 1 });
    expect(nav.find((n) => n.module === 'dashboard')?.badge).toBe(3);
    expect(nav.find((n) => n.module === 'career')?.badge).toBe(1);
  });
  it('getPrimaryNavigation returns first 3', () => {
    const svc = new LifeOSNavigationService();
    expect(svc.getPrimaryNavigation().length).toBe(3);
  });
  it('getModuleRoute returns correct routes', () => {
    const svc = new LifeOSNavigationService();
    expect(svc.getModuleRoute('dashboard')).toBe('/dashboard');
    expect(svc.getModuleRoute('marketplace')).toBe('/marketplace');
  });
  it('getModuleLabel returns correct labels', () => {
    const svc = new LifeOSNavigationService();
    expect(svc.getModuleLabel('career')).toBe('Career');
    expect(svc.getModuleLabel('learning')).toBe('Learning');
  });
});
