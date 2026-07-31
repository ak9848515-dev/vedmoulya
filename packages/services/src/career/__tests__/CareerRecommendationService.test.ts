import { describe, it, expect } from 'vitest';
import { CareerRecommendationService } from '../CareerRecommendationService.js';

describe('CareerRecommendationService', () => {
  it('generates skill recommendations for critical gaps', () => {
    const svc = new CareerRecommendationService();
    const recs = svc.generateRecommendations({
      gaps: [
        {
          skillName: 'TypeScript',
          category: 'technical',
          currentLevel: 'beginner',
          requiredLevel: 'expert',
          gapSize: 3,
          priority: 'critical',
          recommendedResources: [],
          estimatedTimeToClose: 120,
          relevanceToGoal: 25,
        },
      ],
      interview: {
        overallScore: 80,
        behavioralScore: 80,
        technicalScore: 80,
        systemDesignScore: 80,
        questionCategories: [],
        weakAreas: [],
        strongAreas: [],
        mockInterviewCount: 3,
        recommendedPractice: [],
      },
      resume: {
        completeness: 80,
        atsScore: 70,
        sections: [],
        missingSections: [],
        suggestions: [],
        keywordDensity: {},
        versionCount: 1,
        lastAnalyzed: '',
      },
      hasPortfolio: true,
      certProgress: 60,
      applicationsActive: true,
    });
    expect(recs.some((r) => r.category === 'skill')).toBe(true);
  });

  it('generates interview recommendation when score <60', () => {
    const svc = new CareerRecommendationService();
    const recs = svc.generateRecommendations({
      gaps: [],
      interview: {
        overallScore: 40,
        behavioralScore: 40,
        technicalScore: 40,
        systemDesignScore: 40,
        questionCategories: [],
        weakAreas: ['Tech'],
        strongAreas: [],
        mockInterviewCount: 0,
        recommendedPractice: [],
      },
      resume: {
        completeness: 80,
        atsScore: 70,
        sections: [],
        missingSections: [],
        suggestions: [],
        keywordDensity: {},
        versionCount: 1,
        lastAnalyzed: '',
      },
      hasPortfolio: true,
      certProgress: 60,
      applicationsActive: true,
    });
    expect(recs.some((r) => r.category === 'interview')).toBe(true);
  });

  it('generates resume recommendation when completeness <70', () => {
    const svc = new CareerRecommendationService();
    const recs = svc.generateRecommendations({
      gaps: [],
      interview: {
        overallScore: 80,
        behavioralScore: 80,
        technicalScore: 80,
        systemDesignScore: 80,
        questionCategories: [],
        weakAreas: [],
        strongAreas: [],
        mockInterviewCount: 3,
        recommendedPractice: [],
      },
      resume: {
        completeness: 40,
        atsScore: 30,
        sections: [],
        missingSections: ['summary'],
        suggestions: [],
        keywordDensity: {},
        versionCount: 1,
        lastAnalyzed: '',
      },
      hasPortfolio: true,
      certProgress: 60,
      applicationsActive: true,
    });
    expect(recs.some((r) => r.category === 'resume')).toBe(true);
  });

  it('generates certification recommendation when progress <50', () => {
    const svc = new CareerRecommendationService();
    const recs = svc.generateRecommendations({
      gaps: [],
      interview: {
        overallScore: 80,
        behavioralScore: 80,
        technicalScore: 80,
        systemDesignScore: 80,
        questionCategories: [],
        weakAreas: [],
        strongAreas: [],
        mockInterviewCount: 3,
        recommendedPractice: [],
      },
      resume: {
        completeness: 80,
        atsScore: 70,
        sections: [],
        missingSections: [],
        suggestions: [],
        keywordDensity: {},
        versionCount: 1,
        lastAnalyzed: '',
      },
      hasPortfolio: true,
      certProgress: 30,
      applicationsActive: true,
    });
    expect(recs.some((r) => r.category === 'certification')).toBe(true);
  });

  it('generates portfolio recommendation when no portfolio', () => {
    const svc = new CareerRecommendationService();
    const recs = svc.generateRecommendations({
      gaps: [],
      interview: {
        overallScore: 80,
        behavioralScore: 80,
        technicalScore: 80,
        systemDesignScore: 80,
        questionCategories: [],
        weakAreas: [],
        strongAreas: [],
        mockInterviewCount: 3,
        recommendedPractice: [],
      },
      resume: {
        completeness: 80,
        atsScore: 70,
        sections: [],
        missingSections: [],
        suggestions: [],
        keywordDensity: {},
        versionCount: 1,
        lastAnalyzed: '',
      },
      hasPortfolio: false,
      certProgress: 60,
      applicationsActive: true,
    });
    expect(recs.some((r) => r.category === 'project')).toBe(true);
  });

  it('always includes learning and career recommendations', () => {
    const svc = new CareerRecommendationService();
    const recs = svc.generateRecommendations({
      gaps: [],
      interview: {
        overallScore: 80,
        behavioralScore: 80,
        technicalScore: 80,
        systemDesignScore: 80,
        questionCategories: [],
        weakAreas: [],
        strongAreas: [],
        mockInterviewCount: 3,
        recommendedPractice: [],
      },
      resume: {
        completeness: 80,
        atsScore: 70,
        sections: [],
        missingSections: [],
        suggestions: [],
        keywordDensity: {},
        versionCount: 1,
        lastAnalyzed: '',
      },
      hasPortfolio: true,
      certProgress: 60,
      applicationsActive: true,
    });
    expect(recs.some((r) => r.category === 'learning')).toBe(true);
    expect(recs.some((r) => r.category === 'career')).toBe(true);
  });

  it('prioritizeRecommendations sorts and limits', () => {
    const svc = new CareerRecommendationService();
    const recs = svc.generateRecommendations({
      gaps: [
        {
          skillName: 'A',
          category: 'technical',
          currentLevel: 'beginner',
          requiredLevel: 'expert',
          gapSize: 3,
          priority: 'critical',
          recommendedResources: [],
          estimatedTimeToClose: 120,
          relevanceToGoal: 25,
        },
      ],
      interview: {
        overallScore: 40,
        behavioralScore: 40,
        technicalScore: 40,
        systemDesignScore: 40,
        questionCategories: [],
        weakAreas: ['Tech'],
        strongAreas: [],
        mockInterviewCount: 0,
        recommendedPractice: [],
      },
      resume: {
        completeness: 40,
        atsScore: 30,
        sections: [],
        missingSections: ['summary'],
        suggestions: [],
        keywordDensity: {},
        versionCount: 1,
        lastAnalyzed: '',
      },
      hasPortfolio: false,
      certProgress: 30,
      applicationsActive: false,
    });
    const prioritized = svc.prioritizeRecommendations(recs, 3);
    expect(prioritized.length).toBeLessThanOrEqual(3);
  });

  it('dismissRecommendation marks as dismissed', () => {
    const svc = new CareerRecommendationService();
    const recs = svc.generateRecommendations({
      gaps: [],
      interview: {
        overallScore: 80,
        behavioralScore: 80,
        technicalScore: 80,
        systemDesignScore: 80,
        questionCategories: [],
        weakAreas: [],
        strongAreas: [],
        mockInterviewCount: 3,
        recommendedPractice: [],
      },
      resume: {
        completeness: 80,
        atsScore: 70,
        sections: [],
        missingSections: [],
        suggestions: [],
        keywordDensity: {},
        versionCount: 1,
        lastAnalyzed: '',
      },
      hasPortfolio: true,
      certProgress: 60,
      applicationsActive: true,
    });
    const updated = svc.dismissRecommendation(recs, recs[0]!.id);
    expect(updated[0]!.isDismissed).toBe(true);
  });
});
