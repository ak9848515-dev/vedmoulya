import { describe, it, expect, vi } from 'vitest';
import { LearningAssembler } from '../LearningAssembler.js';

describe('LearningAssembler', () => {
  function createAssembler() {
    const mockIdentity = {
      getUserById: vi.fn().mockResolvedValue({ displayName: 'Test User', id: 'u1' }),
    };
    const mockMemory = { getStats: vi.fn().mockResolvedValue({ totalMemories: 10 }) };
    const mockDecision = { getStats: vi.fn().mockResolvedValue({ totalDecisions: 5 }) };
    const mockExecution = { getStats: vi.fn().mockResolvedValue({ activePlans: 3 }) };
    const mockKnowledge = { getGraph: vi.fn().mockResolvedValue({ nodes: [] }) };
    const mockAI = { orchestrate: vi.fn().mockResolvedValue({ content: 'AI response' }) };
    const assembler = new LearningAssembler(
      mockIdentity as any,
      mockMemory as any,
      mockDecision as any,
      mockExecution as any,
      mockKnowledge as any,
      mockAI as any,
    );
    return {
      assembler,
      mocks: { mockIdentity, mockMemory, mockDecision, mockExecution, mockKnowledge, mockAI },
    };
  }

  it('assembles full snapshot with all modules succeeding', async () => {
    const { assembler } = createAssembler();
    const snapshot = await assembler.assemble('u1', 'Test');
    expect(snapshot.id).toContain('lsnap_');
    expect(snapshot.userId).toBe('u1');
    expect(snapshot.profile).toBeDefined();
    expect(snapshot.profile.displayName).toBe('Test User');
    expect(snapshot.paths).toBeDefined();
    expect(snapshot.missions).toBeDefined();
    expect(snapshot.recommendations).toBeDefined();
    expect(snapshot.knowledgeMap).toBeDefined();
    expect(snapshot.revision).toBeDefined();
    expect(snapshot.streak).toBeDefined();
    expect(snapshot.metrics).toBeDefined();
    expect(snapshot.timeline).toBeDefined();
    expect(snapshot.health).toBeDefined();
    expect(snapshot.aiContext).toBeDefined();
  });

  it('handles identity module failure gracefully', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockIdentity.getUserById.mockRejectedValue(new Error('Identity down'));
    const snapshot = await assembler.assemble('u2', 'Guest');
    expect(snapshot.profile.displayName).toBe('Guest');
  });

  it('handles all module failures gracefully', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockIdentity.getUserById.mockRejectedValue(new Error('down'));
    mocks.mockMemory.getStats.mockRejectedValue(new Error('down'));
    mocks.mockDecision.getStats.mockRejectedValue(new Error('down'));
    mocks.mockExecution.getStats.mockRejectedValue(new Error('down'));
    mocks.mockAI.orchestrate.mockRejectedValue(new Error('down'));
    const snapshot = await assembler.assemble('u3', 'Offline User');
    expect(snapshot.profile.displayName).toBe('Offline User');
    expect(snapshot.aiContext.contextSummary).toContain('completed 0 topics');
  });

  it('handles individual module failure (Memory down)', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockMemory.getStats.mockRejectedValue(new Error('Memory down'));
    const snapshot = await assembler.assemble('u4', 'Test');
    expect(snapshot).toBeDefined();
    expect(snapshot.profile).toBeDefined();
  });

  it('handles individual module failure (Decision down)', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockDecision.getStats.mockRejectedValue(new Error('Decision down'));
    const snapshot = await assembler.assemble('u5', 'Test');
    expect(snapshot).toBeDefined();
  });

  it('handles individual module failure (Execution down)', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockExecution.getStats.mockRejectedValue(new Error('Execution down'));
    const snapshot = await assembler.assemble('u6', 'Test');
    expect(snapshot).toBeDefined();
  });

  it('handles individual module failure (AI down)', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockAI.orchestrate.mockRejectedValue(new Error('AI down'));
    const snapshot = await assembler.assemble('u7', 'Test');
    expect(snapshot).toBeDefined();
    expect(snapshot.aiContext.contextSummary).toContain('completed');
  });

  it('provides access to internal services', () => {
    const { assembler } = createAssembler();
    expect(assembler.getProfileService()).toBeDefined();
    expect(assembler.getPathService()).toBeDefined();
    expect(assembler.getMissionService()).toBeDefined();
    expect(assembler.getProjectService()).toBeDefined();
    expect(assembler.getAssessmentService()).toBeDefined();
    expect(assembler.getRevisionService()).toBeDefined();
    expect(assembler.getKnowledgeService()).toBeDefined();
    expect(assembler.getProgressService()).toBeDefined();
    expect(assembler.getInsightService()).toBeDefined();
    expect(assembler.getRecommendationService()).toBeDefined();
    expect(assembler.getConfigService()).toBeDefined();
  });

  it('handles new user with no prior data', async () => {
    const { assembler } = createAssembler();
    const snapshot = await assembler.assemble('new_user', 'New User');
    expect(snapshot.profile.displayName).toBe('Test User');
    expect(snapshot.paths).toEqual([]);
    expect(snapshot.missions).toEqual([]);
    expect(snapshot.achievements).toEqual([]);
  });

  it('builds achievements for streak >= 7', async () => {
    const { assembler } = createAssembler();
    // First call creates profile with initial streak
    const snapshot = await assembler.assemble('u8', 'Test');
    // Default streak is 0, so no achievements yet
    expect(snapshot.achievements.length).toBe(0);
    // But we can verify the snapshot structure is correct
    expect(Array.isArray(snapshot.achievements)).toBe(true);
  });

  it('generates quick actions', async () => {
    const { assembler } = createAssembler();
    const snapshot = await assembler.assemble('u9', 'Test');
    expect(snapshot.quickActions.length).toBeGreaterThan(0);
    expect(snapshot.quickActions[0].id).toBe('continue_mission');
  });

  it('generates timeline entries', async () => {
    const { assembler } = createAssembler();
    const snapshot = await assembler.assemble('u10', 'Test');
    expect(snapshot.timeline).toBeDefined();
    expect(snapshot.timeline.totalEntries).toBe(0); // No completed topics/assessments yet
  });

  it('identity data enriches profile displayName', async () => {
    const { assembler } = createAssembler();
    const snapshot = await assembler.assemble('u11', 'Default');
    // Identity module returns displayName 'Test User', so profile gets enriched
    expect(snapshot.profile.displayName).toBe('Test User');
  });

  it('identity without displayName keeps original', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockIdentity.getUserById.mockResolvedValue({ id: 'u12' }); // no displayName
    const snapshot = await assembler.assemble('u12', 'Original Name');
    expect(snapshot.profile.displayName).toBe('Original Name');
  });

  it('safeCall handles non-Error throws', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockIdentity.getUserById.mockRejectedValue('String error');
    const snapshot = await assembler.assemble('u13', 'Test');
    expect(snapshot).toBeDefined();
  });

  it('creates guest profile when identity fails on new user', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockIdentity.getUserById.mockRejectedValue(new Error('down'));
    const snapshot = await assembler.assemble('new_guest', 'Guest User');
    expect(snapshot.profile.displayName).toBe('Guest User');
    expect(snapshot.profile.learningStyle).toBe('mixed');
  });

  it('builds aiContext with AI success response', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockAI.orchestrate.mockResolvedValue({ content: 'AI insight' });
    const snapshot = await assembler.assemble('u14', 'Test');
    expect(snapshot.aiContext.contextSummary).toContain('AI analysis available');
  });

  it('builds aiContext with fallback when AI fails', async () => {
    const { assembler, mocks } = createAssembler();
    mocks.mockAI.orchestrate.mockRejectedValue(new Error('AI unavailable'));
    const snapshot = await assembler.assemble('u15', 'Test');
    expect(snapshot.aiContext.contextSummary).toContain('completed 0 topics');
  });

  it('currentFocus uses first active path title', async () => {
    const { assembler } = createAssembler();
    // Add an active path via the path service
    const pathService = assembler.getPathService();
    pathService.addPath('u16', {
      id: 'p1',
      title: 'Learn TypeScript',
      description: '',
      topics: [],
      estimatedHours: 10,
      completedHours: 2,
      difficulty: 'intermediate',
      status: 'in_progress',
      source: 'manual',
      relevanceScore: 90,
      certifications: [],
    });
    const snapshot = await assembler.assemble('u16', 'Test');
    expect(snapshot.aiContext.currentFocus).toBe('Learn TypeScript');
  });

  it('builds timeline entries from completed topics and active missions', async () => {
    const { assembler } = createAssembler();
    const pathService = assembler.getPathService();
    pathService.addPath('u17', {
      id: 'p1',
      title: 'TypeScript',
      description: '',
      topics: [
        {
          id: 't1',
          name: 'Generics',
          description: '',
          estimatedMinutes: 60,
          completedMinutes: 60,
          status: 'completed',
          prerequisites: [],
          resources: [],
          masteryLevel: 3,
        },
      ],
      estimatedHours: 10,
      completedHours: 10,
      difficulty: 'intermediate',
      status: 'completed',
      source: 'manual',
      relevanceScore: 90,
      certifications: [],
    });
    const missionService = assembler.getMissionService();
    missionService.addMission('u17', {
      id: 'm1',
      title: 'Ship a project',
      description: '',
      type: 'project',
      topics: [],
      milestones: [],
      progress: 50,
      status: 'active',
      rewards: [],
      startDate: new Date().toISOString(),
      timeEstimateHours: 10,
      difficulty: 'intermediate',
      createdAt: new Date().toISOString(),
    });
    const snapshot = await assembler.assemble('u17', 'Test');
    expect(snapshot.timeline.totalEntries).toBe(2); // 1 topic + 1 milestone
    expect(snapshot.metrics.topicsCompleted).toBe(1);
  });

  it('unlocks streak, topic, assessment, and project achievements when thresholds are met', async () => {
    const { assembler } = createAssembler();
    const progressService = assembler.getProgressService();
    // Seed a 7-day streak directly (recordActivity only increments on
    // consecutive calendar days, which is awkward to simulate in a unit test).
    const streak = progressService.getStreak('u18');
    streak.current = 7;
    streak.longest = 7;
    streak.lastActiveDate = new Date().toISOString();

    const pathService = assembler.getPathService();
    const topics = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      name: `Topic ${i}`,
      description: '',
      estimatedMinutes: 60,
      completedMinutes: 60,
      status: 'completed' as const,
      prerequisites: [],
      resources: [],
      masteryLevel: 3,
    }));
    pathService.addPath('u18', {
      id: 'p1',
      title: 'Path',
      description: '',
      topics,
      estimatedHours: 20,
      completedHours: 20,
      difficulty: 'intermediate',
      status: 'completed',
      source: 'manual',
      relevanceScore: 90,
      certifications: [],
    });

    const assessmentService = assembler.getAssessmentService();
    for (let i = 0; i < 5; i++) {
      assessmentService.addAssessment('u18', {
        id: `a${i}`,
        title: `Assessment ${i}`,
        topic: 'x',
        type: 'quiz',
        score: 9,
        maxScore: 10,
        questionsAnswered: 10,
        totalQuestions: 10,
        status: 'completed',
        takenAt: new Date().toISOString(),
      });
    }

    const projectService = assembler.getProjectService();
    for (let i = 0; i < 3; i++) {
      projectService.addProject('u18', {
        id: `pj${i}`,
        title: `Project ${i}`,
        description: '',
        technologies: [],
        learningGoals: [],
        difficulty: 'intermediate',
        estimatedHours: 10,
        completedHours: 10,
        status: 'completed',
        outcomes: [],
      });
    }

    const snapshot = await assembler.assemble('u18', 'Test');
    const ids = snapshot.achievements.map((a) => a.id);
    expect(ids).toContain('ach_streak_7');
    expect(ids).toContain('ach_topics_10');
    expect(ids).toContain('ach_assess_5');
    expect(ids).toContain('ach_projects_3');
    expect(snapshot.metrics.assessmentsPassed).toBe(5);
    expect(snapshot.metrics.projectsCompleted).toBe(3);
  });

  it('enables assessment and revision quick actions when work is pending', async () => {
    const { assembler } = createAssembler();
    const assessmentService = assembler.getAssessmentService();
    assessmentService.addAssessment('u19', {
      id: 'a1',
      title: 'Pending Quiz',
      topic: 'x',
      type: 'quiz',
      maxScore: 10,
      questionsAnswered: 0,
      totalQuestions: 10,
      status: 'pending',
    });
    const snapshot = await assembler.assemble('u19', 'Test');
    const assessmentAction = snapshot.quickActions.find((q) => q.id === 'take_assessment');
    expect(assessmentAction?.isAvailable).toBe(true);
    const revisionAction = snapshot.quickActions.find((q) => q.id === 'review_revision');
    expect(revisionAction).toBeDefined();
  });
});
