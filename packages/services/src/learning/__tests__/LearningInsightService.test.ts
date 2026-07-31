import { describe, it, expect } from 'vitest';
import { LearningInsightService } from '../LearningInsightService.js';
import type { RevisionScheduleDTO, LearningStreakDTO, LearningMetricsDTO } from '../LearningDTO.js';

function makeRevision(overrides: Partial<RevisionScheduleDTO> = {}): RevisionScheduleDTO {
  return { dueToday: [], dueThisWeek: [], upcoming: [], totalForReview: 0, ...overrides };
}

function makeStreak(overrides: Partial<LearningStreakDTO> = {}): LearningStreakDTO {
  return {
    current: 0,
    longest: 0,
    weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
    monthlyActiveDays: 0,
    lastActiveDate: '',
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<LearningMetricsDTO> = {}): LearningMetricsDTO {
  return {
    learningScore: 50,
    knowledgeRetention: 80,
    weeklyProgress: 50,
    monthlyProgress: 50,
    streak: 0,
    hoursLearnedThisWeek: 0,
    hoursLearnedThisMonth: 0,
    topicsCompleted: 0,
    assessmentsPassed: 0,
    projectsCompleted: 0,
    consistencyScore: 50,
    breadthScore: 50,
    depthScore: 50,
    overallProgress: 50,
    ...overrides,
  };
}

describe('LearningInsightService', () => {
  it('generates revision warning when 3+ due today', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision({
        dueToday: [
          {
            id: '1',
            topic: 'a',
            title: 'a',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
          {
            id: '2',
            topic: 'b',
            title: 'b',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
          {
            id: '3',
            topic: 'c',
            title: 'c',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
        ],
      }),
      streak: makeStreak(),
      metrics: makeMetrics(),
      topicsCompleted: 0,
      assessmentsPassed: 0,
    });
    expect(insights.some((i) => i.type === 'warning' && i.title.includes('Revision'))).toBe(true);
  });

  it('generates streak achievement when 7+ days', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision(),
      streak: makeStreak({ current: 7 }),
      metrics: makeMetrics(),
      topicsCompleted: 0,
      assessmentsPassed: 0,
    });
    expect(insights.some((i) => i.type === 'achievement' && i.title.includes('Streak'))).toBe(true);
  });

  it('generates weekly progress achievement when > 80%', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision(),
      streak: makeStreak(),
      metrics: makeMetrics({ weeklyProgress: 90 }),
      topicsCompleted: 0,
      assessmentsPassed: 0,
    });
    expect(insights.some((i) => i.type === 'achievement' && i.title.includes('Weekly'))).toBe(true);
  });

  it('generates low progress warning when < 20% and topics exist', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision(),
      streak: makeStreak(),
      metrics: makeMetrics({ weeklyProgress: 10 }),
      topicsCompleted: 5,
      assessmentsPassed: 0,
    });
    expect(insights.some((i) => i.type === 'warning' && i.title.includes('Lagging'))).toBe(true);
  });

  it('generates assessment milestone when 3+ passed', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision(),
      streak: makeStreak(),
      metrics: makeMetrics(),
      topicsCompleted: 0,
      assessmentsPassed: 3,
    });
    expect(insights.some((i) => i.type === 'achievement' && i.title.includes('Assessment'))).toBe(
      true,
    );
  });

  it('generates topics milestone when 10+ completed', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision(),
      streak: makeStreak(),
      metrics: makeMetrics(),
      topicsCompleted: 10,
      assessmentsPassed: 0,
    });
    expect(insights.some((i) => i.type === 'achievement' && i.title.includes('Topics'))).toBe(true);
  });

  it('sorts insights by severity', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision({
        dueToday: [
          {
            id: '1',
            topic: 'a',
            title: 'a',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
          {
            id: '2',
            topic: 'b',
            title: 'b',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
          {
            id: '3',
            topic: 'c',
            title: 'c',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
        ],
      }),
      streak: makeStreak({ current: 7 }),
      metrics: makeMetrics({ weeklyProgress: 10 }),
      topicsCompleted: 5,
      assessmentsPassed: 3,
    });
    const order = ['critical', 'warning', 'positive', 'info'];
    const sorted = insights
      .slice()
      .sort((a, b) => order.indexOf(a.severity) + 1 - (order.indexOf(b.severity) + 1));
    expect(insights).toEqual(sorted);
  });

  it('getActionableInsights filters actionable', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision({
        dueToday: [
          {
            id: '1',
            topic: 'a',
            title: 'a',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
          {
            id: '2',
            topic: 'b',
            title: 'b',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
          {
            id: '3',
            topic: 'c',
            title: 'c',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
        ],
      }),
      streak: makeStreak({ current: 7 }),
      metrics: makeMetrics({ weeklyProgress: 10 }),
      topicsCompleted: 5,
      assessmentsPassed: 3,
    });
    const actionable = svc.getActionableInsights(insights);
    expect(actionable.every((i) => i.actionable)).toBe(true);
  });

  it('does not generate low progress warning when no topics completed', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision(),
      streak: makeStreak(),
      metrics: makeMetrics({ weeklyProgress: 10 }),
      topicsCompleted: 0,
      assessmentsPassed: 0,
    });
    expect(insights.some((i) => i.title.includes('Lagging'))).toBe(false);
  });

  it('does not generate low progress warning when weeklyProgress >= 20', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision(),
      streak: makeStreak(),
      metrics: makeMetrics({ weeklyProgress: 50 }),
      topicsCompleted: 5,
      assessmentsPassed: 0,
    });
    expect(insights.some((i) => i.title.includes('Lagging'))).toBe(false);
  });

  it('generates no insights when nothing triggers', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision({ dueToday: [] }),
      streak: makeStreak({ current: 0 }),
      metrics: makeMetrics({ weeklyProgress: 50 }),
      topicsCompleted: 1,
      assessmentsPassed: 1,
    });
    expect(insights.length).toBe(0);
  });

  it('generates multiple insights when all conditions met', () => {
    const svc = new LearningInsightService();
    const insights = svc.generateInsights({
      revision: makeRevision({
        dueToday: [
          {
            id: '1',
            topic: 'a',
            title: 'a',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
          {
            id: '2',
            topic: 'b',
            title: 'b',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
          {
            id: '3',
            topic: 'c',
            title: 'c',
            dueDate: '',
            importance: 1,
            estimatedMinutes: 10,
            status: 'pending',
            confidence: 50,
          } as any,
        ],
      }),
      streak: makeStreak({ current: 7 }),
      metrics: makeMetrics({ weeklyProgress: 90 }),
      topicsCompleted: 10,
      assessmentsPassed: 3,
    });
    expect(insights.length).toBeGreaterThanOrEqual(4);
  });
});
