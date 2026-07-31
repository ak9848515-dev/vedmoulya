import { describe, it, expect } from 'vitest';
import { LearningProjectService } from '../LearningProjectService.js';
import type { LearningProjectDTO } from '../LearningDTO.js';

function makeProject(overrides: Partial<LearningProjectDTO> = {}): LearningProjectDTO {
  return {
    id: 'proj1',
    title: 'Test Project',
    description: '',
    technologies: [],
    learningGoals: [],
    difficulty: 'beginner',
    estimatedHours: 10,
    completedHours: 0,
    status: 'suggested',
    outcomes: [],
    ...overrides,
  };
}

describe('LearningProjectService', () => {
  it('returns empty for new user', () => {
    const svc = new LearningProjectService();
    expect(svc.getProjects('user1')).toEqual([]);
  });

  it('adds and retrieves a project', () => {
    const svc = new LearningProjectService();
    svc.addProject('user1', makeProject());
    expect(svc.getProjects('user1').length).toBe(1);
  });

  it('getProject returns undefined for missing', () => {
    const svc = new LearningProjectService();
    expect(svc.getProject('user1', 'nope')).toBeUndefined();
  });

  it('updateProject modifies existing', () => {
    const svc = new LearningProjectService();
    svc.addProject('user1', makeProject());
    const updated = svc.updateProject('user1', 'proj1', { title: 'Updated' });
    expect(updated.title).toBe('Updated');
  });

  it('updateProject throws for missing', () => {
    const svc = new LearningProjectService();
    expect(() => svc.updateProject('user1', 'nope', {})).toThrow('not found');
  });

  it('deleteProject removes project', () => {
    const svc = new LearningProjectService();
    svc.addProject('user1', makeProject());
    svc.deleteProject('user1', 'proj1');
    expect(svc.getProjects('user1').length).toBe(0);
  });

  it('getActiveProjects filters in_progress', () => {
    const svc = new LearningProjectService();
    svc.addProject('user1', makeProject({ id: 'p1', status: 'suggested' }));
    svc.addProject('user1', makeProject({ id: 'p2', status: 'in_progress' }));
    expect(svc.getActiveProjects('user1').length).toBe(1);
  });

  it('getSuggestedProjects slices by limit', () => {
    const svc = new LearningProjectService();
    svc.addProject('user1', makeProject({ id: 'p1', status: 'suggested' }));
    svc.addProject('user1', makeProject({ id: 'p2', status: 'suggested' }));
    svc.addProject('user1', makeProject({ id: 'p3', status: 'suggested' }));
    svc.addProject('user1', makeProject({ id: 'p4', status: 'suggested' }));
    expect(svc.getSuggestedProjects('user1', 2).length).toBe(2);
  });
});
