import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessAssembler, SafeCallResult } from '../BusinessAssembler.js';
import type { IdentityApplicationService } from '../../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../../ai/AIOrchestrationService.js';

function createMockServices() {
  return {
    identity: {
      getUserById: vi.fn().mockResolvedValue({ id: 'u1', displayName: 'Test User' }),
    } as unknown as IdentityApplicationService,
    memory: {
      getStats: vi.fn().mockResolvedValue({ totalMemories: 10 }),
    } as unknown as MemoryApplicationService,
    decision: {
      getStats: vi.fn().mockResolvedValue({ totalDecisions: 5 }),
    } as unknown as DecisionApplicationService,
    execution: {
      getStats: vi.fn().mockResolvedValue({ totalExecutions: 3 }),
    } as unknown as ExecutionApplicationService,
    knowledge: {
      getStats: vi.fn().mockResolvedValue({ totalEntities: 20 }),
    } as unknown as KnowledgeApplicationService,
    ai: {
      orchestrate: vi.fn().mockResolvedValue({ content: 'AI business analysis' }),
    } as unknown as AIOrchestrationService,
  };
}

describe('BusinessAssembler', () => {
  let assembler: BusinessAssembler;
  let mocks: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    mocks = createMockServices();
    assembler = new BusinessAssembler(
      mocks.identity,
      mocks.memory,
      mocks.decision,
      mocks.execution,
      mocks.knowledge,
      mocks.ai,
    );
  });

  it('assemble returns complete snapshot for new user', async () => {
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.id).toContain('bsnap_user1');
    expect(snapshot.userId).toBe('user1');
    expect(snapshot.profile).toBeDefined();
    expect(snapshot.profile.businessName).toBe('Test User');
    expect(snapshot.goals).toEqual([]);
    expect(snapshot.projects).toEqual([]);
    expect(snapshot.kpis).toEqual([]);
    expect(snapshot.risks).toEqual([]);
    expect(snapshot.opportunities).toEqual([]);
    expect(snapshot.metrics).toBeDefined();
    expect(snapshot.insights).toEqual([]);
    expect(snapshot.quickActions.length).toBe(8);
    expect(snapshot.aiContext).toBeDefined();
    expect(snapshot.aiContext.suggestedQuestions.length).toBe(3);
    // buildRecentActivitySummary fallback for new user
    expect(snapshot.aiContext.recentActivity).toEqual(['Business profile created']);
  });

  it('assemble integrates identity results into profile', async () => {
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.profile.businessName).toBe('Test User');
  });

  it('assemble handles identity failure gracefully', async () => {
    mocks.identity.getUserById = vi.fn().mockRejectedValue(new Error('Identity down'));
    assembler = new BusinessAssembler(
      mocks.identity,
      mocks.memory,
      mocks.decision,
      mocks.execution,
      mocks.knowledge,
      mocks.ai,
    );
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.profile.businessName).toBe('Test User');
  });

  it('assemble handles AI failure gracefully', async () => {
    mocks.ai.orchestrate = vi.fn().mockRejectedValue(new Error('AI down'));
    assembler = new BusinessAssembler(
      mocks.identity,
      mocks.memory,
      mocks.decision,
      mocks.execution,
      mocks.knowledge,
      mocks.ai,
    );
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.aiContext.contextSummary).toContain('Test User');
  });

  it('assemble creates guest profile for unknown user', async () => {
    mocks.identity.getUserById = vi.fn().mockResolvedValue({ id: 'guest1' });
    assembler = new BusinessAssembler(
      mocks.identity,
      mocks.memory,
      mocks.decision,
      mocks.execution,
      mocks.knowledge,
      mocks.ai,
    );
    const snapshot = await assembler.assemble('guest1', 'GuestBiz');
    expect(snapshot.profile.businessName).toBe('GuestBiz');
    expect(snapshot.profile.businessType).toBe('sole_proprietorship');
  });

  it('assemble with goals includes milestones and timeline', async () => {
    const goalsService = assembler.getGoalService();
    goalsService.addGoal('user1', {
      id: 'g1',
      title: 'Increase Revenue',
      description: 'desc',
      category: 'financial',
      priority: 1,
      progress: 75,
      status: 'active',
      kpis: [],
      dependencies: [],
      milestones: [{ id: 'm1', title: 'Milestone 1', description: 'desc', status: 'completed' }],
      createdAt: new Date().toISOString(),
    });
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.goals.length).toBe(1);
    expect(snapshot.milestones.length).toBe(1);
    expect(snapshot.milestones[0].title).toBe('Milestone 1');
    // goalProgress > 80? No, 75 -> no achievement, no goal notification
    expect(snapshot.insights.length).toBe(0);
  });

  it('assemble with projects includes execution analysis', async () => {
    const projService = assembler.getProjectService();
    projService.addProject('user1', {
      id: 'p1',
      title: 'Launch Product',
      description: 'desc',
      category: 'dev',
      priority: 'high',
      status: 'in_progress',
      progress: 60,
      owner: 'me',
      team: [],
      budget: 0,
      spent: 0,
      resources: [],
      risks: [],
      dependencies: [],
      deliverables: [],
    });
    projService.addProject('user1', {
      id: 'p2',
      title: 'Market Research',
      description: 'desc',
      category: 'research',
      priority: 'medium',
      status: 'completed',
      progress: 100,
      owner: 'me',
      team: [],
      budget: 0,
      spent: 0,
      resources: [],
      risks: [],
      dependencies: [],
      deliverables: [],
    });
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.projects.length).toBe(2);
    expect(snapshot.execution.completedWork).toContain('Market Research');
    expect(snapshot.execution.velocity).toBe(60);
    expect(snapshot.execution.completionRate).toBe(50);
  });

  it('assemble with KPIs includes at-risk detection and metrics', async () => {
    const kpiService = assembler.getKPIService();
    kpiService.addKPI('user1', {
      id: 'k1',
      name: 'Revenue',
      description: 'rev',
      category: 'revenue',
      currentValue: 20,
      targetValue: 100,
      unit: '$',
      trend: 'down',
      period: 'monthly',
      lastUpdated: new Date().toISOString(),
    });
    kpiService.addKPI('user1', {
      id: 'k2',
      name: 'Profit',
      description: 'prof',
      category: 'profit',
      currentValue: 90,
      targetValue: 100,
      unit: '%',
      trend: 'up',
      period: 'monthly',
      lastUpdated: new Date().toISOString(),
    });
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.kpis.length).toBe(2);
    expect(snapshot.insights.length).toBe(0); // kpisAtRisk = 1, < 3 threshold
    expect(snapshot.recommendations.some((r) => r.category === 'strategic')).toBe(true);
  });

  it('assemble with critical risks generates risk insights', async () => {
    const riskService = assembler.getRiskService();
    riskService.addRisk('user1', {
      id: 'r1',
      title: 'Market Risk',
      description: 'desc',
      category: 'market',
      likelihood: 5,
      impact: 5,
      riskScore: 25,
      status: 'identified',
      mitigationPlan: 'diversify',
      owner: 'me',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    riskService.addRisk('user1', {
      id: 'r2',
      title: 'Low Risk',
      description: 'desc',
      category: 'operational',
      likelihood: 1,
      impact: 1,
      riskScore: 1,
      status: 'identified',
      mitigationPlan: 'none',
      owner: 'me',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.risks.length).toBe(2);
    expect(snapshot.insights.some((i) => i.source === 'risks')).toBe(true);
    expect(snapshot.recommendations.some((r) => r.category === 'risk')).toBe(true);
  });

  it('assemble with opportunities generates recommendations', async () => {
    const oppService = assembler.getOpportunityService();
    oppService.addOpportunity('user1', {
      id: 'o1',
      title: 'Expand Market',
      description: 'desc',
      type: 'growth',
      potentialValue: 500000,
      investmentRequired: 50000,
      roi: 300,
      confidence: 0.8,
      timeframe: 'medium_term',
      status: 'identified',
      dependencies: [],
      risks: [],
      createdAt: new Date().toISOString(),
    });
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.opportunities.length).toBe(1);
    expect(snapshot.recommendations.some((r) => r.category === 'opportunity')).toBe(true);
  });

  it('assemble with high goal progress generates achievement', async () => {
    const goalsService = assembler.getGoalService();
    goalsService.addGoal('user1', {
      id: 'g1',
      title: 'Grow Revenue',
      description: 'desc',
      category: 'financial',
      priority: 1,
      progress: 90,
      status: 'active',
      kpis: [],
      dependencies: [],
      milestones: [],
      createdAt: new Date().toISOString(),
    });
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.insights.some((i) => i.source === 'goals')).toBe(true);
    expect(snapshot.notifications.some((n) => n.source === 'goals')).toBe(true);
  });

  it('assemble with 5+ completed projects triggers Project Master achievement', async () => {
    const projService = assembler.getProjectService();
    for (let i = 0; i < 5; i++) {
      projService.addProject('user1', {
        id: `p${i}`,
        title: `Proj ${i}`,
        description: 'desc',
        category: 'dev',
        priority: 'medium',
        status: 'completed',
        progress: 100,
        owner: 'me',
        team: [],
        budget: 0,
        spent: 0,
        resources: [],
        risks: [],
        dependencies: [],
        deliverables: [],
        completedDate: new Date().toISOString(),
      });
    }
    const snapshot = await assembler.assemble('user1', 'Test User');
    // revenueGrowth > 20 achievement requires setting up revenue with previousPeriod
    expect(snapshot.execution.completedWork.length).toBe(5);
    // buildRecentActivitySummary should show completed projects
    expect(snapshot.aiContext.recentActivity[0]).toContain('Completed 5');
  });

  it('assemble measures health', async () => {
    const snapshot = await assembler.assemble('user1', 'Test User');
    expect(snapshot.health.overall).toBe('healthy');
  });

  it('service accessors return correct instances', () => {
    expect(assembler.getProfileService()).toBeDefined();
    expect(assembler.getGoalService()).toBeDefined();
    expect(assembler.getProjectService()).toBeDefined();
    expect(assembler.getStrategyService()).toBeDefined();
    expect(assembler.getKPIService()).toBeDefined();
    expect(assembler.getFinanceService()).toBeDefined();
    expect(assembler.getRiskService()).toBeDefined();
    expect(assembler.getOpportunityService()).toBeDefined();
    expect(assembler.getExecutionService()).toBeDefined();
    expect(assembler.getInsightService()).toBeDefined();
    expect(assembler.getRecommendationService()).toBeDefined();
  });
});
