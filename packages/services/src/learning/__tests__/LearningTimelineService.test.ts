import { describe, it, expect } from 'vitest';
import { LearningTimelineService } from '../LearningTimelineService.js';

describe('LearningTimelineService', () => {
  it('buildTimeline sorts entries chronologically descending', () => {
    const svc = new LearningTimelineService();
    const entries = [
      {
        id: '1',
        type: 'topic' as const,
        title: 'Old',
        description: '',
        timestamp: '2024-01-01',
        importance: 1,
        icon: 'book',
      },
      {
        id: '2',
        type: 'topic' as const,
        title: 'New',
        description: '',
        timestamp: '2024-06-01',
        importance: 1,
        icon: 'book',
      },
    ];
    const sorted = svc.buildTimeline(entries);
    expect(sorted[0].title).toBe('New');
    expect(sorted[1].title).toBe('Old');
  });

  it('buildTimeline returns empty for empty input', () => {
    const svc = new LearningTimelineService();
    expect(svc.buildTimeline([])).toEqual([]);
  });

  it('getRecentEntries filters by day range', () => {
    const svc = new LearningTimelineService();
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const entries = [
      {
        id: '1',
        type: 'topic' as const,
        title: 'Recent',
        description: '',
        timestamp: now,
        importance: 1,
        icon: 'book',
      },
      {
        id: '2',
        type: 'topic' as const,
        title: 'Old',
        description: '',
        timestamp: old,
        importance: 1,
        icon: 'book',
      },
    ];
    const recent = svc.getRecentEntries(entries, 14);
    expect(recent.length).toBe(1);
    expect(recent[0].title).toBe('Recent');
  });

  it('getRecentEntries uses 7-day default', () => {
    const svc = new LearningTimelineService();
    const entries = [
      {
        id: '1',
        type: 'topic' as const,
        title: 'Recent',
        description: '',
        timestamp: new Date().toISOString(),
        importance: 1,
        icon: 'book',
      },
    ];
    const recent = svc.getRecentEntries(entries);
    expect(recent.length).toBe(1);
  });
});
