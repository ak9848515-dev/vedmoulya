import { describe, it, expect } from 'vitest';
import { DashboardTimelineService } from '../DashboardTimelineService.js';

describe('DashboardTimelineService', () => {
  let service: DashboardTimelineService;

  beforeEach(() => {
    service = new DashboardTimelineService();
  });

  const recentDate = () => new Date().toISOString();
  const oldDate = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  describe('buildTimeline', () => {
    it('builds timeline from all module data', () => {
      const memories = [
        {
          id: 'mem_1',
          title: 'Memory 1',
          content: 'Content 1',
          category: 'milestone',
          importance: { level: 'high', score: 9 },
          confidence: { level: 'high', score: 0.9 },
          strength: { value: 1, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'manual', detail: 'user' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: recentDate(),
          updatedAt: recentDate(),
        },
      ];

      const decisions = [
        {
          id: 'dec_1',
          title: 'Decision 1',
          description: '',
          category: 'strategic',
          status: 'completed',
          priority: { level: 'high', score: 8 },
          confidence: { level: 'high', score: 0.85 },
          version: '1',
          initiator: 'user',
          options: [],
          evidence: [],
          constraints: [],
          knowledgeNodeIds: [],
          memoryIds: [],
          tags: [],
          createdAt: recentDate(),
          updatedAt: recentDate(),
          completedAt: recentDate(),
        },
      ];

      const plans = [
        {
          id: 'plan_1',
          title: 'Plan 1',
          description: '',
          planningLevel: 'strategic',
          status: 'active',
          priority: { level: 'high', score: 8 },
          progress: { completed: 1, total: 3, percentage: 33 },
          missions: [
            {
              id: 'mis_1',
              label: 'Mission 1',
              description: '',
              status: 'active',
              priority: { level: 'high', score: 7 },
              progress: { completed: 0, total: 1, percentage: 0 },
              tasks: [],
              planId: 'plan_1',
              tags: [],
              createdAt: recentDate(),
              updatedAt: recentDate(),
            },
          ],
          tasks: [
            {
              id: 'task_1',
              label: 'Task 1',
              description: '',
              status: 'completed',
              priority: { level: 'high', score: 7 },
              estimatedDuration: 30,
              progress: { completed: 1, total: 1, percentage: 100 },
              steps: [],
              tags: [],
              planId: 'plan_1',
              createdAt: recentDate(),
              updatedAt: recentDate(),
            },
          ],
          timeline: { entryCount: 2, lastEvent: recentDate() },
          context: {},
          goalReferences: [],
          decisionReferences: [],
          knowledgeNodeIds: [],
          memoryIds: [],
          tags: [],
          createdAt: recentDate(),
          updatedAt: recentDate(),
        },
      ];

      const entries = service.buildTimeline(memories, decisions, plans);
      expect(entries.length).toBeGreaterThanOrEqual(3);
      expect(entries.some((e) => e.type === 'memory')).toBe(true);
      expect(entries.some((e) => e.type === 'decision')).toBe(true);
      expect(entries.some((e) => e.type === 'task')).toBe(true);
      expect(entries.some((e) => e.type === 'mission')).toBe(true);
    });

    it('handles empty data gracefully', () => {
      const entries = service.buildTimeline([], [], []);
      expect(entries).toHaveLength(0);
    });

    it('includes knowledge node entries when recent', () => {
      const now = new Date().toISOString();
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const recentNodes = [
        {
          id: 'kn_1',
          graphId: 'g1',
          label: 'TypeScript Concepts',
          description: 'Advanced TS',
          category: 'programming',
          tags: ['ts', 'advanced'],
          metadata: {},
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'kn_2',
          graphId: 'g1',
          label: 'React Patterns',
          description: 'Design patterns in React',
          category: 'frontend',
          tags: ['react'],
          metadata: {},
          createdAt: now,
          updatedAt: now,
        },
      ];

      const oldNodes = [
        {
          id: 'kn_3',
          graphId: 'g1',
          label: 'Old Concept',
          description: 'Outdated',
          category: 'legacy',
          tags: [],
          metadata: {},
          createdAt: oldDate,
          updatedAt: oldDate,
        },
      ];

      const entries = service.buildTimeline([], [], [], [...recentNodes, ...oldNodes]);
      expect(entries.length).toBe(2); // Only recent nodes included
      expect(entries.every((e) => e.type === 'learning')).toBe(true);
      expect(entries.some((e) => e.title === 'TypeScript Concepts')).toBe(true);
      expect(entries.some((e) => e.title === 'React Patterns')).toBe(true);
      expect(entries.some((e) => e.title === 'Old Concept')).toBe(false);
    });

    it('handles knowledge nodes with category mapping', () => {
      const now = new Date().toISOString();
      const nodes = [
        {
          id: 'kn_1',
          graphId: 'g1',
          label: 'React',
          description: '',
          category: 'frontend',
          tags: ['react'],
          metadata: {},
          createdAt: now,
          updatedAt: now,
        },
      ];
      const entries = service.buildTimeline([], [], [], nodes);
      expect(entries[0]!.icon).toBe('bookmark');
      expect(entries[0]!.importance).toBe(5);
      expect(entries[0]!.metadata).toEqual({ category: 'frontend', tags: ['react'] });
    });

    it('sorts entries by timestamp descending', () => {
      const oldMemories = [
        {
          id: 'mem_1',
          title: 'Old',
          content: '',
          category: 'personal',
          importance: { level: 'low', score: 3 },
          confidence: { level: 'high', score: 0.9 },
          strength: { value: 0.5, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'manual', detail: 'user' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: oldDate(),
          updatedAt: oldDate(),
        },
      ];
      const recentMemories = [
        {
          id: 'mem_2',
          title: 'Recent',
          content: '',
          category: 'personal',
          importance: { level: 'low', score: 3 },
          confidence: { level: 'high', score: 0.9 },
          strength: { value: 0.5, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'manual', detail: 'user' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: recentDate(),
          updatedAt: recentDate(),
        },
      ];

      const entries = service.buildTimeline([...oldMemories, ...recentMemories], [], []);
      expect(entries[0]!.title).toBe('Recent');
    });
  });

  describe('getRecentEntries', () => {
    it('returns entries within time window', () => {
      const entries = [
        {
          id: 'e1',
          type: 'task' as const,
          title: 'Recent',
          description: '',
          timestamp: recentDate(),
          importance: 5,
          icon: 'circle',
        },
        {
          id: 'e2',
          type: 'task' as const,
          title: 'Old',
          description: '',
          timestamp: oldDate(),
          importance: 5,
          icon: 'circle',
        },
      ];
      const recent = service.getRecentEntries(entries, 24);
      expect(recent).toHaveLength(1);
      expect(recent[0]!.title).toBe('Recent');
    });

    it('handles empty entries', () => {
      expect(service.getRecentEntries([])).toHaveLength(0);
    });
  });

  describe('getImportantEntries', () => {
    it('filters by importance threshold', () => {
      const entries = [
        {
          id: 'e1',
          type: 'memory' as const,
          title: 'Important',
          description: '',
          timestamp: '',
          importance: 9,
          icon: 'award',
        },
        {
          id: 'e2',
          type: 'memory' as const,
          title: 'Trivial',
          description: '',
          timestamp: '',
          importance: 3,
          icon: 'file',
        },
      ];
      const important = service.getImportantEntries(entries, 7);
      expect(important).toHaveLength(1);
      expect(important[0]!.title).toBe('Important');
    });
  });

  describe('getEntriesByType', () => {
    it('filters by entry type', () => {
      const entries = [
        {
          id: 'e1',
          type: 'memory' as const,
          title: 'M1',
          description: '',
          timestamp: '',
          importance: 5,
          icon: 'file',
        },
        {
          id: 'e2',
          type: 'decision' as const,
          title: 'D1',
          description: '',
          timestamp: '',
          importance: 5,
          icon: 'scale',
        },
        {
          id: 'e3',
          type: 'memory' as const,
          title: 'M2',
          description: '',
          timestamp: '',
          importance: 5,
          icon: 'file',
        },
      ];
      expect(service.getEntriesByType(entries, 'memory')).toHaveLength(2);
      expect(service.getEntriesByType(entries, 'decision')).toHaveLength(1);
      expect(service.getEntriesByType(entries, 'task')).toHaveLength(0);
    });
  });

  describe('getEntryCounts', () => {
    it('counts entries by type', () => {
      const entries = [
        {
          id: 'e1',
          type: 'memory' as const,
          title: 'M1',
          description: '',
          timestamp: '',
          importance: 5,
          icon: 'file',
        },
        {
          id: 'e2',
          type: 'decision' as const,
          title: 'D1',
          description: '',
          timestamp: '',
          importance: 5,
          icon: 'scale',
        },
        {
          id: 'e3',
          type: 'memory' as const,
          title: 'M2',
          description: '',
          timestamp: '',
          importance: 5,
          icon: 'file',
        },
      ];
      const counts = service.getEntryCounts(entries);
      expect(counts.memory).toBe(2);
      expect(counts.decision).toBe(1);
    });
  });
});
