// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Integration Service Tests
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { LifeOSSearchService } from '../LifeOSSearchService.js';
import { LifeOSTimelineService } from '../LifeOSTimelineService.js';
import { LifeOSRecommendationService } from '../LifeOSRecommendationService.js';
import { LifeOSNotificationService } from '../LifeOSNotificationService.js';
import { LifeOSQuickActionService } from '../LifeOSQuickActionService.js';
import { LifeOSInsightService } from '../LifeOSInsightService.js';
import type { QuickActionDTO } from '@vedmoulya/shared';

describe('LifeOSSearchService', () => {
  it('search returns empty with no indexed items', () => {
    const svc = new LifeOSSearchService();
    expect(svc.search('test')).toEqual([]);
  });
  it('indexItem and search roundtrips', () => {
    const svc = new LifeOSSearchService();
    svc.indexItem({
      id: '1',
      category: 'skill',
      title: 'TypeScript',
      description: 'Programming language',
      confidence: 0.9,
      source: 'learning',
      deepLink: '/learning/typescript',
      timestamp: new Date().toISOString(),
      tags: ['typescript', 'programming'],
    });
    const results = svc.search('typescript');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('TypeScript');
  });
  it('search finds by description and tags', () => {
    const svc = new LifeOSSearchService();
    svc.indexItem({
      id: '1',
      category: 'skill',
      title: 'Skill A',
      description: 'React framework',
      confidence: 0.8,
      source: 'learning',
      deepLink: '/a',
      timestamp: new Date().toISOString(),
      tags: ['react', 'frontend'],
    });
    const byDesc = svc.search('framework');
    expect(byDesc.length).toBe(1);
    const byTag = svc.search('frontend');
    expect(byTag.length).toBe(1);
  });
  it('search filters by category', () => {
    const svc = new LifeOSSearchService();
    svc.indexItem({
      id: '1',
      category: 'skill',
      title: 'TypeScript',
      description: 'Lang',
      confidence: 0.9,
      source: 'learning',
      deepLink: '/a',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    svc.indexItem({
      id: '2',
      category: 'goal',
      title: 'Revenue Target',
      description: 'Goal',
      confidence: 0.8,
      source: 'business',
      deepLink: '/b',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    const results = svc.search('', { categories: ['skill'] });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('1');
  });
  it('search filters by source', () => {
    const svc = new LifeOSSearchService();
    svc.indexItem({
      id: '1',
      category: 'skill',
      title: 'TS',
      description: '',
      confidence: 0.9,
      source: 'learning',
      deepLink: '/a',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    svc.indexItem({
      id: '2',
      category: 'goal',
      title: 'Rev',
      description: '',
      confidence: 0.8,
      source: 'business',
      deepLink: '/b',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    expect(svc.search('', { sources: ['learning'] }).length).toBe(1);
  });
  it('search sorts by confidence descending', () => {
    const svc = new LifeOSSearchService();
    svc.indexItem({
      id: '1',
      category: 'skill',
      title: 'Low',
      description: 'common',
      confidence: 0.5,
      source: 'learning',
      deepLink: '/a',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    svc.indexItem({
      id: '2',
      category: 'skill',
      title: 'High',
      description: 'common',
      confidence: 0.9,
      source: 'career',
      deepLink: '/b',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    expect(svc.search('common')[0].id).toBe('2');
  });
  it('search respects maxResults', () => {
    const svc = new LifeOSSearchService();
    svc.indexItem({
      id: '1',
      category: 'skill',
      title: 'A',
      description: 'test',
      confidence: 0.9,
      source: 'learning',
      deepLink: '/a',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    svc.indexItem({
      id: '2',
      category: 'skill',
      title: 'B',
      description: 'test',
      confidence: 0.8,
      source: 'learning',
      deepLink: '/b',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    expect(svc.search('test', { maxResults: 1 }).length).toBe(1);
  });
  it('indexItems indexes multiple', () => {
    const svc = new LifeOSSearchService();
    svc.indexItems([
      {
        id: '1',
        category: 'skill',
        title: 'A',
        description: '',
        confidence: 0.9,
        source: 'learning',
        deepLink: '/a',
        timestamp: new Date().toISOString(),
        tags: [],
      },
      {
        id: '2',
        category: 'skill',
        title: 'B',
        description: '',
        confidence: 0.8,
        source: 'career',
        deepLink: '/b',
        timestamp: new Date().toISOString(),
        tags: [],
      },
    ]);
    expect(svc.getIndexedCount()).toBe(2);
  });
  it('removeItem removes from index', () => {
    const svc = new LifeOSSearchService();
    svc.indexItem({
      id: '1',
      category: 'skill',
      title: 'Test',
      description: '',
      confidence: 0.9,
      source: 'learning',
      deepLink: '/a',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    svc.removeItem('1');
    expect(svc.getIndexedCount()).toBe(0);
  });
  it('getBySource and getByCategory filter', () => {
    const svc = new LifeOSSearchService();
    svc.indexItem({
      id: '1',
      category: 'skill',
      title: 'A',
      description: '',
      confidence: 0.9,
      source: 'learning',
      deepLink: '/a',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    expect(svc.getBySource('learning').length).toBe(1);
    expect(svc.getByCategory('skill').length).toBe(1);
  });
  it('indexItem updates existing item (update path)', () => {
    const svc = new LifeOSSearchService();
    const item = {
      id: '1',
      category: 'skill' as any,
      title: 'Original',
      description: '',
      confidence: 0.9,
      source: 'learning' as any,
      deepLink: '/a',
      timestamp: new Date().toISOString(),
      tags: [],
    };
    svc.indexItem(item);
    svc.indexItem({ ...item, title: 'Updated' });
    expect(svc.getIndexedCount()).toBe(1);
    expect(svc.search('Updated').length).toBe(1);
  });
  it('clear empties index', () => {
    const svc = new LifeOSSearchService();
    svc.indexItem({
      id: '1',
      category: 'skill',
      title: 'A',
      description: '',
      confidence: 0.9,
      source: 'learning',
      deepLink: '/a',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    svc.clear();
    expect(svc.getIndexedCount()).toBe(0);
  });
  it('search filters by minConfidence', () => {
    const svc = new LifeOSSearchService();
    svc.indexItem({
      id: '1',
      category: 'skill',
      title: 'Low',
      description: 'test',
      confidence: 0.3,
      source: 'learning',
      deepLink: '/a',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    svc.indexItem({
      id: '2',
      category: 'skill',
      title: 'High',
      description: 'test',
      confidence: 0.8,
      source: 'learning',
      deepLink: '/b',
      timestamp: new Date().toISOString(),
      tags: [],
    });
    expect(svc.search('test', { minConfidence: 0.5 }).length).toBe(1);
  });
});

describe('LifeOSTimelineService', () => {
  const makeEntry = (id: string, daysAgo: number, source: string = 'career') => ({
    id,
    type: 'milestone',
    title: `Event ${id}`,
    description: '',
    timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    importance: 5,
    icon: 'star',
    source: source as any,
    sourceRoute: '/test',
  });

  it('buildUnifiedTimeline sorts by date descending', () => {
    const svc = new LifeOSTimelineService();
    const result = svc.buildUnifiedTimeline([makeEntry('old', 10), makeEntry('new', 1)]);
    expect(result.entries[0].id).toBe('new');
  });
  it('buildUnifiedTimeline filters by today', () => {
    const svc = new LifeOSTimelineService();
    const result = svc.buildUnifiedTimeline([makeEntry('today', 0), makeEntry('old', 10)], 'today');
    expect(result.entries.length).toBe(1);
  });
  it('buildUnifiedTimeline filters by week', () => {
    const svc = new LifeOSTimelineService();
    const result = svc.buildUnifiedTimeline(
      [makeEntry('this-week', 3), makeEntry('old', 20)],
      'week',
    );
    expect(result.entries.length).toBe(1);
  });
  it('buildUnifiedTimeline filters by month', () => {
    const svc = new LifeOSTimelineService();
    const result = svc.buildUnifiedTimeline(
      [makeEntry('this-month', 15), makeEntry('old', 60)],
      'month',
    );
    expect(result.entries.length).toBe(1);
  });
  it('buildUnifiedTimeline returns all for all filter', () => {
    const svc = new LifeOSTimelineService();
    const result = svc.buildUnifiedTimeline([makeEntry('a', 10), makeEntry('b', 20)], 'all');
    expect(result.entries.length).toBe(2);
  });
  it('buildUnifiedTimeline sets hasMore when filtered', () => {
    const svc = new LifeOSTimelineService();
    const result = svc.buildUnifiedTimeline([makeEntry('today', 0), makeEntry('old', 10)], 'today');
    expect(result.hasMore).toBe(true);
  });
  it('mergeTimelines combines and sorts', () => {
    const svc = new LifeOSTimelineService();
    const result = svc.mergeTimelines([
      { entries: [makeEntry('a', 5)] },
      { entries: [makeEntry('b', 1)] },
    ]);
    expect(result.entries.length).toBe(2);
    expect(result.entries[0].id).toBe('b');
  });
  it('getRecentEntries filters by day range', () => {
    const svc = new LifeOSTimelineService();
    const entries = [makeEntry('recent', 3), makeEntry('old', 20)];
    expect(svc.getRecentEntries(entries, 7).length).toBe(1);
  });
  it('getEntriesBySource filters by source', () => {
    const svc = new LifeOSTimelineService();
    const entries = [makeEntry('a', 1, 'career'), makeEntry('b', 1, 'learning')];
    expect(svc.getEntriesBySource(entries, 'career').length).toBe(1);
  });
});

describe('LifeOSRecommendationService', () => {
  it('generateCrossDomainRecommendations returns base recommendations', () => {
    const svc = new LifeOSRecommendationService();
    const recs = svc.generateCrossDomainRecommendations({
      careerProgress: 0,
      learningProgress: 0,
      businessGoalsAtRisk: 0,
      hasCriticalRisks: false,
      marketplaceUpdates: 0,
      pendingDecisions: 0,
      hasBlockedProjects: false,
      skillGaps: 0,
    });
    expect(recs.length).toBe(1); // Weekly review always added
  });
  it('generates skill gap recommendation', () => {
    const svc = new LifeOSRecommendationService();
    const recs = svc.generateCrossDomainRecommendations({
      careerProgress: 0,
      learningProgress: 30,
      businessGoalsAtRisk: 0,
      hasCriticalRisks: false,
      marketplaceUpdates: 0,
      pendingDecisions: 0,
      hasBlockedProjects: false,
      skillGaps: 3,
    });
    expect(recs.some((r) => r.category === 'Career + Learning')).toBe(true);
  });
  it('generates learning + business recommendation', () => {
    const svc = new LifeOSRecommendationService();
    const recs = svc.generateCrossDomainRecommendations({
      careerProgress: 0,
      learningProgress: 80,
      businessGoalsAtRisk: 2,
      hasCriticalRisks: false,
      marketplaceUpdates: 0,
      pendingDecisions: 0,
      hasBlockedProjects: false,
      skillGaps: 0,
    });
    expect(recs.some((r) => r.category === 'Learning + Business')).toBe(true);
  });
  it('generates business + marketplace recommendation', () => {
    const svc = new LifeOSRecommendationService();
    const recs = svc.generateCrossDomainRecommendations({
      careerProgress: 0,
      learningProgress: 0,
      businessGoalsAtRisk: 1,
      hasCriticalRisks: false,
      marketplaceUpdates: 3,
      pendingDecisions: 0,
      hasBlockedProjects: false,
      skillGaps: 0,
    });
    expect(recs.some((r) => r.category === 'Business + Marketplace')).toBe(true);
  });
  it('generates career + projects recommendation', () => {
    const svc = new LifeOSRecommendationService();
    const recs = svc.generateCrossDomainRecommendations({
      careerProgress: 60,
      learningProgress: 0,
      businessGoalsAtRisk: 0,
      hasCriticalRisks: false,
      marketplaceUpdates: 0,
      pendingDecisions: 0,
      hasBlockedProjects: true,
      skillGaps: 0,
    });
    expect(recs.some((r) => r.category === 'Career + Projects')).toBe(true);
  });
  it('generates execution + memory recommendation for many decisions', () => {
    const svc = new LifeOSRecommendationService();
    const recs = svc.generateCrossDomainRecommendations({
      careerProgress: 0,
      learningProgress: 0,
      businessGoalsAtRisk: 0,
      hasCriticalRisks: false,
      marketplaceUpdates: 0,
      pendingDecisions: 4,
      hasBlockedProjects: false,
      skillGaps: 0,
    });
    expect(recs.some((r) => r.category === 'Execution + Memory')).toBe(true);
  });
  it('generates decision + dashboard for critical risks', () => {
    const svc = new LifeOSRecommendationService();
    const recs = svc.generateCrossDomainRecommendations({
      careerProgress: 0,
      learningProgress: 0,
      businessGoalsAtRisk: 0,
      hasCriticalRisks: true,
      marketplaceUpdates: 0,
      pendingDecisions: 0,
      hasBlockedProjects: false,
      skillGaps: 0,
    });
    expect(recs.some((r) => r.category === 'Decision + Dashboard')).toBe(true);
  });
  it('prioritizeRecommendations filters dismissed', () => {
    const svc = new LifeOSRecommendationService();
    const recs = svc.generateCrossDomainRecommendations({
      careerProgress: 60,
      learningProgress: 80,
      businessGoalsAtRisk: 0,
      hasCriticalRisks: false,
      marketplaceUpdates: 0,
      pendingDecisions: 0,
      hasBlockedProjects: false,
      skillGaps: 0,
    });
    const dismissed = svc.dismissRecommendation(recs, recs[0].id);
    const prioritized = svc.prioritizeRecommendations(dismissed, 10);
    expect(prioritized.length).toBe(recs.length - 1);
  });
  it('dismissRecommendation marks as dismissed', () => {
    const svc = new LifeOSRecommendationService();
    const recs = svc.generateCrossDomainRecommendations({
      careerProgress: 0,
      learningProgress: 0,
      businessGoalsAtRisk: 0,
      hasCriticalRisks: false,
      marketplaceUpdates: 0,
      pendingDecisions: 0,
      hasBlockedProjects: false,
      skillGaps: 0,
    });
    const dismissed = svc.dismissRecommendation(recs, recs[0].id);
    expect(dismissed[0].isDismissed).toBe(true);
  });
  it('prioritizeRecommendations returns empty when all dismissed', () => {
    const svc = new LifeOSRecommendationService();
    const recs = svc.generateCrossDomainRecommendations({
      careerProgress: 0,
      learningProgress: 0,
      businessGoalsAtRisk: 0,
      hasCriticalRisks: false,
      marketplaceUpdates: 0,
      pendingDecisions: 0,
      hasBlockedProjects: false,
      skillGaps: 0,
    });
    const allDismissed = recs.map((r) => ({ ...r, isDismissed: true }));
    const prioritized = svc.prioritizeRecommendations(allDismissed, 10);
    expect(prioritized.length).toBe(0);
  });
});

describe('LifeOSNotificationService', () => {
  it('aggregateNotifications returns empty with no sources', () => {
    const svc = new LifeOSNotificationService();
    expect(svc.aggregateNotifications([])).toEqual([]);
  });
  it('aggregateNotifications merges multiple sources', () => {
    const svc = new LifeOSNotificationService();
    const notifs = svc.aggregateNotifications([
      {
        module: 'dashboard',
        notifications: [
          {
            type: 'info',
            title: 'Dash Notif',
            message: 'msg',
            isRead: false,
            isActionable: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
      {
        module: 'career',
        notifications: [
          {
            type: 'warning',
            title: 'Career Notif',
            message: 'msg2',
            isRead: false,
            isActionable: true,
            actionLabel: 'View',
            actionRoute: '/career',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ]);
    expect(notifs.length).toBe(2);
    expect(notifs[0].source).toBe('career'); // warning has higher priority than info
  });
  it('getBySeverity filters correctly', () => {
    const svc = new LifeOSNotificationService();
    const notifs = svc.aggregateNotifications([
      {
        module: 'dashboard',
        notifications: [
          {
            type: 'info',
            title: 'Info',
            message: 'm',
            isRead: false,
            isActionable: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
      {
        module: 'career',
        notifications: [
          {
            type: 'warning',
            title: 'Warn',
            message: 'm',
            isRead: false,
            isActionable: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ]);
    expect(svc.getBySeverity(notifs, 'warning').length).toBe(1);
  });
  it('getBySource filters correctly', () => {
    const svc = new LifeOSNotificationService();
    const notifs = svc.aggregateNotifications([
      {
        module: 'dashboard',
        notifications: [
          {
            type: 'info',
            title: 'Dash',
            message: 'm',
            isRead: false,
            isActionable: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ]);
    expect(svc.getBySource(notifs, 'dashboard').length).toBe(1);
    expect(svc.getBySource(notifs, 'career').length).toBe(0);
  });
  it('getUnread and markAsRead work', () => {
    const svc = new LifeOSNotificationService();
    const notifs = svc.aggregateNotifications([
      {
        module: 'dashboard',
        notifications: [
          {
            type: 'info',
            title: 'Dash',
            message: 'm',
            isRead: false,
            isActionable: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ]);
    expect(svc.getUnread(notifs).length).toBe(1);
    const read = svc.markAsRead(notifs, notifs[0].id);
    expect(svc.getUnread(read).length).toBe(0);
    expect(svc.getUnreadCount(read)).toBe(0);
  });
  it('markAllAsRead marks all', () => {
    const svc = new LifeOSNotificationService();
    const notifs = svc.aggregateNotifications([
      {
        module: 'dashboard',
        notifications: [
          {
            type: 'info',
            title: 'A',
            message: 'm',
            isRead: false,
            isActionable: false,
            createdAt: new Date().toISOString(),
          },
          {
            type: 'info',
            title: 'B',
            message: 'm',
            isRead: false,
            isActionable: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ]);
    const allRead = svc.markAllAsRead(notifs);
    expect(allRead.every((n) => n.isRead)).toBe(true);
  });
  it('getUnreadCount returns 0 when all are read', () => {
    const svc = new LifeOSNotificationService();
    const notifs = svc.aggregateNotifications([
      {
        module: 'dashboard',
        notifications: [
          {
            type: 'info',
            title: 'A',
            message: 'm',
            isRead: true,
            isActionable: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ]);
    expect(svc.getUnreadCount(notifs)).toBe(0);
  });

  // ── Edge case branches ───────────────────────────────────────────
  it('aggregateNotifications sort uses date when priorities are equal', () => {
    const svc = new LifeOSNotificationService();
    const earlier = new Date(Date.now() - 60_000).toISOString();
    const later = new Date().toISOString();
    const notifs = svc.aggregateNotifications([
      {
        module: 'dashboard',
        notifications: [
          {
            type: 'info',
            title: 'Later',
            message: 'm',
            isRead: false,
            isActionable: false,
            createdAt: later,
          },
          {
            type: 'info',
            title: 'Earlier',
            message: 'm',
            isRead: false,
            isActionable: false,
            createdAt: earlier,
          },
        ],
      },
    ]);
    expect(notifs.length).toBe(2);
    // Both have same priority (info=1), so sorted by date descending
    expect(notifs[0].title).toBe('Later');
  });

  it('getBySeverity returns empty for unmatched type', () => {
    const svc = new LifeOSNotificationService();
    const notifs = svc.aggregateNotifications([
      {
        module: 'dashboard',
        notifications: [
          {
            type: 'info',
            title: 'Info',
            message: 'm',
            isRead: false,
            isActionable: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ]);
    expect(svc.getBySeverity(notifs, 'error').length).toBe(0);
  });
});

describe('LifeOSQuickActionService', () => {
  const makeQA = (id: string, priority: number, category: string = 'general'): QuickActionDTO => ({
    id,
    label: `Action ${id}`,
    description: 'desc',
    icon: 'icon',
    route: '/test',
    priority,
    category,
    isAvailable: true,
  });

  it('aggregateQuickActions combines and sorts', () => {
    const svc = new LifeOSQuickActionService();
    const actions = svc.aggregateQuickActions([
      { module: 'dashboard', actions: [makeQA('d1', 2)] },
      { module: 'career', actions: [makeQA('c1', 1)] },
    ]);
    expect(actions.length).toBe(2);
    expect(actions[0].priority).toBe(1);
  });
  it('aggregateQuickActions prefixes module id', () => {
    const svc = new LifeOSQuickActionService();
    const actions = svc.aggregateQuickActions([
      { module: 'dashboard', actions: [makeQA('d1', 1)] },
    ]);
    expect(actions[0].id).toBe('lqa_dashboard_d1');
  });
  it('getByCategory filters correctly', () => {
    const svc = new LifeOSQuickActionService();
    const actions = [makeQA('a', 1, 'goal'), makeQA('b', 2, 'kpi')];
    expect(svc.getByCategory(actions, 'goal').length).toBe(1);
  });
  it('getTopActions returns top N', () => {
    const svc = new LifeOSQuickActionService();
    const actions = [makeQA('a', 3), makeQA('b', 2), makeQA('c', 1)];
    // Aggregate first to sort by priority
    const agg = svc.aggregateQuickActions([{ module: 'dashboard', actions }]);
    const top = svc.getTopActions(agg, 2);
    expect(top.length).toBe(2);
    expect(top[0].priority).toBe(1);
  });
});

describe('LifeOSInsightService', () => {
  it('generateCrossDomainInsights returns fallback for no activity', () => {
    const svc = new LifeOSInsightService();
    const insights = svc.generateCrossDomainInsights({
      totalNotifications: 0,
      unreadCount: 0,
      pendingDecisions: 0,
      activePlans: 0,
      completedToday: 0,
      hasCriticalRisks: false,
      careerProgress: 0,
      learningProgress: 0,
      businessHealth: 100,
      marketplaceUpdates: 0,
    });
    expect(insights).toContain('All modules operating normally.');
  });
  it('generates completed tasks insight', () => {
    const svc = new LifeOSInsightService();
    const insights = svc.generateCrossDomainInsights({
      totalNotifications: 0,
      unreadCount: 0,
      pendingDecisions: 0,
      activePlans: 0,
      completedToday: 3,
      hasCriticalRisks: false,
      careerProgress: 0,
      learningProgress: 0,
      businessHealth: 100,
      marketplaceUpdates: 0,
    });
    expect(insights.some((i) => i.includes('Completed 3 tasks'))).toBe(true);
  });
  it('generates unread notification insight', () => {
    const svc = new LifeOSInsightService();
    const insights = svc.generateCrossDomainInsights({
      totalNotifications: 0,
      unreadCount: 6,
      pendingDecisions: 0,
      activePlans: 0,
      completedToday: 0,
      hasCriticalRisks: false,
      careerProgress: 0,
      learningProgress: 0,
      businessHealth: 100,
      marketplaceUpdates: 0,
    });
    expect(insights.some((i) => i.includes('unread'))).toBe(true);
  });
  it('generates pending decision insight', () => {
    const svc = new LifeOSInsightService();
    const insights = svc.generateCrossDomainInsights({
      totalNotifications: 0,
      unreadCount: 0,
      pendingDecisions: 4,
      activePlans: 0,
      completedToday: 0,
      hasCriticalRisks: false,
      careerProgress: 0,
      learningProgress: 0,
      businessHealth: 100,
      marketplaceUpdates: 0,
    });
    expect(insights.some((i) => i.includes('decisions pending'))).toBe(true);
  });
  it('generates critical risk insight', () => {
    const svc = new LifeOSInsightService();
    const insights = svc.generateCrossDomainInsights({
      totalNotifications: 0,
      unreadCount: 0,
      pendingDecisions: 0,
      activePlans: 0,
      completedToday: 0,
      hasCriticalRisks: true,
      careerProgress: 0,
      learningProgress: 0,
      businessHealth: 100,
      marketplaceUpdates: 0,
    });
    expect(insights.some((i) => i.includes('Critical risks'))).toBe(true);
  });
  it('generates career+learning alignment insight', () => {
    const svc = new LifeOSInsightService();
    const insights = svc.generateCrossDomainInsights({
      totalNotifications: 0,
      unreadCount: 0,
      pendingDecisions: 0,
      activePlans: 0,
      completedToday: 0,
      hasCriticalRisks: false,
      careerProgress: 80,
      learningProgress: 80,
      businessHealth: 100,
      marketplaceUpdates: 0,
    });
    expect(insights.some((i) => i.includes('career and learning'))).toBe(true);
  });
  it('generates business health insight', () => {
    const svc = new LifeOSInsightService();
    const insights = svc.generateCrossDomainInsights({
      totalNotifications: 0,
      unreadCount: 0,
      pendingDecisions: 0,
      activePlans: 0,
      completedToday: 0,
      hasCriticalRisks: false,
      careerProgress: 0,
      learningProgress: 0,
      businessHealth: 30,
      marketplaceUpdates: 0,
    });
    expect(insights.some((i) => i.includes('Business health'))).toBe(true);
  });
  it('generates marketplace update insight', () => {
    const svc = new LifeOSInsightService();
    const insights = svc.generateCrossDomainInsights({
      totalNotifications: 0,
      unreadCount: 0,
      pendingDecisions: 0,
      activePlans: 0,
      completedToday: 0,
      hasCriticalRisks: false,
      careerProgress: 0,
      learningProgress: 0,
      businessHealth: 100,
      marketplaceUpdates: 2,
    });
    expect(insights.some((i) => i.includes('marketplace updates'))).toBe(true);
  });
  it('buildAIContext returns complete context', () => {
    const svc = new LifeOSInsightService();
    const ctx = svc.buildAIContext({
      displayName: 'Test User',
      currentFocus: 'Career growth',
      recentActivity: ['Completed 3 tasks'],
      crossDomainInsights: ['Doing well'],
      topPriorities: ['Finish project'],
    });
    expect(ctx.currentFocus).toBe('Career growth');
    expect(ctx.topPriorities).toContain('Finish project');
    expect(ctx.suggestedQuestions.length).toBe(4);
  });

  // ── Performance Benchmarks ───────────────────────────────────────

  describe('LifeOSSearchService — Performance', () => {
    it('performance: search with 100 items completes under 1000ms', () => {
      const svc = new LifeOSSearchService();
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        category: 'skill' as const,
        title: `Skill ${i}`,
        description: `Description for skill ${i}`,
        confidence: Math.random(),
        source: 'learning' as const,
        deepLink: `/skill/${i}`,
        timestamp: new Date().toISOString(),
        tags: [`tag${i}`, 'common'],
      }));
      svc.indexItems(items);
      const start = performance.now();
      svc.search('skill');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('LifeOSTimelineService — Performance', () => {
    it('performance: merge 200 timeline entries completes under 500ms', () => {
      const svc = new LifeOSTimelineService();
      const makeEntry = (id: string, daysAgo: number, source: string = 'career') => ({
        id,
        type: 'milestone',
        title: `Event ${id}`,
        description: '',
        timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        importance: 5,
        icon: 'star',
        source: source as any,
        sourceRoute: '/test',
      });
      const entries = Array.from({ length: 200 }, (_, i) => makeEntry(`e${i}`, i % 30));
      const start = performance.now();
      svc.mergeTimelines([{ entries }]);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});
