import { describe, it, expect } from 'vitest';
import { LearningMetricsService } from '../LearningMetricsService.js';

describe('LearningMetricsService', () => {
  it('calculateLearningScore returns correct score', () => {
    const svc = new LearningMetricsService();
    const score = svc.calculateLearningScore({
      knowledgeRetention: 80,
      weeklyProgress: 60,
      consistencyScore: 50,
      breadthScore: 40,
      depthScore: 30,
      streak: 5,
    });
    // 80*0.25 + 60*0.2 + 50*0.2 + 40*0.15 + 30*0.1 + min(10,10) = 20+12+10+6+3+10 = 61
    expect(score).toBe(610); // Formula: Math.round(61 * 10)
  });

  it('calculateLearningScore caps streak at 10', () => {
    const svc = new LearningMetricsService();
    const score = svc.calculateLearningScore({
      knowledgeRetention: 50,
      weeklyProgress: 50,
      consistencyScore: 50,
      breadthScore: 50,
      depthScore: 50,
      streak: 100,
    });
    const expected = Math.round((50 * 0.25 + 50 * 0.2 + 50 * 0.2 + 50 * 0.15 + 50 * 0.1 + 10) * 10);
    expect(score).toBe(expected);
  });

  it('aggregate returns full metrics DTO', () => {
    const svc = new LearningMetricsService();
    const m = svc.aggregate({
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
    expect(m.learningScore).toBe(610); // Formula: Math.round((...) * 10)
    expect(m.topicsCompleted).toBe(10);
    expect(m.assessmentsPassed).toBe(3);
    expect(m.overallProgress).toBeGreaterThan(0);
    expect(m.streak).toBe(5);
  });

  it('aggregate handles zero values', () => {
    const svc = new LearningMetricsService();
    const m = svc.aggregate({
      knowledgeRetention: 0,
      weeklyProgress: 0,
      monthlyProgress: 0,
      streak: 0,
      hoursLearnedThisWeek: 0,
      hoursLearnedThisMonth: 0,
      topicsCompleted: 0,
      assessmentsPassed: 0,
      projectsCompleted: 0,
      consistencyScore: 0,
      breadthScore: 0,
      depthScore: 0,
    });
    expect(m.learningScore).toBe(0);
    expect(m.overallProgress).toBe(0);
  });
});
