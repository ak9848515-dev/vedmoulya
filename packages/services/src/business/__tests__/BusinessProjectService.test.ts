import { describe, it, expect } from 'vitest';
import { BusinessProjectService } from '../BusinessProjectService.js';
import type { BusinessProjectDTO } from '../BusinessDTO.js';

describe('BusinessProjectService', () => {
  let svc: BusinessProjectService;
  beforeEach(() => {
    svc = new BusinessProjectService();
  });

  const makeProject = (
    id: string,
    status: BusinessProjectDTO['status'] = 'planned',
    priority: BusinessProjectDTO['priority'] = 'medium',
  ): BusinessProjectDTO => ({
    id,
    title: `Project ${id}`,
    description: 'desc',
    category: 'development',
    priority,
    status,
    progress: 0,
    owner: 'me',
    team: [],
    budget: 0,
    spent: 0,
    resources: [],
    risks: [],
    dependencies: [],
    deliverables: [],
  });

  it('getProjects returns empty for new user', () => {
    expect(svc.getProjects('user1')).toEqual([]);
  });

  it('addProject stores project', () => {
    svc.addProject('user1', makeProject('p1'));
    expect(svc.getProjects('user1').length).toBe(1);
  });

  it('getProject returns specific project', () => {
    svc.addProject('user1', makeProject('p1'));
    expect(svc.getProject('user1', 'p1')?.title).toBe('Project p1');
  });

  it('updateProject merges updates', () => {
    svc.addProject('user1', makeProject('p1'));
    const u = svc.updateProject('user1', 'p1', { progress: 75 });
    expect(u.progress).toBe(75);
  });

  it('updateProject throws for missing', () => {
    expect(() => svc.updateProject('user1', 'missing', {})).toThrow('Project not found');
  });

  it('deleteProject removes', () => {
    svc.addProject('user1', makeProject('p1'));
    svc.deleteProject('user1', 'p1');
    expect(svc.getProjects('user1')).toEqual([]);
  });

  it('getActiveProjects filters in_progress', () => {
    svc.addProject('user1', makeProject('p1', 'in_progress'));
    svc.addProject('user1', makeProject('p2', 'planned'));
    expect(svc.getActiveProjects('user1').length).toBe(1);
  });

  it('getBlockedProjects filters blocked', () => {
    svc.addProject('user1', makeProject('p1', 'blocked'));
    svc.addProject('user1', makeProject('p2', 'in_progress'));
    expect(svc.getBlockedProjects('user1').length).toBe(1);
  });

  it('getProjectsByPriority sorts by priority order', () => {
    svc.addProject('user1', makeProject('low', 'planned', 'low'));
    svc.addProject('user1', makeProject('critical', 'planned', 'critical'));
    svc.addProject('user1', makeProject('high', 'planned', 'high'));
    const sorted = svc.getProjectsByPriority('user1');
    expect(sorted[0].id).toBe('critical');
    expect(sorted[1].id).toBe('high');
    expect(sorted[2].id).toBe('low');
  });

  it('getProjectsByPriority handles unknown priority', () => {
    svc.addProject('user1', {
      ...makeProject('p1', 'planned', 'medium'),
      priority: 'unknown' as 'medium',
    });
    svc.addProject('user1', { ...makeProject('p2', 'planned', 'medium'), priority: 'critical' });
    // Unknown priority sorts to the end with ?? 99 fallback
    const sorted = svc.getProjectsByPriority('user1');
    expect(sorted.length).toBe(2);
  });
});
