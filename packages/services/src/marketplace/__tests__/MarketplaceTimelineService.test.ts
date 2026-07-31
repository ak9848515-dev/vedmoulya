// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Timeline Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceTimelineService } from '../MarketplaceTimelineService.js';

describe('MarketplaceTimelineService', () => {
  it('buildTimeline returns entries sorted by timestamp descending', () => {
    const svc = new MarketplaceTimelineService();
    const entries = [
      {
        id: '1',
        type: 'installation' as const,
        title: 'Old',
        description: 'Old event',
        timestamp: '2024-01-01T00:00:00Z',
        importance: 5,
        icon: 'icon1',
      },
      {
        id: '2',
        type: 'activation' as const,
        title: 'New',
        description: 'New event',
        timestamp: '2024-06-01T00:00:00Z',
        importance: 8,
        icon: 'icon2',
      },
    ];
    const sorted = svc.buildTimeline(entries);
    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('1');
  });

  it('buildTimeline handles empty array', () => {
    const svc = new MarketplaceTimelineService();
    expect(svc.buildTimeline([])).toEqual([]);
  });

  it('getRecentEntries filters by day range', () => {
    const svc = new MarketplaceTimelineService();
    const entries = [
      {
        id: '1',
        type: 'installation' as const,
        title: 'Recent',
        description: '',
        timestamp: new Date().toISOString(),
        importance: 5,
        icon: 'icon',
      },
      {
        id: '2',
        type: 'activation' as const,
        title: 'Old',
        description: '',
        timestamp: '2024-01-01T00:00:00Z',
        importance: 3,
        icon: 'icon',
      },
    ];
    const recent = svc.getRecentEntries(entries, 30);
    expect(recent.length).toBe(1);
    expect(recent[0].id).toBe('1');
  });

  it('getRecentEntries returns all within default 7 days', () => {
    const svc = new MarketplaceTimelineService();
    const entries = [
      {
        id: '1',
        type: 'installation' as const,
        title: 'Today',
        description: '',
        timestamp: new Date().toISOString(),
        importance: 5,
        icon: 'icon',
      },
    ];
    const recent = svc.getRecentEntries(entries);
    expect(recent.length).toBe(1);
  });
});
