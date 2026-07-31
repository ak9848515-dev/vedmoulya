import { describe, it, expect } from 'vitest';
import { BusinessGoalService } from '../BusinessGoalService.js';
import type { BusinessGoalDTO } from '../BusinessDTO.js';

describe('BusinessGoalService', () => {
  let svc: BusinessGoalService;
  beforeEach(() => {
    svc = new BusinessGoalService();
  });

  const makeGoal = (id: string, status: BusinessGoalDTO['status'] = 'active'): BusinessGoalDTO => ({
    id,
    title: `Goal ${id}`,
    description: 'desc',
    category: 'strategic',
    priority: 1,
    progress: 50,
    status,
    kpis: [],
    dependencies: [],
    milestones: [],
    createdAt: new Date().toISOString(),
  });

  it('getGoals returns empty for new user', () => {
    expect(svc.getGoals('user1')).toEqual([]);
  });

  it('addGoal stores goal', () => {
    svc.addGoal('user1', makeGoal('g1'));
    expect(svc.getGoals('user1').length).toBe(1);
  });

  it('getGoal returns specific goal', () => {
    svc.addGoal('user1', makeGoal('g1'));
    const g = svc.getGoal('user1', 'g1');
    expect(g?.title).toBe('Goal g1');
  });

  it('getGoal returns undefined for missing', () => {
    expect(svc.getGoal('user1', 'missing')).toBeUndefined();
  });

  it('updateGoal merges updates', () => {
    svc.addGoal('user1', makeGoal('g1'));
    const updated = svc.updateGoal('user1', 'g1', { progress: 90 });
    expect(updated.progress).toBe(90);
    expect(updated.title).toBe('Goal g1');
  });

  it('updateGoal throws for missing', () => {
    expect(() => svc.updateGoal('user1', 'missing', {})).toThrow('Goal not found');
  });

  it('deleteGoal removes goal', () => {
    svc.addGoal('user1', makeGoal('g1'));
    svc.deleteGoal('user1', 'g1');
    expect(svc.getGoals('user1')).toEqual([]);
  });

  it('getActiveGoals filters by active status', () => {
    svc.addGoal('user1', makeGoal('g1', 'active'));
    svc.addGoal('user1', makeGoal('g2', 'completed'));
    svc.addGoal('user1', makeGoal('g3', 'paused'));
    expect(svc.getActiveGoals('user1').length).toBe(1);
  });

  it('getGoalsByCategory filters by category', () => {
    svc.addGoal('user1', { ...makeGoal('g1'), category: 'financial' });
    svc.addGoal('user1', { ...makeGoal('g2'), category: 'strategic' });
    expect(svc.getGoalsByCategory('user1', 'financial').length).toBe(1);
  });

  it('updateGoalProgress clamps progress to 0-100', () => {
    svc.addGoal('user1', makeGoal('g1'));
    const clamped = svc.updateGoalProgress('user1', 'g1', 150);
    expect(clamped.progress).toBe(100);
    const clamped2 = svc.updateGoalProgress('user1', 'g1', -10);
    expect(clamped2.progress).toBe(0);
  });
});
