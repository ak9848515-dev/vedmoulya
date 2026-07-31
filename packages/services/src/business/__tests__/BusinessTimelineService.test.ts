import { describe, it, expect } from 'vitest';
import { BusinessTimelineService } from '../BusinessTimelineService.js';
import type { BusinessTimelineEntryDTO } from '../BusinessDTO.js';

describe('BusinessTimelineService', () => {
  let svc: BusinessTimelineService;
  beforeEach(() => {
    svc = new BusinessTimelineService();
  });

  const makeEntry = (
    id: string,
    daysAgo: number,
    type: BusinessTimelineEntryDTO['type'] = 'project',
  ): {
    id: string;
    type: BusinessTimelineEntryDTO['type'];
    title: string;
    description: string;
    timestamp: string;
    importance: number;
    icon: string;
  } => ({
    id,
    type,
    title: `Entry ${id}`,
    description: 'desc',
    timestamp: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    importance: 5,
    icon: 'circle',
  });

  it('buildTimeline sorts entries chronologically descending', () => {
    const entries = [makeEntry('a', 10), makeEntry('b', 0), makeEntry('c', 5)];
    const timeline = svc.buildTimeline(entries);
    expect(timeline[0].id).toBe('b');
    expect(timeline[1].id).toBe('c');
    expect(timeline[2].id).toBe('a');
  });

  it('buildTimeline returns empty for empty input', () => {
    expect(svc.buildTimeline([])).toEqual([]);
  });

  it('getRecentEntries filters by default 7 days', () => {
    const entries = svc.buildTimeline([makeEntry('old', 14), makeEntry('new', 1)]);
    const recent = svc.getRecentEntries(entries);
    expect(recent.length).toBe(1);
    expect(recent[0].id).toBe('new');
  });

  it('getRecentEntries respects custom days parameter', () => {
    const entries = svc.buildTimeline([
      makeEntry('old', 10),
      makeEntry('mid', 5),
      makeEntry('new', 1),
    ]);
    expect(svc.getRecentEntries(entries, 7).length).toBe(2);
    expect(svc.getRecentEntries(entries, 3).length).toBe(1);
  });

  it('getRecentEntries returns all entries when days is large', () => {
    const entries = svc.buildTimeline([makeEntry('a', 365), makeEntry('b', 30)]);
    expect(svc.getRecentEntries(entries, 366).length).toBe(2);
  });
});
