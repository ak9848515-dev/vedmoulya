import { describe, it, expect } from 'vitest';
import { CareerMetricsService } from '../CareerMetricsService.js';

describe('CareerMetricsService', () => {
  describe('calculateCareerScore', () => {
    it('returns a weighted career score', () => {
      const svc = new CareerMetricsService();
      const score = svc.calculateCareerScore({
        skillProficiency: 80,
        experienceRelevance: 70,
        interviewReadiness: 60,
        resumeQuality: 50,
        marketFit: 40,
        certificationProgress: 30,
        networkingScore: 20,
      });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('returns 0 for all zeros', () => {
      const svc = new CareerMetricsService();
      expect(
        svc.calculateCareerScore({
          skillProficiency: 0,
          experienceRelevance: 0,
          interviewReadiness: 0,
          resumeQuality: 0,
          marketFit: 0,
          certificationProgress: 0,
          networkingScore: 0,
        }),
      ).toBe(0);
    });

    it('returns 100 for perfect scores', () => {
      const svc = new CareerMetricsService();
      expect(
        svc.calculateCareerScore({
          skillProficiency: 100,
          experienceRelevance: 100,
          interviewReadiness: 100,
          resumeQuality: 100,
          marketFit: 100,
          certificationProgress: 100,
          networkingScore: 100,
        }),
      ).toBe(100);
    });
  });

  describe('calculateSkillGrowthRate', () => {
    it('returns 0 for empty skills', () => {
      expect(new CareerMetricsService().calculateSkillGrowthRate([])).toBe(0);
    });

    it('returns growth rate based on skill levels', () => {
      const svc = new CareerMetricsService();
      const skills = [
        { level: 'advanced', yearsOfExperience: 3 },
        { level: 'intermediate', yearsOfExperience: 2 },
      ];
      const rate = svc.calculateSkillGrowthRate(skills);
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(100);
    });

    it('caps at 100 for master level skills', () => {
      const svc = new CareerMetricsService();
      const skills = [
        { level: 'master', yearsOfExperience: 10 },
        { level: 'master', yearsOfExperience: 8 },
      ];
      const rate = svc.calculateSkillGrowthRate(skills);
      expect(rate).toBe(100);
    });

    it('handles unknown levels with default weight 1', () => {
      const svc = new CareerMetricsService();
      const skills = [{ level: 'unknown', yearsOfExperience: 1 }];
      expect(svc.calculateSkillGrowthRate(skills)).toBe(20);
    });
  });

  describe('aggregate', () => {
    it('returns complete CareerMetricsDTO', () => {
      const svc = new CareerMetricsService();
      const result = svc.aggregate({
        skillProficiency: 80,
        experienceRelevance: 70,
        interviewReadiness: 60,
        resumeQuality: 50,
        marketFit: 40,
        certificationProgress: 30,
        networkingScore: 20,
        learningHoursThisMonth: 10,
        applicationsThisMonth: 5,
        interviewConversionRate: 50,
        skillGrowthRate: 60,
        jobMatchCount: 3,
      });
      expect(result.careerScore).toBeGreaterThan(0);
      expect(result.skillGrowthRate).toBe(60);
      expect(result.interviewReadiness).toBe(60);
      expect(result.jobMatchCount).toBe(3);
      expect(result.overallProgress).toBeGreaterThan(0);
    });
  });
});
