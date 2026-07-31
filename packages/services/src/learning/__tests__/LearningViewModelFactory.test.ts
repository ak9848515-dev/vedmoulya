import { describe, it, expect } from 'vitest';
import { LearningViewModelFactory } from '../LearningViewModelFactory.js';
import type {
  LearningProfileDTO,
  LearningPathDTO,
  RevisionScheduleDTO,
  LearningStreakDTO,
  LearningSnapshotDTO,
} from '../LearningDTO.js';

describe('LearningViewModelFactory', () => {
  const factory = new LearningViewModelFactory();

  it('createProfileViewModel maps correctly', () => {
    const profile: LearningProfileDTO = {
      userId: 'u1',
      displayName: 'Test',
      learningStyle: 'visual',
      preferredTopics: ['React'],
      currentLevel: 'intermediate',
      goals: ['Goal1'],
      weeklyGoalHours: 10,
      averageSessionMinutes: 30,
      preferredTimes: ['morning'],
      updatedAt: '2024-01-01',
    };
    const vm = factory.createProfileViewModel(profile);
    expect(vm.displayName).toBe('Test');
    expect(vm.learningStyle).toBe('visual');
    expect(vm.currentLevel).toBe('intermediate');
  });

  it('createPathViewModel handles empty paths', () => {
    const vm = factory.createPathViewModel([]);
    expect(vm.activePaths).toBe(0);
    expect(vm.progress).toBe(0);
    expect(vm.nextTopic).toBe('All topics completed');
    expect(vm.currentPath).toBe('No active path');
  });

  it('createPathViewModel calculates progress correctly', () => {
    const paths: LearningPathDTO[] = [
      {
        id: 'p1',
        title: 'Path1',
        description: '',
        topics: [
          {
            id: 't1',
            name: 'T1',
            description: '',
            estimatedMinutes: 60,
            completedMinutes: 60,
            status: 'completed',
            prerequisites: [],
            resources: [],
            masteryLevel: 100,
          },
          {
            id: 't2',
            name: 'T2',
            description: '',
            estimatedMinutes: 60,
            completedMinutes: 0,
            status: 'pending',
            prerequisites: [],
            resources: [],
            masteryLevel: 0,
          },
        ],
        estimatedHours: 2,
        completedHours: 1,
        difficulty: 'beginner',
        status: 'in_progress',
        source: 'test',
        relevanceScore: 80,
        certifications: [],
      },
    ];
    const vm = factory.createPathViewModel(paths);
    expect(vm.activePaths).toBe(1);
    expect(vm.progress).toBe(50);
    expect(vm.nextTopic).toBe('T2');
  });

  it('createRevisionViewModel handles empty revision', () => {
    const vm = factory.createRevisionViewModel({
      dueToday: [],
      dueThisWeek: [],
      upcoming: [],
      totalForReview: 0,
    });
    expect(vm.dueToday).toBe(0);
    expect(vm.nextRevision).toBe('No pending revisions');
  });

  it('createRevisionViewModel calculates high risk', () => {
    const revision: RevisionScheduleDTO = {
      dueToday: [
        {
          id: 'r1',
          topic: 'a',
          title: 'a',
          dueDate: '',
          importance: 1,
          estimatedMinutes: 10,
          status: 'pending',
          confidence: 30,
          lastReviewed: '',
        },
        {
          id: 'r2',
          topic: 'b',
          title: 'b',
          dueDate: '',
          importance: 1,
          estimatedMinutes: 10,
          status: 'pending',
          confidence: 60,
          lastReviewed: '',
        },
      ],
      dueThisWeek: [],
      upcoming: [],
      totalForReview: 2,
    };
    const vm = factory.createRevisionViewModel(revision);
    expect(vm.highRiskTopics).toBe(1);
    expect(vm.dueToday).toBe(2);
  });

  it('createStreakViewModel shows correct momentum', () => {
    const vm1 = factory.createStreakViewModel({
      current: 0,
      longest: 0,
      weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
      monthlyActiveDays: 0,
      lastActiveDate: '',
    });
    expect(vm1.momentumLabel).toBe('Getting Started');
    expect(vm1.isAtRisk).toBe(true);
    expect(vm1.weeklyActiveDays).toBe(0);

    const vm2 = factory.createStreakViewModel({
      current: 5,
      longest: 5,
      weeklyActivity: [1, 0, 0, 0, 0, 0, 0],
      monthlyActiveDays: 5,
      lastActiveDate: '',
    });
    expect(vm2.momentumLabel).toBe('Building');
    expect(vm2.isAtRisk).toBe(false);

    const vm3 = factory.createStreakViewModel({
      current: 7,
      longest: 7,
      weeklyActivity: [1, 1, 1, 0, 0, 0, 0],
      monthlyActiveDays: 7,
      lastActiveDate: '',
    });
    expect(vm3.momentumLabel).toBe('On Fire!');
  });

  it('createDashboardViewModel builds full view model', () => {
    const snapshot = {
      id: 's1',
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
    } as LearningSnapshotDTO;
    const vm = factory.createDashboardViewModel(snapshot);
    expect(vm.profile.displayName).toBe('Test');
    expect(vm.paths.activePaths).toBe(0);
    expect(vm.lastRefreshed).toBe('2024-01-01');
  });
});
