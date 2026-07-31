import { describe, it, expect } from 'vitest';
import { LearningPathService } from '../LearningPathService.js';
import type { LearningPathDTO } from '../LearningDTO.js';

function makePath(overrides: Partial<LearningPathDTO> = {}): LearningPathDTO {
  return {
    id: 'path1',
    title: 'Test Path',
    description: '',
    topics: [],
    estimatedHours: 10,
    completedHours: 0,
    difficulty: 'beginner',
    status: 'not_started',
    source: 'manual',
    relevanceScore: 80,
    certifications: [],
    ...overrides,
  };
}

describe('LearningPathService', () => {
  it('returns empty for new user', () => {
    const svc = new LearningPathService();
    expect(svc.getPaths('user1')).toEqual([]);
  });

  it('adds and retrieves a path', () => {
    const svc = new LearningPathService();
    svc.addPath('user1', makePath());
    expect(svc.getPaths('user1').length).toBe(1);
  });

  it('getPath returns undefined for missing', () => {
    const svc = new LearningPathService();
    expect(svc.getPath('user1', 'nonexistent')).toBeUndefined();
  });

  it('updatePath modifies existing path', () => {
    const svc = new LearningPathService();
    svc.addPath('user1', makePath());
    const updated = svc.updatePath('user1', 'path1', { title: 'Updated' });
    expect(updated.title).toBe('Updated');
  });

  it('updatePath throws for missing path', () => {
    const svc = new LearningPathService();
    expect(() => svc.updatePath('user1', 'nope', {})).toThrow('not found');
  });

  it('deletePath removes path', () => {
    const svc = new LearningPathService();
    svc.addPath('user1', makePath());
    svc.deletePath('user1', 'path1');
    expect(svc.getPaths('user1').length).toBe(0);
  });

  it('getActivePaths filters in_progress', () => {
    const svc = new LearningPathService();
    svc.addPath('user1', makePath({ id: 'p1', status: 'not_started' }));
    svc.addPath('user1', makePath({ id: 'p2', status: 'in_progress' }));
    svc.addPath('user1', makePath({ id: 'p3', status: 'completed' }));
    expect(svc.getActivePaths('user1').length).toBe(1);
  });

  it('getRecommendedPaths sorts by relevance and limits', () => {
    const svc = new LearningPathService();
    svc.addPath('user1', makePath({ id: 'p1', status: 'not_started', relevanceScore: 50 }));
    svc.addPath('user1', makePath({ id: 'p2', status: 'not_started', relevanceScore: 90 }));
    svc.addPath('user1', makePath({ id: 'p3', status: 'not_started', relevanceScore: 70 }));
    const recs = svc.getRecommendedPaths('user1', 2);
    expect(recs.length).toBe(2);
    expect(recs[0].relevanceScore).toBe(90);
    expect(recs[1].relevanceScore).toBe(70);
  });

  it('updateTopicProgress returns undefined for missing path', () => {
    const svc = new LearningPathService();
    expect(svc.updateTopicProgress('user1', 'nopath', 'topic1', 10)).toBeUndefined();
  });

  it('updateTopicProgress returns undefined for missing topic', () => {
    const svc = new LearningPathService();
    svc.addPath(
      'user1',
      makePath({
        topics: [
          {
            id: 't1',
            name: 'T1',
            description: '',
            estimatedMinutes: 60,
            completedMinutes: 0,
            status: 'pending',
            prerequisites: [],
            resources: [],
            masteryLevel: 0,
          },
        ],
      }),
    );
    expect(svc.updateTopicProgress('user1', 'path1', 'notopic', 10)).toBeUndefined();
  });

  it('updateTopicProgress completes topic when minutes met', () => {
    const svc = new LearningPathService();
    svc.addPath(
      'user1',
      makePath({
        topics: [
          {
            id: 't1',
            name: 'T1',
            description: '',
            estimatedMinutes: 60,
            completedMinutes: 0,
            status: 'pending',
            prerequisites: [],
            resources: [],
            masteryLevel: 0,
          },
        ],
      }),
    );
    const topic = svc.updateTopicProgress('user1', 'path1', 't1', 60);
    expect(topic?.status).toBe('completed');
    expect(topic?.masteryLevel).toBeGreaterThan(0);
  });

  it('updateTopicProgress sets in_progress for partial completion', () => {
    const svc = new LearningPathService();
    svc.addPath(
      'user1',
      makePath({
        topics: [
          {
            id: 't1',
            name: 'T1',
            description: '',
            estimatedMinutes: 60,
            completedMinutes: 0,
            status: 'pending',
            prerequisites: [],
            resources: [],
            masteryLevel: 0,
          },
        ],
      }),
    );
    const topic = svc.updateTopicProgress('user1', 'path1', 't1', 30);
    expect(topic?.status).toBe('in_progress');
  });

  it('updateTopicProgress completes path when all topics done', () => {
    const svc = new LearningPathService();
    svc.addPath(
      'user1',
      makePath({
        id: 'p_complete',
        status: 'in_progress',
        topics: [
          {
            id: 't1',
            name: 'T1',
            description: '',
            estimatedMinutes: 60,
            completedMinutes: 0,
            status: 'pending',
            prerequisites: [],
            resources: [],
            masteryLevel: 0,
          },
        ],
      }),
    );
    svc.updateTopicProgress('user1', 'p_complete', 't1', 60);
    const path = svc.getPath('user1', 'p_complete');
    expect(path?.status).toBe('completed');
  });

  it('getRecommendedPaths returns empty when no not_started paths', () => {
    const svc = new LearningPathService();
    svc.addPath('user1', makePath({ id: 'p1', status: 'in_progress' }));
    const recs = svc.getRecommendedPaths('user1');
    expect(recs.length).toBe(0);
  });
});
