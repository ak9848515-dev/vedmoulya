import { describe, it, expect } from 'vitest';
import { LearningMissionService } from '../LearningMissionService.js';

describe('LearningMissionService', () => {
  it('returns empty for new user', () => {
    const svc = new LearningMissionService();
    expect(svc.getMissions('user1')).toEqual([]);
  });

  it('creates and retrieves a mission', () => {
    const svc = new LearningMissionService();
    const m = svc.createMission(
      'user1',
      'Learn React',
      'Build a React app',
      'project',
      ['react', 'jsx'],
      'intermediate',
      20,
      ['Setup', 'Components', 'Deploy'],
    );
    expect(m.title).toBe('Learn React');
    expect(m.status).toBe('available');
    expect(m.milestones.length).toBe(3);
  });

  it('getMission returns undefined for missing', () => {
    const svc = new LearningMissionService();
    expect(svc.getMission('user1', 'nonexistent')).toBeUndefined();
  });

  it('startMission sets status to active', () => {
    const svc = new LearningMissionService();
    const m = svc.createMission('user1', 'Test', 'Desc', 'skill_building', [], 'beginner', 5, [
      'Step1',
    ]);
    const started = svc.startMission('user1', m.id);
    expect(started.status).toBe('active');
    expect(started.startDate).toBeDefined();
  });

  it('completeMission completes the mission', () => {
    const svc = new LearningMissionService();
    const m = svc.createMission('user1', 'Test', 'Desc', 'skill_building', [], 'beginner', 5, [
      'Step1',
    ]);
    const completed = svc.completeMission('user1', m.id);
    expect(completed.status).toBe('completed');
    expect(completed.progress).toBe(100);
  });

  it('updateMilestone updates milestone progress', () => {
    const svc = new LearningMissionService();
    const m = svc.createMission('user1', 'Test', 'Desc', 'challenge', [], 'advanced', 10, [
      'M1',
      'M2',
    ]);
    const updated = svc.updateMilestone('user1', m.id, m.milestones[0].id, 100, 'completed');
    expect(updated.milestones[0].status).toBe('completed');
    expect(updated.progress).toBe(50);
  });

  it('updateMilestone throws for missing mission', () => {
    const svc = new LearningMissionService();
    expect(() => svc.updateMilestone('user1', 'nope', 'm1', 100, 'completed')).toThrow('not found');
  });

  it('getActiveMissions filters active', () => {
    const svc = new LearningMissionService();
    const m = svc.createMission('user1', 'Test', 'Desc', 'exploration', [], 'beginner', 3, ['S1']);
    expect(svc.getActiveMissions('user1').length).toBe(0);
    svc.startMission('user1', m.id);
    expect(svc.getActiveMissions('user1').length).toBe(1);
  });

  it('getAvailableMissions filters available', () => {
    const svc = new LearningMissionService();
    svc.createMission('user1', 'Test', 'Desc', 'exploration', [], 'beginner', 3, ['S1']);
    expect(svc.getAvailableMissions('user1').length).toBe(1);
  });

  it('deleteMission removes mission', () => {
    const svc = new LearningMissionService();
    const m = svc.createMission('user1', 'Test', 'Desc', 'exploration', [], 'beginner', 3, ['S1']);
    svc.deleteMission('user1', m.id);
    expect(svc.getMissions('user1').length).toBe(0);
  });

  it('getCompletedMissions filters completed only', () => {
    const svc = new LearningMissionService();
    const m1 = svc.createMission('user1', 'M1', 'Desc', 'skill_building', [], 'beginner', 5, [
      'Step',
    ]);
    svc.createMission('user1', 'M2', 'Desc', 'exploration', [], 'beginner', 3, ['Step']);
    svc.completeMission('user1', m1.id);
    const completed = svc.getCompletedMissions('user1');
    expect(completed.length).toBe(1);
    expect(completed[0].title).toBe('M1');
  });

  it('updateMission throws for missing mission', () => {
    const svc = new LearningMissionService();
    expect(() => svc.updateMission('user1', 'nope', { title: 'X' })).toThrow('not found');
  });

  it('createMission with empty milestone labels creates no milestones', () => {
    const svc = new LearningMissionService();
    const m = svc.createMission('user1', 'Empty', 'No steps', 'challenge', [], 'advanced', 0, []);
    expect(m.milestones.length).toBe(0);
    expect(m.progress).toBe(0);
  });
});
