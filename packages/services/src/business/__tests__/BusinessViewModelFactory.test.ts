import { describe, it, expect } from 'vitest';
import { BusinessViewModelFactory } from '../BusinessViewModelFactory.js';
import type {
  BusinessSnapshotDTO,
  BusinessProfileDTO,
  BusinessKPIDTO,
  BusinessRiskDTO,
  BusinessMilestoneDTO,
  BusinessTimelineEntryDTO,
} from '../BusinessDTO.js';

describe('BusinessViewModelFactory', () => {
  let factory: BusinessViewModelFactory;
  beforeEach(() => {
    factory = new BusinessViewModelFactory();
  });

  const makeProfile = (): BusinessProfileDTO => ({
    userId: 'u1',
    businessName: 'TestBiz',
    businessType: 'llc',
    industry: 'Tech',
    stage: 'startup',
    teamSize: 5,
    description: 'desc',
    vision: 'To lead',
    mission: 'To innovate',
    coreValues: [],
    strengths: ['team'],
    weaknesses: ['funding'],
    updatedAt: new Date().toISOString(),
  });

  it('createProfileViewModel maps fields', () => {
    const p = makeProfile();
    const vm = factory.createProfileViewModel(p);
    expect(vm.businessName).toBe('TestBiz');
    expect(vm.stage).toBe('startup');
    expect(vm.strengths).toEqual(['team']);
    expect(vm.weaknesses).toEqual(['funding']);
  });

  it('createKPIViewModel with empty KPIs', () => {
    const vm = factory.createKPIViewModel([]);
    expect(vm.totalKpis).toBe(0);
    expect(vm.averageAchievement).toBe(0);
    expect(vm.topPerformer).toBe('N/A');
    expect(vm.needsAttention).toBe('N/A');
  });

  it('createKPIViewModel computes stats', () => {
    const kpis: BusinessKPIDTO[] = [
      {
        id: 'k1',
        name: 'Revenue',
        description: 'rev',
        category: 'revenue',
        currentValue: 100,
        targetValue: 100,
        unit: '$',
        trend: 'up',
        period: 'monthly',
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'k2',
        name: 'Cost',
        description: 'cost',
        category: 'cost',
        currentValue: 30,
        targetValue: 100,
        unit: '$',
        trend: 'down',
        period: 'monthly',
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'k3',
        name: 'Profit',
        description: 'profit',
        category: 'profit',
        currentValue: 80,
        targetValue: 100,
        unit: '%',
        trend: 'stable',
        period: 'monthly',
        lastUpdated: new Date().toISOString(),
      },
    ];
    const vm = factory.createKPIViewModel(kpis);
    expect(vm.totalKpis).toBe(3);
    expect(vm.onTarget).toBe(1);
    expect(vm.atRisk).toBe(1);
    expect(vm.topPerformer).toBe('Revenue');
    expect(vm.needsAttention).toBe('Cost');
  });

  it('createRiskViewModel with empty risks', () => {
    const vm = factory.createRiskViewModel([]);
    expect(vm.totalRisks).toBe(0);
    expect(vm.averageScore).toBe(0);
    expect(vm.topRisk).toBe('No risks identified');
    expect(vm.hasCriticalRisks).toBe(false);
  });

  it('createRiskViewModel computes stats', () => {
    const risks: BusinessRiskDTO[] = [
      {
        id: 'r1',
        title: 'High Risk',
        description: 'desc',
        category: 'financial',
        likelihood: 5,
        impact: 5,
        riskScore: 25,
        status: 'identified',
        mitigationPlan: 'plan',
        owner: 'me',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'r2',
        title: 'Low Risk',
        description: 'desc',
        category: 'operational',
        likelihood: 1,
        impact: 1,
        riskScore: 1,
        status: 'identified',
        mitigationPlan: 'plan',
        owner: 'me',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const vm = factory.createRiskViewModel(risks);
    expect(vm.totalRisks).toBe(2);
    expect(vm.criticalCount).toBe(1);
    expect(vm.highCount).toBe(0);
    expect(vm.averageScore).toBe(13);
    expect(vm.topRisk).toBe('High Risk');
    expect(vm.hasCriticalRisks).toBe(true);
  });

  it('createDashboardViewModel builds full VM', () => {
    const timestamp = new Date().toISOString();
    const snapshot: BusinessSnapshotDTO = {
      id: 'snap1',
      userId: 'u1',
      generatedAt: timestamp,
      ttl: 300_000,
      profile: makeProfile(),
      vision: 'To lead',
      mission: 'To innovate',
      goals: [],
      strategies: [],
      projects: [],
      kpis: [],
      finance: {
        revenue: {
          currentPeriod: 0,
          previousPeriod: 0,
          budgeted: 0,
          variance: 0,
          trend: 'stable',
          items: [],
        },
        expenses: {
          currentPeriod: 0,
          previousPeriod: 0,
          budgeted: 0,
          variance: 0,
          trend: 'stable',
          items: [],
        },
        cashFlow: {
          operating: 0,
          investing: 0,
          financing: 0,
          netCashFlow: 0,
          beginningBalance: 0,
          endingBalance: 0,
        },
        profitability: {
          grossMargin: 0,
          netMargin: 0,
          operatingMargin: 0,
          ebitda: 0,
          revenue: 0,
          costOfGoodsSold: 0,
          operatingExpenses: 0,
        },
        currency: 'USD',
        fiscalYear: '2024',
        lastUpdated: timestamp,
      },
      risks: [],
      opportunities: [],
      execution: {
        currentPriorities: [],
        delayedWork: [],
        completedWork: [],
        blockedItems: [],
        recommendedActions: [],
        velocity: 0,
        completionRate: 0,
        onTrackTasks: 0,
        delayedTasks: 0,
        completedTasks: 0,
      },
      milestones: [],
      timeline: { entries: [], totalEntries: 0, hasMore: false },
      insights: [],
      recommendations: [],
      notifications: [],
      quickActions: [],
      metrics: {
        businessScore: 500,
        revenueHealth: 80,
        expenseEfficiency: 70,
        profitability: 60,
        growthRate: 50,
        projectSuccessRate: 90,
        kpiAchievementRate: 85,
        riskExposure: 20,
        opportunityValue: 75,
        executionVelocity: 65,
        goalProgress: 70,
        overallProgress: 75,
      },
      health: { overall: 'healthy', services: [], lastChecked: timestamp, warnings: [] },
      aiContext: {
        currentFocus: 'Test',
        recentActivity: [],
        suggestedQuestions: [],
        contextSummary: 'Summary',
      },
    };
    const vm = factory.createDashboardViewModel(snapshot);
    expect(vm.profile.businessName).toBe('TestBiz');
    expect(vm.metrics.businessScore).toBe(500);
    expect(vm.lastRefreshed).toBe(timestamp);
    expect(vm.health.overall).toBe('healthy');
  });
});
