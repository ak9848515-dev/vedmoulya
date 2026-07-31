import { describe, it, expect } from 'vitest';
import { LearningRecommendationService } from '../LearningRecommendationService.js';
import type { RevisionScheduleDTO, LearningStreakDTO } from '../LearningDTO.js';

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

describe('LearningRecommendationService', () => {
  it('generates revision recommendation when items due', () => {
    const svc = new LearningRecommendationService();
    const recs = svc.generateRecommendations({
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
        ],
      }),
      streak: makeStreak(),
      topicsCompleted: 0,
      assessmentsPassed: 0,
      hasActivePaths: true,
    });
    expect(recs.some((r) => r.category === 'revision')).toBe(true);
  });

  it('generates path recommendation when no active paths', () => {
    const svc = new LearningRecommendationService();
    const recs = svc.generateRecommendations({
      revision: makeRevision(),
      streak: makeStreak(),
      topicsCompleted: 0,
      assessmentsPassed: 0,
      hasActivePaths: false,
    });
    expect(recs.some((r) => r.category === 'path')).toBe(true);
  });

  it('generates assessment recommendation when conditions met', () => {
    const svc = new LearningRecommendationService();
    const recs = svc.generateRecommendations({
      revision: makeRevision(),
      streak: makeStreak(),
      topicsCompleted: 5,
      assessmentsPassed: 1,
      hasActivePaths: true,
    });
    expect(recs.some((r) => r.category === 'assessment')).toBe(true);
  });

  it('always generates topic and resource recommendations', () => {
    const svc = new LearningRecommendationService();
    const recs = svc.generateRecommendations({
      revision: makeRevision(),
      streak: makeStreak(),
      topicsCompleted: 0,
      assessmentsPassed: 0,
      hasActivePaths: true,
    });
    expect(recs.length).toBe(2); // topic + resource
    expect(recs.some((r) => r.category === 'topic')).toBe(true);
    expect(recs.some((r) => r.category === 'resource')).toBe(true);
  });

  it('prioritizeRecommendations filters dismissed and sorts by priority', () => {
    const svc = new LearningRecommendationService();
    const recs = svc.generateRecommendations({
      revision: makeRevision(),
      streak: makeStreak(),
      topicsCompleted: 0,
      assessmentsPassed: 0,
      hasActivePaths: true,
    });
    recs[0].isDismissed = true;
    const prioritized = svc.prioritizeRecommendations(recs, 10);
    expect(prioritized.length).toBeLessThan(recs.length);
    expect(prioritized.every((r) => !r.isDismissed)).toBe(true);
  });

  it('dismissRecommendation marks specific rec as dismissed', () => {
    const svc = new LearningRecommendationService();
    const recs = svc.generateRecommendations({
      revision: makeRevision(),
      streak: makeStreak(),
      topicsCompleted: 0,
      assessmentsPassed: 0,
      hasActivePaths: true,
    });
    const dismissed = svc.dismissRecommendation(recs, recs[0].id);
    expect(dismissed[0].isDismissed).toBe(true);
  });

  it('does not generate assessment recommendation when assessmentsPassed >= 2', () => {
    const svc = new LearningRecommendationService();
    const recs = svc.generateRecommendations({
      revision: makeRevision(),
      streak: makeStreak(),
      topicsCompleted: 5,
      assessmentsPassed: 2,
      hasActivePaths: true,
    });
    expect(recs.some((r) => r.category === 'assessment')).toBe(false);
  });

  it('does not generate assessment recommendation when topicsCompleted <= 3', () => {
    const svc = new LearningRecommendationService();
    const recs = svc.generateRecommendations({
      revision: makeRevision(),
      streak: makeStreak(),
      topicsCompleted: 2,
      assessmentsPassed: 0,
      hasActivePaths: true,
    });
    expect(recs.some((r) => r.category === 'assessment')).toBe(false);
  });

  it('prioritizeRecommendations respects maxCount', () => {
    const svc = new LearningRecommendationService();
    const recs = svc.generateRecommendations({
      revision: makeRevision(),
      streak: makeStreak(),
      topicsCompleted: 0,
      assessmentsPassed: 0,
      hasActivePaths: true,
    });
    const prioritized = svc.prioritizeRecommendations(recs, 1);
    expect(prioritized.length).toBeLessThanOrEqual(1);
  });

  it('generateRecommendations includes revision when items due and path when no active', () => {
    const svc = new LearningRecommendationService();
    const recs = svc.generateRecommendations({
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
        ],
      }),
      streak: makeStreak(),
      topicsCompleted: 0,
      assessmentsPassed: 0,
      hasActivePaths: false,
    });
    expect(recs.some((r) => r.category === 'revision')).toBe(true);
    expect(recs.some((r) => r.category === 'path')).toBe(true);
  });
});
