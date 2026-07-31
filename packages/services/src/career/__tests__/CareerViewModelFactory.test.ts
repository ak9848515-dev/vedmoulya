import { describe, it, expect } from 'vitest';
import { CareerViewModelFactory } from '../CareerViewModelFactory.js';
import type { CareerSnapshotDTO } from '../CareerDTO.js';

const baseSnapshot: CareerSnapshotDTO = {
  id: 'csnap_test',
  userId: 'u1',
  generatedAt: '2026-01-01T00:00:00Z',
  ttl: 300000,
  profile: {
    userId: 'u1',
    displayName: 'Test',
    email: '',
    currentTitle: 'Engineer',
    industry: 'Tech',
    yearsOfExperience: 3,
    summary: 'A summary',
    strengths: ['Coding'],
    growthAreas: ['Leadership'],
    careerStage: 'mid',
    preferredLocations: [],
    openToRelocation: false,
    openToRemote: true,
    employmentType: ['full-time'],
    socialLinks: [],
    updatedAt: '',
  },
  skills: {
    skills: [
      {
        id: 's1',
        name: 'TS',
        category: 'technical',
        level: 'advanced',
        yearsOfExperience: 3,
        confidence: 0.9,
        certifications: [],
        projects: [],
        endorsements: 0,
        isVerified: false,
        isFavorite: false,
      },
    ],
    totalCount: 1,
    lastAssessed: '',
  },
  gaps: [],
  roadmap: {
    currentStage: 'mid',
    targetStage: 'senior',
    stages: [],
    milestones: [
      { id: 'm1', label: 'Target', description: '', status: 'completed' },
      { id: 'm2', label: 'Next', description: '', status: 'in_progress' },
    ],
    estimatedTimelineMonths: 24,
    progress: 50,
    flexibilityScore: 75,
    alternativePaths: [],
  },
  resume: {
    completeness: 80,
    atsScore: 70,
    sections: [
      { name: 'summary', present: true, completeness: 80, wordCount: 50, suggestions: [] },
    ],
    missingSections: [],
    suggestions: [],
    keywordDensity: {},
    versionCount: 1,
    lastAnalyzed: '',
  },
  portfolio: {
    completeness: 60,
    projectCount: 2,
    featuredProjects: [],
    technologies: ['React'],
    hasWebsite: false,
    hasGitHub: false,
    hasLinkedIn: false,
    hasPersonalSite: false,
    suggestions: [],
    lastAnalyzed: '',
  },
  interview: {
    overallScore: 70,
    behavioralScore: 70,
    technicalScore: 70,
    systemDesignScore: 50,
    questionCategories: [],
    weakAreas: ['Design'],
    strongAreas: ['Tech'],
    mockInterviewCount: 2,
    recommendedPractice: ['Study'],
  },
  jobs: [
    {
      id: 'j1',
      title: 'Engineer',
      company: 'TechCo',
      location: 'Remote',
      fitScore: 80,
      skillMatch: 70,
      experienceMatch: 60,
      growthPotential: 75,
      marketDemand: 65,
      matchedSkills: ['TS'],
      missingSkills: ['AWS'],
      relevance: 80,
    },
  ],
  market: {
    industry: 'Tech',
    trends: [
      {
        name: 'AI',
        description: 'AI growth',
        impact: 'positive',
        timeframe: 'short',
        relevance: 80,
      },
    ],
    emergingSkills: ['AI/ML'],
    decliningSkills: [],
    certificationDemand: [],
    salaryInsights: [],
    hiringTrends: [],
    topEmployers: ['Google'],
    lastUpdated: '',
  },
  certifications: [],
  timeline: { entries: [], totalEntries: 0, hasMore: false },
  insights: [],
  recommendations: [],
  notifications: [],
  quickActions: [],
  metrics: {
    careerScore: 70,
    skillGrowthRate: 60,
    interviewReadiness: 70,
    resumeHealth: 80,
    portfolioHealth: 60,
    jobMatchCount: 1,
    marketFitScore: 50,
    certificationProgress: 0,
    networkingScore: 40,
    learningHoursThisMonth: 10,
    applicationsThisMonth: 2,
    interviewConversionRate: 50,
    overallProgress: 65,
  },
  health: {
    overall: 'healthy',
    services: [{ name: 'career', status: 'healthy', latency: 5 }],
    lastChecked: '',
    warnings: [],
  },
  aiContext: {
    currentFocus: 'Engineer',
    recentActivity: [],
    suggestedQuestions: [],
    contextSummary: '',
  },
};

describe('CareerViewModelFactory', () => {
  it('creates profile view model', () => {
    const f = new CareerViewModelFactory();
    const vm = f.createProfileViewModel(baseSnapshot.profile);
    expect(vm.displayName).toBe('Test');
    expect(vm.currentTitle).toBe('Engineer');
    expect(vm.strengthCount).toBe(1);
    expect(vm.stageLabel).toBe('Mid Career');
  });

  it('creates skill view model', () => {
    const f = new CareerViewModelFactory();
    const vm = f.createSkillViewModel(baseSnapshot.skills.skills, baseSnapshot.gaps);
    expect(vm.totalSkills).toBe(1);
    expect(vm.topSkills).toHaveLength(1);
    expect(vm.learningProgress).toBeGreaterThan(0);
  });

  it('creates roadmap view model', () => {
    const f = new CareerViewModelFactory();
    const vm = f.createRoadmapViewModel(baseSnapshot.roadmap);
    expect(vm.currentStage).toBe('mid');
    expect(vm.milestonesCompleted).toBe(1);
  });

  it('creates resume view model', () => {
    const f = new CareerViewModelFactory();
    const vm = f.createResumeViewModel(baseSnapshot.resume);
    expect(vm.completeness).toBe(80);
    expect(vm.completenessLabel).toBe('Good');
    expect(vm.needsAttention).toBe(false);
  });

  it('creates interview view model', () => {
    const f = new CareerViewModelFactory();
    const vm = f.createInterviewViewModel(baseSnapshot.interview);
    expect(vm.overallScore).toBe(70);
    expect(vm.scoreLabel).toBe('Nearly Ready');
    expect(vm.isReady).toBe(true);
  });

  it('creates job market view model', () => {
    const f = new CareerViewModelFactory();
    const vm = f.createJobMarketViewModel(baseSnapshot.jobs, baseSnapshot.market);
    expect(vm.matchCount).toBe(1);
    expect(vm.topMatchTitle).toBe('Engineer');
    expect(vm.emergingSkills).toContain('AI/ML');
  });

  it('creates dashboard view model', () => {
    const f = new CareerViewModelFactory();
    const vm = f.createDashboardViewModel(baseSnapshot);
    expect(vm.profile).toBeDefined();
    expect(vm.skills).toBeDefined();
    expect(vm.roadmap).toBeDefined();
    expect(vm.resume).toBeDefined();
    expect(vm.interview).toBeDefined();
    expect(vm.jobMarket).toBeDefined();
    expect(vm.lastRefreshed).toBeDefined();
  });

  it('handles empty context in job market', () => {
    const f = new CareerViewModelFactory();
    const vm = f.createJobMarketViewModel([], baseSnapshot.market);
    expect(vm.matchCount).toBe(0);
    expect(vm.topMatchTitle).toBe('No matches yet');
  });
});
