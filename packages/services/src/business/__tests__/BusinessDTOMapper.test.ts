import { describe, it, expect } from 'vitest';
import { BusinessDTOMapper } from '../BusinessDTOMapper.js';
import type { BusinessTimelineEntryDTO } from '../BusinessDTO.js';

describe('BusinessDTOMapper', () => {
  let mapper: BusinessDTOMapper;
  beforeEach(() => {
    mapper = new BusinessDTOMapper();
  });

  it('toTimeline returns correct structure', () => {
    const entries: BusinessTimelineEntryDTO[] = [
      {
        id: '1',
        type: 'project',
        title: 'Test',
        description: 'desc',
        timestamp: new Date().toISOString(),
        importance: 5,
        icon: 'circle',
      },
    ];
    const timeline = mapper.toTimeline(entries);
    expect(timeline.entries).toEqual(entries);
    expect(timeline.totalEntries).toBe(1);
    expect(timeline.hasMore).toBe(false);
  });

  it('toTimeline hasMore when >= 20 entries', () => {
    const entries: BusinessTimelineEntryDTO[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      type: 'project' as const,
      title: `e${i}`,
      description: 'desc',
      timestamp: new Date().toISOString(),
      importance: 5,
      icon: 'circle',
    }));
    expect(mapper.toTimeline(entries).hasMore).toBe(true);
  });

  it('toTimeline handles empty entries', () => {
    const t = mapper.toTimeline([]);
    expect(t.entries).toEqual([]);
    expect(t.totalEntries).toBe(0);
  });

  it('toTimeline hasMore false for 19 entries', () => {
    const entries: BusinessTimelineEntryDTO[] = Array.from({ length: 19 }, (_, i) => ({
      id: String(i),
      type: 'project' as const,
      title: `e${i}`,
      description: 'desc',
      timestamp: new Date().toISOString(),
      importance: 5,
      icon: 'circle',
    }));
    expect(mapper.toTimeline(entries).hasMore).toBe(false);
  });

  it('createQuickAction with defaults', () => {
    const qa = mapper.createQuickAction('id1', 'Label', 'Desc', 'icon', '/route', 1, 'cat');
    expect(qa.id).toBe('id1');
    expect(qa.isAvailable).toBe(true);
    expect(qa.disabledReason).toBeUndefined();
  });

  it('createQuickAction with disabled reason', () => {
    const qa = mapper.createQuickAction(
      'id1',
      'Label',
      'Desc',
      'icon',
      '/route',
      1,
      'cat',
      false,
      'Not available',
    );
    expect(qa.isAvailable).toBe(false);
    expect(qa.disabledReason).toBe('Not available');
  });

  it('createHealthIndicator returns healthy when all healthy', () => {
    const h = mapper.createHealthIndicator([
      { name: 'svc1', status: 'healthy', latency: 10 },
      { name: 'svc2', status: 'healthy', latency: 20 },
    ]);
    expect(h.overall).toBe('healthy');
    expect(h.warnings).toEqual([]);
  });

  it('createHealthIndicator returns critical when any down', () => {
    const h = mapper.createHealthIndicator([
      { name: 'svc1', status: 'healthy', latency: 10 },
      { name: 'svc2', status: 'down', latency: 0 },
    ]);
    expect(h.overall).toBe('critical');
    expect(h.warnings).toContain('svc2 is down');
  });

  it('createHealthIndicator returns degraded when degraded', () => {
    const h = mapper.createHealthIndicator([{ name: 'svc1', status: 'degraded', latency: 500 }]);
    expect(h.overall).toBe('degraded');
    expect(h.warnings).toContain('svc1 is degraded (500ms)');
  });

  it('createHealthIndicator stays critical even with degraded after down', () => {
    const h = mapper.createHealthIndicator([
      { name: 'svc1', status: 'down', latency: 0 },
      { name: 'svc2', status: 'degraded', latency: 200 },
    ]);
    expect(h.overall).toBe('critical');
  });

  it('createHealthIndicator empty services', () => {
    const h = mapper.createHealthIndicator([]);
    expect(h.overall).toBe('healthy');
    expect(h.services).toEqual([]);
  });

  it('aggregateMetrics computes overallProgress', () => {
    const m = mapper.aggregateMetrics({
      businessScore: 500,
      revenueHealth: 80,
      expenseEfficiency: 70,
      profitability: 60,
      growthRate: 50,
      projectSuccessRate: 90,
      kpiAchievementRate: 85,
      riskExposure: 20,
      opportunityValue: 75,
      executionVelocity: 65,
      goalProgress: 70,
    });
    expect(m.businessScore).toBe(500);
    expect(m.revenueHealth).toBe(80);
    expect(m.overallProgress).toBe(Math.round((500 + 80 + 60) / 3));
  });
});
