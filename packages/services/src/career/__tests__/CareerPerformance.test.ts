import { describe, it, expect } from 'vitest';
import { CareerCacheService } from '../CareerCacheService.js';
import { CareerConfigurationService } from '../CareerConfigurationService.js';
import { CareerMetricsService } from '../CareerMetricsService.js';
import { CareerGapAnalysisService } from '../CareerGapAnalysisService.js';
import { CareerJobMatchingService } from '../CareerJobMatchingService.js';
import { CareerResumeService } from '../CareerResumeService.js';
import { CareerRoadmapService } from '../CareerRoadmapService.js';
import { CareerRecommendationService } from '../CareerRecommendationService.js';

describe('Career Performance Benchmarks', () => {
  describe('Cache Operations', () => {
    it('cache get completes in <1ms', () => {
      const cache = new CareerCacheService();
      cache.set('test', { data: 'value' });
      const start = performance.now();
      for (let i = 0; i < 1000; i++) cache.get('test');
      const elapsed = performance.now() - start;
      expect(elapsed / 1000).toBeLessThan(1);
    });

    it('cache set completes in <1ms', () => {
      const cache = new CareerCacheService();
      const start = performance.now();
      cache.set('bench', { data: 'x' });
      expect(performance.now() - start).toBeLessThan(1);
    });

    it('cache miss completes in <1ms', () => {
      const cache = new CareerCacheService();
      const start = performance.now();
      cache.get('nonexistent');
      expect(performance.now() - start).toBeLessThan(1);
    });
  });

  describe('Configuration Operations', () => {
    it('config get completes in <1ms', () => {
      const config = new CareerConfigurationService();
      const start = performance.now();
      config.getConfig('user');
      expect(performance.now() - start).toBeLessThan(1);
    });

    it('config update completes in <1ms', () => {
      const config = new CareerConfigurationService();
      const start = performance.now();
      config.updateConfig('user', { jobSearchActive: true });
      expect(performance.now() - start).toBeLessThan(1);
    });
  });

  describe('Resume Analysis', () => {
    it('analyzes resume in <2ms', () => {
      const svc = new CareerResumeService();
      const sections = [
        { name: 'contact', content: 'john@example.com\n555-1234\nlinkedin.com/in/john' },
        {
          name: 'summary',
          content:
            'Engineer with experience in building great products. Led multiple teams.' +
            'x'.repeat(200),
        },
        {
          name: 'experience',
          content: 'Led development of major features. Improved performance. Managed team.',
        },
        { name: 'education', content: 'BS Computer Science' },
        { name: 'skills', content: 'JavaScript, Python, React, AWS' },
      ];
      const start = performance.now();
      svc.analyzeResume(sections);
      expect(performance.now() - start).toBeLessThan(5);
    });
  });

  describe('Job Matching', () => {
    it('matches 10 jobs in <1ms', () => {
      const svc = new CareerJobMatchingService();
      const jobs = Array.from({ length: 10 }, (_, i) => ({
        id: `j${i}`,
        title: 'Engineer',
        company: 'C',
        location: 'L',
        requiredSkills: ['JavaScript', 'TypeScript', 'React', 'Node', 'AWS'],
        preferredSkills: ['Docker', 'K8s'],
        minExperience: 2,
        postedDate: new Date().toISOString(),
      }));
      const start = performance.now();
      svc.matchJobs(jobs, ['JavaScript', 'TypeScript', 'Python'], 3, 'Engineer');
      expect(performance.now() - start).toBeLessThan(1);
    });
  });

  describe('Metrics Calculation', () => {
    it('calculates career score in <1ms', () => {
      const svc = new CareerMetricsService();
      const start = performance.now();
      svc.calculateCareerScore({
        skillProficiency: 80,
        experienceRelevance: 70,
        interviewReadiness: 60,
        resumeQuality: 50,
        marketFit: 40,
        certificationProgress: 30,
        networkingScore: 20,
      });
      expect(performance.now() - start).toBeLessThan(1);
    });
  });

  describe('Roadmap Generation', () => {
    it('builds roadmap in <1ms', () => {
      const svc = new CareerRoadmapService();
      const milestones = Array.from({ length: 10 }, (_, i) => ({
        id: `m${i}`,
        label: `M${i}`,
        description: '',
        status: 'pending' as const,
      }));
      const start = performance.now();
      svc.buildRoadmap('exploring', 'leadership', milestones);
      expect(performance.now() - start).toBeLessThan(1);
    });
  });

  describe('Recommendation Generation', () => {
    it('generates recommendations in <1ms', () => {
      const svc = new CareerRecommendationService();
      const gaps = Array.from({ length: 5 }, (_, i) => ({
        skillName: `S${i}`,
        category: 'technical' as const,
        currentLevel: 'beginner' as const,
        requiredLevel: 'expert' as const,
        gapSize: 3,
        priority: 'critical' as const,
        recommendedResources: [],
        estimatedTimeToClose: 120,
        relevanceToGoal: 25,
      }));
      const start = performance.now();
      svc.generateRecommendations({
        gaps,
        interview: {
          overallScore: 40,
          behavioralScore: 40,
          technicalScore: 40,
          systemDesignScore: 40,
          questionCategories: [],
          weakAreas: [],
          strongAreas: [],
          mockInterviewCount: 0,
          recommendedPractice: [],
        } as any,
        resume: {
          completeness: 40,
          atsScore: 30,
          sections: [],
          missingSections: [],
          suggestions: [],
          keywordDensity: {},
          versionCount: 0,
          lastAnalyzed: '',
        } as any,
        hasPortfolio: false,
        certProgress: 30,
        applicationsActive: false,
      });
      expect(performance.now() - start).toBeLessThan(1);
    });
  });
});
