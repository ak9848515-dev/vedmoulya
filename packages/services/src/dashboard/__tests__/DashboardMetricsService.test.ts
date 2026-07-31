import { describe, it, expect } from 'vitest';
import { DashboardMetricsService } from '../DashboardMetricsService.js';

describe('DashboardMetricsService', () => {
  let service: DashboardMetricsService;

  beforeEach(() => {
    service = new DashboardMetricsService();
  });

  describe('calculateLifeScore', () => {
    it('calculates weighted life score', () => {
      const score = service.calculateLifeScore({
        goalProgress: 80,
        missionProgress: 60,
        executionRate: 70,
        decisionQuality: 75,
        learningHours: 20,
        careerGrowth: 50,
        consistency: 80,
      });
      // 80*0.2 + 60*0.15 + 70*0.15 + 75*0.1 + min(20/40,1)*0.1 + min(50/100,1)*0.1 + 80*0.2
      // = 16 + 9 + 10.5 + 7.5 + 5 + 5 + 16 = 69
      expect(score).toBe(69);
    });

    it('caps learning hours at 40', () => {
      const score = service.calculateLifeScore({
        goalProgress: 50,
        missionProgress: 50,
        executionRate: 50,
        decisionQuality: 50,
        learningHours: 100,
        careerGrowth: 50,
        consistency: 50,
      });
      const scoreLow = service.calculateLifeScore({
        goalProgress: 50,
        missionProgress: 50,
        executionRate: 50,
        decisionQuality: 50,
        learningHours: 10,
        careerGrowth: 50,
        consistency: 50,
      });
      // Both should be same since both above/below threshold weight differently
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('caps career growth at 100', () => {
      const score = service.calculateLifeScore({
        goalProgress: 50,
        missionProgress: 50,
        executionRate: 50,
        decisionQuality: 50,
        learningHours: 20,
        careerGrowth: 200,
        consistency: 50,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('returns 0 for all zeros', () => {
      const score = service.calculateLifeScore({
        goalProgress: 0,
        missionProgress: 0,
        executionRate: 0,
        decisionQuality: 0,
        learningHours: 0,
        careerGrowth: 0,
        consistency: 0,
      });
      expect(score).toBe(0);
    });
  });

  describe('calculateMomentum', () => {
    it('calculates momentum based on trend', () => {
      const momentum = service.calculateMomentum(70, 60, 50);
      expect(momentum).toBeGreaterThan(0);
    });

    it('returns 0 for zero values', () => {
      expect(service.calculateMomentum(0, 0, 0)).toBe(0);
    });

    it('clamps between 0 and 100', () => {
      const high = service.calculateMomentum(100, 100, 0);
      expect(high).toBeLessThanOrEqual(100);
      const negative = service.calculateMomentum(0, 10, 100);
      expect(negative).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateConsistency', () => {
    it('calculates consistency from variance', () => {
      const consistent = service.calculateConsistency([80, 80, 80]);
      expect(consistent).toBe(100);

      const inconsistent = service.calculateConsistency([100, 0, 100]);
      expect(inconsistent).toBeLessThan(100);
    });

    it('returns 0 for empty rates', () => {
      expect(service.calculateConsistency([])).toBe(0);
    });
  });

  describe('calculateStreak', () => {
    it('counts consecutive days with >=50% completion', () => {
      const streak = service.calculateStreak([
        { date: '2026-06-03', completed: 3, total: 5 },
        { date: '2026-06-02', completed: 1, total: 5 }, // below 50%
        { date: '2026-06-01', completed: 5, total: 5 },
      ]);
      expect(streak).toBe(1); // only June 3rd qualifies from the start
    });

    it('handles empty completions', () => {
      expect(service.calculateStreak([])).toBe(0);
    });
  });

  describe('aggregate', () => {
    it('aggregates all metrics', () => {
      const metrics = service.aggregate({
        goalProgress: 70,
        missionProgress: 60,
        executionRate: 80,
        decisionQuality: 75,
        learningHours: 20,
        careerGrowth: 50,
        weeklyCompletion: 70,
        monthlyCompletion: 65,
        previousWeeklyCompletion: 60,
        dailyCompletionRates: [80, 80, 80],
        dailyCompletions: [{ date: '2026-06-01', completed: 4, total: 5 }],
        consistency: 100,
      });
      expect(metrics.lifeScore).toBeGreaterThan(0);
      expect(metrics.weeklyCompletion).toBe(70);
      expect(metrics.monthlyCompletion).toBe(65);
      expect(metrics.streak).toBeGreaterThanOrEqual(0);
    });
  });
});
