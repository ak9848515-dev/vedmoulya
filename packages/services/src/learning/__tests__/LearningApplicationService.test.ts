import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LearningApplicationService } from '../LearningApplicationService.js';
import { LearningAssembler } from '../LearningAssembler.js';

vi.mock('../LearningAssembler.js');

describe('LearningApplicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  function createService() {
    const mockIdentity = {
      getUserById: vi.fn().mockResolvedValue({ displayName: 'Test', id: 'u1' }),
    };
    const mockMemory = { getStats: vi.fn().mockResolvedValue({ totalMemories: 10 }) };
    const mockDecision = { getStats: vi.fn().mockResolvedValue({ totalDecisions: 5 }) };
    const mockExecution = { getStats: vi.fn().mockResolvedValue({ activePlans: 3 }) };
    const mockKnowledge = { getGraph: vi.fn().mockResolvedValue({ nodes: [] }) };
    const mockAI = { orchestrate: vi.fn().mockResolvedValue({ content: 'AI response' }) };
    const svc = new LearningApplicationService(
      mockIdentity as any,
      mockMemory as any,
      mockDecision as any,
      mockExecution as any,
      mockKnowledge as any,
      mockAI as any,
    );
    return {
      svc,
      mocks: { mockIdentity, mockMemory, mockDecision, mockExecution, mockKnowledge, mockAI },
    };
  }

  it('constructs successfully', () => {
    const { svc } = createService();
    expect(svc).toBeInstanceOf(LearningApplicationService);
  });

  it('getLearning returns snapshot', async () => {
    const { svc } = createService();
    vi.mocked(LearningAssembler.prototype.assemble).mockResolvedValue({
      id: 'snap1',
      userId: 'u1',
      generatedAt: new Date().toISOString(),
      ttl: 300_000,
      profile: {
        userId: 'u1',
        displayName: 'Test',
        learningStyle: 'visual',
        preferredTopics: [],
        currentLevel: 'beginner',
        goals: [],
        weeklyGoalHours: 5,
        averageSessionMinutes: 30,
        preferredTimes: ['morning'],
        updatedAt: '',
      },
      goals: [],
      missions: [],
      paths: [],
      recommendations: [],
      knowledgeMap: { nodes: [], edges: [], lastUpdated: '' },
      skillProgress: [],
      projects: [],
      assessments: [],
      revision: { dueToday: [], dueThisWeek: [], upcoming: [], totalForReview: 0 },
      streak: {
        current: 0,
        longest: 0,
        weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
        monthlyActiveDays: 0,
        lastActiveDate: '',
      },
      retention: [],
      achievements: [],
      insights: [],
      timeline: { entries: [], totalEntries: 0, hasMore: false },
      notifications: [],
      metrics: {
        learningScore: 0,
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
        overallProgress: 0,
      },
      health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      quickActions: [],
      aiContext: {
        currentFocus: '',
        recentActivity: [],
        suggestedQuestions: [],
        contextSummary: '',
      },
    } as any);
    const result = await svc.getLearning('u1');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('getLearning returns cached result on second call', async () => {
    const { svc } = createService();
    vi.mocked(LearningAssembler.prototype.assemble).mockResolvedValue({
      id: 'snap1',
      userId: 'u1',
      generatedAt: new Date().toISOString(),
      ttl: 300_000,
      profile: {
        userId: 'u1',
        displayName: 'Test',
        learningStyle: 'visual',
        preferredTopics: [],
        currentLevel: 'beginner',
        goals: [],
        weeklyGoalHours: 5,
        averageSessionMinutes: 30,
        preferredTimes: ['morning'],
        updatedAt: '',
      },
      goals: [],
      missions: [],
      paths: [],
      recommendations: [],
      knowledgeMap: { nodes: [], edges: [], lastUpdated: '' },
      skillProgress: [],
      projects: [],
      assessments: [],
      revision: { dueToday: [], dueThisWeek: [], upcoming: [], totalForReview: 0 },
      streak: {
        current: 0,
        longest: 0,
        weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
        monthlyActiveDays: 0,
        lastActiveDate: '',
      },
      retention: [],
      achievements: [],
      insights: [],
      timeline: { entries: [], totalEntries: 0, hasMore: false },
      notifications: [],
      metrics: {
        learningScore: 0,
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
        overallProgress: 0,
      },
      health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      quickActions: [],
      aiContext: {
        currentFocus: '',
        recentActivity: [],
        suggestedQuestions: [],
        contextSummary: '',
      },
    } as any);
    await svc.getLearning('u1');
    const result = await svc.getLearning('u1');
    expect(result.success).toBe(true);
    expect(result.latency).toBeLessThan(10);
  });

  it('getLearning returns error on failure', async () => {
    const { svc } = createService();
    vi.mocked(LearningAssembler.prototype.assemble).mockRejectedValue(new Error('Assembly failed'));
    const result = await svc.getLearning('u1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Assembly failed');
  });

  it('getLearningViewModel returns view model', async () => {
    const { svc } = createService();
    vi.mocked(LearningAssembler.prototype.assemble).mockResolvedValue({
      id: 'snap1',
      userId: 'u1',
      generatedAt: '2024-01-01',
      ttl: 300_000,
      profile: {
        userId: 'u1',
        displayName: 'Test',
        learningStyle: 'visual',
        preferredTopics: [],
        currentLevel: 'beginner',
        goals: [],
        weeklyGoalHours: 5,
        averageSessionMinutes: 30,
        preferredTimes: ['morning'],
        updatedAt: '',
      },
      goals: [],
      missions: [],
      paths: [],
      recommendations: [],
      knowledgeMap: { nodes: [], edges: [], lastUpdated: '' },
      skillProgress: [],
      projects: [],
      assessments: [],
      revision: { dueToday: [], dueThisWeek: [], upcoming: [], totalForReview: 0 },
      streak: {
        current: 0,
        longest: 0,
        weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
        monthlyActiveDays: 0,
        lastActiveDate: '',
      },
      retention: [],
      achievements: [],
      insights: [],
      timeline: { entries: [], totalEntries: 0, hasMore: false },
      notifications: [],
      metrics: {
        learningScore: 0,
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
        overallProgress: 0,
      },
      health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      quickActions: [],
      aiContext: {
        currentFocus: '',
        recentActivity: [],
        suggestedQuestions: [],
        contextSummary: '',
      },
    } as any);
    const result = await svc.getLearningViewModel('u1');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('getConfig returns config', () => {
    const { svc } = createService();
    const config = svc.getConfig('u1');
    expect(config.userId).toBe('u1');
  });

  it('updateConfig updates config', () => {
    const { svc } = createService();
    const updated = svc.updateConfig('u1', { weeklyGoalHours: 15 });
    expect(updated.weeklyGoalHours).toBe(15);
  });

  it('resetConfig resets to defaults', () => {
    const { svc } = createService();
    svc.updateConfig('u1', { weeklyGoalHours: 100 });
    const reset = svc.resetConfig('u1');
    expect(reset.weeklyGoalHours).toBe(5);
  });

  it('invalidateCache clears cache', async () => {
    const { svc } = createService();
    vi.mocked(LearningAssembler.prototype.assemble).mockResolvedValue({
      id: 'snap1',
      userId: 'u1',
      generatedAt: '2024-01-01',
      ttl: 300_000,
      profile: {
        userId: 'u1',
        displayName: 'Test',
        learningStyle: 'visual',
        preferredTopics: [],
        currentLevel: 'beginner',
        goals: [],
        weeklyGoalHours: 5,
        averageSessionMinutes: 30,
        preferredTimes: ['morning'],
        updatedAt: '',
      },
      goals: [],
      missions: [],
      paths: [],
      recommendations: [],
      knowledgeMap: { nodes: [], edges: [], lastUpdated: '' },
      skillProgress: [],
      projects: [],
      assessments: [],
      revision: { dueToday: [], dueThisWeek: [], upcoming: [], totalForReview: 0 },
      streak: {
        current: 0,
        longest: 0,
        weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
        monthlyActiveDays: 0,
        lastActiveDate: '',
      },
      retention: [],
      achievements: [],
      insights: [],
      timeline: { entries: [], totalEntries: 0, hasMore: false },
      notifications: [],
      metrics: {
        learningScore: 0,
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
        overallProgress: 0,
      },
      health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      quickActions: [],
      aiContext: {
        currentFocus: '',
        recentActivity: [],
        suggestedQuestions: [],
        contextSummary: '',
      },
    } as any);
    await svc.getLearning('u1');
    svc.invalidateCache('u1');
    // Should call assemble again
    await svc.getLearning('u1');
    expect(vi.mocked(LearningAssembler.prototype.assemble)).toHaveBeenCalledTimes(2);
  });

  it('reportServiceHealth and isHealthy work', () => {
    const { svc } = createService();
    expect(svc.isHealthy()).toBe(false);
    svc.reportServiceHealth('test', 'healthy', 5);
    expect(svc.isHealthy()).toBe(true);
  });

  it('getAnalytics returns initial state', () => {
    const { svc } = createService();
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBe(0);
  });
});
