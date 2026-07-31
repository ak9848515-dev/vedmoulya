import { describe, it, expect } from 'vitest';
import { LearningDTOMapper } from '../LearningDTOMapper.js';
import type {
  LearningPathDTO,
  LearningProjectDTO,
  AssessmentDTO,
  LearningTimelineEntryDTO,
} from '../LearningDTO.js';

describe('LearningDTOMapper', () => {
  const mapper = new LearningDTOMapper();

  it('toPathDTO returns the path', () => {
    const path = { id: 'p1' } as LearningPathDTO;
    expect(mapper.toPathDTO(path)).toBe(path);
  });

  it('toProjectDTO returns the project', () => {
    const proj = { id: 'proj1' } as LearningProjectDTO;
    expect(mapper.toProjectDTO(proj)).toBe(proj);
  });

  it('toAssessmentDTO returns the assessment', () => {
    const a = { id: 'a1' } as AssessmentDTO;
    expect(mapper.toAssessmentDTO(a)).toBe(a);
  });

  it('toTimeline builds timeline DTO', () => {
    const entries: LearningTimelineEntryDTO[] = [
      {
        id: '1',
        type: 'topic',
        title: 'T1',
        description: '',
        timestamp: '2024-01-01',
        importance: 1,
        icon: 'book',
      },
    ];
    const t = mapper.toTimeline(entries);
    expect(t.entries.length).toBe(1);
    expect(t.totalEntries).toBe(1);
    expect(t.hasMore).toBe(false);
  });

  it('toTimeline sets hasMore at 20 entries', () => {
    const entries: LearningTimelineEntryDTO[] = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      type: 'topic' as const,
      title: `T${i}`,
      description: '',
      timestamp: '2024-01-01',
      importance: 1,
      icon: 'book',
    }));
    const t = mapper.toTimeline(entries);
    expect(t.hasMore).toBe(true);
  });

  it('createQuickAction builds quick action', () => {
    const qa = mapper.createQuickAction('qa1', 'Test', 'Desc', 'icon', '/test', 1, 'general');
    expect(qa.id).toBe('qa1');
    expect(qa.isAvailable).toBe(true);
    expect(qa.category).toBe('general');
  });

  it('createQuickAction with disabled state', () => {
    const qa = mapper.createQuickAction(
      'qa2',
      'Test',
      'Desc',
      'icon',
      '/test',
      2,
      'general',
      false,
      'Not ready',
    );
    expect(qa.isAvailable).toBe(false);
    expect(qa.disabledReason).toBe('Not ready');
  });

  it('createHealthIndicator returns healthy', () => {
    const h = mapper.createHealthIndicator([{ name: 'cache', status: 'healthy', latency: 5 }]);
    expect(h.overall).toBe('healthy');
    expect(h.warnings.length).toBe(0);
  });

  it('createHealthIndicator returns critical when down', () => {
    const h = mapper.createHealthIndicator([{ name: 'cache', status: 'down', latency: 0 }]);
    expect(h.overall).toBe('critical');
    expect(h.warnings).toContain('cache is down');
  });

  it('createHealthIndicator returns degraded', () => {
    const h = mapper.createHealthIndicator([{ name: 'cache', status: 'degraded', latency: 200 }]);
    expect(h.overall).toBe('degraded');
    expect(h.warnings).toContain('cache is degraded (200ms)');
  });

  it('aggregateMetrics builds metrics DTO', () => {
    const m = mapper.aggregateMetrics({
      learningScore: 61,
      knowledgeRetention: 80,
      weeklyProgress: 60,
      monthlyProgress: 50,
      streak: 5,
      hoursLearnedThisWeek: 10,
      hoursLearnedThisMonth: 40,
      topicsCompleted: 10,
      assessmentsPassed: 3,
      projectsCompleted: 2,
      consistencyScore: 50,
      breadthScore: 40,
      depthScore: 30,
    });
    expect(m.learningScore).toBe(61);
    expect(m.overallProgress).toBe(Math.round((61 + 80 + 60) / 3));
  });
});
