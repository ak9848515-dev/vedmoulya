import { describe, it, expect } from 'vitest';
import { CareerTimelineService } from '../CareerTimelineService.js';

describe('CareerTimelineService', () => {
  it('builds timeline from experiences', () => {
    const svc = new CareerTimelineService();
    const entries = svc.buildTimeline([
      {
        id: 'exp1',
        title: 'Software Engineer',
        description: 'Built great things',
        startDate: '2025-01-01T00:00:00Z',
        endDate: undefined,
      },
      {
        id: 'exp2',
        title: 'Junior Developer',
        description: 'Learned a lot',
        startDate: '2023-01-01T00:00:00Z',
      },
    ]);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.title).toBe('Software Engineer');
    expect(entries[0]!.type).toBe('experience');
    expect(entries[0]!.icon).toBe('briefcase');
    expect(entries[0]!.importance).toBe(8);
  });

  it('handles empty experiences', () => {
    expect(new CareerTimelineService().buildTimeline([])).toHaveLength(0);
  });

  it('sorts by date descending', () => {
    const svc = new CareerTimelineService();
    const entries = svc.buildTimeline([
      { id: 'old', title: 'Old', description: '', startDate: '2020-01-01T00:00:00Z' },
      { id: 'new', title: 'New', description: '', startDate: '2025-01-01T00:00:00Z' },
    ]);
    expect(entries[0]!.id).toBe('ct_exp_new');
    expect(entries[1]!.id).toBe('ct_exp_old');
  });

  it('truncates description to 200 chars', () => {
    const svc = new CareerTimelineService();
    const longDesc = 'x'.repeat(300);
    const entries = svc.buildTimeline([
      { id: 'e1', title: 'T', description: longDesc, startDate: '2025-01-01T00:00:00Z' },
    ]);
    expect(entries[0]!.description.length).toBe(200);
  });

  it('getRecentEntries filters by days', () => {
    const svc = new CareerTimelineService();
    const entries = svc.buildTimeline([
      { id: 'recent', title: 'Recent', description: '', startDate: new Date().toISOString() },
      { id: 'old', title: 'Old', description: '', startDate: '2020-01-01T00:00:00Z' },
    ]);
    const recent = svc.getRecentEntries(entries, 30);
    expect(recent).toHaveLength(1);
    expect(recent[0]!.id).toBe('ct_exp_recent');
  });

  it('getEntryCounts returns counts by type', () => {
    const svc = new CareerTimelineService();
    const entries = svc.buildTimeline([
      { id: 'e1', title: 'T1', description: '', startDate: '2025-01-01T00:00:00Z' },
      { id: 'e2', title: 'T2', description: '', startDate: '2024-01-01T00:00:00Z' },
    ]);
    const counts = svc.getEntryCounts(entries);
    expect(counts.experience).toBe(2);
  });
});
