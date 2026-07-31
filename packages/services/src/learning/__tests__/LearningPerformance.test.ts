import { describe, it, expect } from 'vitest';
import { LearningCacheService } from '../LearningCacheService.js';
import { LearningConfigurationService } from '../LearningConfigurationService.js';
import { LearningMetricsService } from '../LearningMetricsService.js';
import { LearningRevisionService } from '../LearningRevisionService.js';
import { LearningRecommendationService } from '../LearningRecommendationService.js';
import { LearningInsightService } from '../LearningInsightService.js';

describe('Learning Performance Benchmarks', () => {
  it('cache get completes under 1ms', () => {
    const svc = new LearningCacheService();
    svc.set('key', 'data');
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      svc.get('key');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10); // 1000 ops in <10ms = <0.01ms each
  });

  it('cache set completes under 1ms', () => {
    const svc = new LearningCacheService();
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      svc.set(`key${i}`, 'data');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it('cache miss completes under 1ms', () => {
    const svc = new LearningCacheService();
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      svc.get(`nonexistent_${i}`);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it('config get completes under 1ms', () => {
    const svc = new LearningConfigurationService();
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      svc.getConfig(`user_${i}`);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });

  it('config update completes under 1ms', () => {
    const svc = new LearningConfigurationService();
    svc.getConfig('u1');
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      svc.updateConfig('u1', { weeklyGoalHours: i % 100 });
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it('metrics calculation completes under 1ms', () => {
    const svc = new LearningMetricsService();
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      svc.calculateLearningScore({
        knowledgeRetention: 80,
        weeklyProgress: 60,
        consistencyScore: 50,
        breadthScore: 40,
        depthScore: 30,
        streak: 5,
      });
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it('revision schedule build completes under 1ms', () => {
    const svc = new LearningRevisionService();
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `r${i}`,
      topic: 'Topic',
      title: `Title ${i}`,
      dueDate: new Date(Date.now() + i * 86400000).toISOString(),
      importance: i,
      estimatedMinutes: 30,
      status: (i < 5 ? 'completed' : 'pending') as 'completed' | 'pending',
      confidence: 50,
      lastReviewed: i < 5 ? new Date().toISOString() : undefined,
    }));
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      svc.buildSchedule(items);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });

  it('recommendation generation completes under 1ms', () => {
    const svc = new LearningRecommendationService();
    const revision = {
      dueToday: [
        {
          id: '1',
          topic: 'a',
          title: 'a',
          dueDate: new Date().toISOString(),
          importance: 1,
          estimatedMinutes: 10,
          status: 'pending',
          confidence: 50,
        } as any,
      ],
      dueThisWeek: [],
      upcoming: [],
      totalForReview: 1,
    };
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      svc.generateRecommendations({
        revision,
        streak: {
          current: 0,
          longest: 0,
          weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
          monthlyActiveDays: 0,
          lastActiveDate: '',
        },
        topicsCompleted: 5,
        assessmentsPassed: 1,
        hasActivePaths: true,
      });
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });

  it('insight generation completes under 1ms', () => {
    const svc = new LearningInsightService();
    const revision = {
      dueToday: [
        {
          id: '1',
          topic: 'a',
          title: 'a',
          dueDate: new Date().toISOString(),
          importance: 1,
          estimatedMinutes: 10,
          status: 'pending',
          confidence: 50,
        } as any,
        {
          id: '2',
          topic: 'b',
          title: 'b',
          dueDate: new Date().toISOString(),
          importance: 1,
          estimatedMinutes: 10,
          status: 'pending',
          confidence: 50,
        } as any,
        {
          id: '3',
          topic: 'c',
          title: 'c',
          dueDate: new Date().toISOString(),
          importance: 1,
          estimatedMinutes: 10,
          status: 'pending',
          confidence: 50,
        } as any,
      ],
      dueThisWeek: [],
      upcoming: [],
      totalForReview: 3,
    };
    const streak = {
      current: 7,
      longest: 7,
      weeklyActivity: [1, 1, 1, 0, 0, 0, 0],
      monthlyActiveDays: 7,
      lastActiveDate: '',
    };
    const metrics = {
      learningScore: 50,
      knowledgeRetention: 80,
      weeklyProgress: 90,
      monthlyProgress: 50,
      streak: 7,
      hoursLearnedThisWeek: 5,
      hoursLearnedThisMonth: 20,
      topicsCompleted: 10,
      assessmentsPassed: 3,
      projectsCompleted: 1,
      consistencyScore: 50,
      breadthScore: 50,
      depthScore: 50,
      overallProgress: 50,
    };
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      svc.generateInsights({
        revision,
        streak,
        metrics,
        topicsCompleted: 10,
        assessmentsPassed: 3,
      });
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });
});
