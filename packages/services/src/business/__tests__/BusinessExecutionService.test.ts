import { describe, it, expect } from 'vitest';
import { BusinessExecutionService } from '../BusinessExecutionService.js';
import type { BusinessProjectDTO } from '../BusinessDTO.js';

describe('BusinessExecutionService', () => {
  let svc: BusinessExecutionService;
  beforeEach(() => {
    svc = new BusinessExecutionService();
  });

  const makeProj = (
    id: string,
    status: BusinessProjectDTO['status'],
    priority: BusinessProjectDTO['priority'] = 'medium',
    progress: number = 0,
    targetDate?: string,
  ): BusinessProjectDTO => ({
    id,
    title: `Proj ${id}`,
    description: 'desc',
    category: 'dev',
    priority,
    status,
    progress,
    owner: 'me',
    team: [],
    budget: 0,
    spent: 0,
    resources: [],
    risks: [],
    dependencies: [],
    deliverables: [],
    ...(targetDate ? { targetDate } : {}),
  });

  it('getExecution returns default for new user', () => {
    const e = svc.getExecution('user1');
    expect(e.currentPriorities).toEqual([]);
    expect(e.velocity).toBe(0);
    expect(e.completionRate).toBe(0);
  });

  it('getExecution returns existing for returning user', () => {
    const first = svc.getExecution('user1');
    const second = svc.getExecution('user1');
    expect(second).toBe(first);
  });

  it('analyzeExecution with no projects', () => {
    const e = svc.analyzeExecution('user1', []);
    expect(e.velocity).toBe(0);
    expect(e.completionRate).toBe(0);
    expect(e.completedTasks).toBe(0);
  });

  it('analyzeExecution sorts active projects by priority', () => {
    const projects = [
      makeProj('p1', 'in_progress', 'low'),
      makeProj('p2', 'in_progress', 'critical'),
      makeProj('p3', 'in_progress', 'high'),
    ];
    const e = svc.analyzeExecution('user1', projects);
    expect(e.currentPriorities).toEqual(['Proj p2', 'Proj p3', 'Proj p1']);
    expect(e.onTrackTasks).toBe(3);
  });

  it('analyzeExecution identifies blocked projects', () => {
    const projects = [makeProj('p1', 'blocked'), makeProj('p2', 'in_progress')];
    const e = svc.analyzeExecution('user1', projects);
    expect(e.blockedItems).toEqual(['Proj p1']);
    expect(e.recommendedActions.some((a) => a.includes('blockers'))).toBe(true);
  });

  it('analyzeExecution identifies delayed projects', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const projects = [makeProj('p1', 'in_progress', 'high', 50, pastDate)];
    const e = svc.analyzeExecution('user1', projects);
    expect(e.delayedWork.length).toBe(1);
    expect(e.delayedTasks).toBe(1);
  });

  it('analyzeExecution identifies completed projects', () => {
    const projects = [makeProj('p1', 'completed'), makeProj('p2', 'in_progress')];
    const e = svc.analyzeExecution('user1', projects);
    expect(e.completedWork).toEqual(['Proj p1']);
    expect(e.completedTasks).toBe(1);
    expect(e.completionRate).toBe(50);
  });

  it('analyzeExecution computes velocity', () => {
    const projects = [
      { ...makeProj('p1', 'in_progress'), progress: 80 },
      { ...makeProj('p2', 'in_progress'), progress: 60 },
    ];
    const e = svc.analyzeExecution('user1', projects);
    expect(e.velocity).toBe(70);
  });

  it('analyzeExecution generates recommended actions', () => {
    const projects = [makeProj('p1', 'blocked'), makeProj('p2', 'in_progress')];
    const e = svc.analyzeExecution('user1', projects);
    expect(e.recommendedActions.length).toBeGreaterThanOrEqual(2);
    expect(e.recommendedActions[0]).toContain('blockers');
    expect(e.recommendedActions[1]).toContain('Proj p2');
  });

  it('generateRecommendedActions handles singular blocked', () => {
    const projects = [makeProj('p1', 'blocked')];
    const e = svc.analyzeExecution('user1', projects);
    expect(e.recommendedActions[0]).toContain('1 blocked project');
  });

  it('analyzeExecution with no active projects sets velocity to 0', () => {
    const projects = [makeProj('p1', 'planned')];
    const e = svc.analyzeExecution('user1', projects);
    expect(e.velocity).toBe(0);
    expect(e.completionRate).toBe(0);
  });

  it('analyzeExecution with one completed project sets completionRate to 100', () => {
    const e = svc.analyzeExecution('user1', [makeProj('p1', 'completed')]);
    expect(e.completionRate).toBe(100);
  });

  it('analyzeExecution with no projects at all returns zero values', () => {
    const e = svc.analyzeExecution('user1', []);
    expect(e.velocity).toBe(0);
    expect(e.completionRate).toBe(0);
    expect(e.currentPriorities).toEqual([]);
    expect(e.delayedWork).toEqual([]);
  });
});
