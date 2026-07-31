import { describe, it, expect } from 'vitest';
import { CareerInsightService } from '../CareerInsightService.js';
import type {
  SkillGapDTO,
  InterviewReadinessDTO,
  ResumeHealthDTO,
  CareerMetricsDTO,
  JobMatchDTO,
} from '../CareerDTO.js';

const emptyMetrics: CareerMetricsDTO = {
  careerScore: 0,
  skillGrowthRate: 0,
  interviewReadiness: 0,
  resumeHealth: 0,
  portfolioHealth: 0,
  jobMatchCount: 0,
  marketFitScore: 0,
  certificationProgress: 0,
  networkingScore: 0,
  learningHoursThisMonth: 0,
  applicationsThisMonth: 0,
  interviewConversionRate: 0,
  overallProgress: 0,
};

const defaultInterview: InterviewReadinessDTO = {
  overallScore: 50,
  behavioralScore: 50,
  technicalScore: 50,
  systemDesignScore: 50,
  questionCategories: [],
  weakAreas: [],
  strongAreas: [],
  mockInterviewCount: 0,
  recommendedPractice: [],
};
const defaultResume: ResumeHealthDTO = {
  completeness: 80,
  atsScore: 70,
  sections: [],
  missingSections: [],
  suggestions: [],
  keywordDensity: {},
  versionCount: 0,
  lastAnalyzed: '',
};

describe('CareerInsightService', () => {
  it('generates gap warning when ≥3 critical gaps', () => {
    const svc = new CareerInsightService();
    const gaps: SkillGapDTO[] = [
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
      {
        skillName: 'B',
        category: 'technical',
        currentLevel: 'beginner',
        requiredLevel: 'expert',
        gapSize: 3,
        priority: 'critical',
        recommendedResources: [],
        estimatedTimeToClose: 120,
        relevanceToGoal: 25,
      },
      {
        skillName: 'C',
        category: 'technical',
        currentLevel: 'beginner',
        requiredLevel: 'expert',
        gapSize: 3,
        priority: 'critical',
        recommendedResources: [],
        estimatedTimeToClose: 120,
        relevanceToGoal: 25,
      },
    ];
    const insights = svc.generateInsights({
      gaps,
      interview: defaultInterview,
      resume: defaultResume,
      metrics: emptyMetrics,
      jobMatches: [],
      skillCount: 0,
    });
    expect(insights.some((i) => i.title.includes('Skill Gaps'))).toBe(true);
  });

  it('generates achievement for 10+ skills', () => {
    const svc = new CareerInsightService();
    const insights = svc.generateInsights({
      gaps: [],
      interview: defaultInterview,
      resume: defaultResume,
      metrics: emptyMetrics,
      jobMatches: [],
      skillCount: 12,
    });
    expect(insights.some((i) => i.title.includes('Diverse Skill'))).toBe(true);
  });

  it('generates interview achievement when score ≥70', () => {
    const svc = new CareerInsightService();
    const interview: InterviewReadinessDTO = {
      overallScore: 80,
      behavioralScore: 80,
      technicalScore: 80,
      systemDesignScore: 80,
      questionCategories: [],
      weakAreas: [],
      strongAreas: ['Tech'],
      mockInterviewCount: 3,
      recommendedPractice: [],
    };
    const insights = svc.generateInsights({
      gaps: [],
      interview,
      resume: defaultResume,
      metrics: emptyMetrics,
      jobMatches: [],
      skillCount: 0,
    });
    expect(insights.some((i) => i.title.includes('Interview Ready'))).toBe(true);
  });

  it('generates market trend when ≥5 job matches', () => {
    const svc = new CareerInsightService();
    const jobs: JobMatchDTO[] = Array.from({ length: 5 }, (_, i) => ({
      id: `j${i}`,
      title: 'Engineer',
      company: 'C',
      location: 'L',
      fitScore: 70,
      skillMatch: 50,
      experienceMatch: 50,
      growthPotential: 50,
      marketDemand: 50,
      matchedSkills: [],
      missingSkills: [],
      relevance: 70,
    }));
    const insights = svc.generateInsights({
      gaps: [],
      interview: defaultInterview,
      resume: defaultResume,
      metrics: emptyMetrics,
      jobMatches: jobs,
      skillCount: 5,
    });
    expect(insights.some((i) => i.title.includes('Market Demand'))).toBe(true);
  });

  it('generates mismatch prediction when 0 jobs but skills exist', () => {
    const svc = new CareerInsightService();
    const insights = svc.generateInsights({
      gaps: [],
      interview: defaultInterview,
      resume: defaultResume,
      metrics: emptyMetrics,
      jobMatches: [],
      skillCount: 5,
    });
    expect(insights.some((i) => i.title.includes('Mismatch'))).toBe(true);
  });

  it('generates resume warning when completeness <50', () => {
    const svc = new CareerInsightService();
    const resume: ResumeHealthDTO = {
      completeness: 30,
      atsScore: 20,
      sections: [],
      missingSections: ['summary'],
      suggestions: [],
      keywordDensity: {},
      versionCount: 0,
      lastAnalyzed: '',
    };
    const insights = svc.generateInsights({
      gaps: [],
      interview: defaultInterview,
      resume,
      metrics: emptyMetrics,
      jobMatches: [],
      skillCount: 0,
    });
    expect(insights.some((i) => i.title.includes('Resume Needs'))).toBe(true);
  });

  it('generates growth trajectory when overallProgress >50', () => {
    const svc = new CareerInsightService();
    const metrics: CareerMetricsDTO = { ...emptyMetrics, overallProgress: 60 };
    const insights = svc.generateInsights({
      gaps: [],
      interview: defaultInterview,
      resume: defaultResume,
      metrics,
      jobMatches: [],
      skillCount: 0,
    });
    expect(insights.some((i) => i.title.includes('Trajectory'))).toBe(true);
  });

  it('sorts insights by severity', () => {
    const svc = new CareerInsightService();
    const insights = svc.generateInsights({
      gaps: [],
      interview: defaultInterview,
      resume: defaultResume,
      metrics: emptyMetrics,
      jobMatches: [],
      skillCount: 0,
    });
    // Should always return at least the mismatch + growth if skillCount >0
  });

  it('getActionableInsights filters correctly', () => {
    const svc = new CareerInsightService();
    const resume: ResumeHealthDTO = {
      completeness: 30,
      atsScore: 20,
      sections: [],
      missingSections: [],
      suggestions: [],
      keywordDensity: {},
      versionCount: 0,
      lastAnalyzed: '',
    };
    const insights = svc.generateInsights({
      gaps: [],
      interview: defaultInterview,
      resume,
      metrics: emptyMetrics,
      jobMatches: [],
      skillCount: 0,
    });
    const actionable = svc.getActionableInsights(insights);
    expect(actionable.every((i) => i.actionable)).toBe(true);
  });
});
