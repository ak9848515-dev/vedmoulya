import { describe, it, expect } from 'vitest';
import { LearningProgressService } from '../LearningProgressService.js';
import type { SkillProgressDTO } from '../LearningDTO.js';

describe('LearningProgressService', () => {
  it('returns default streak for new user', () => {
    const svc = new LearningProgressService();
    const streak = svc.getStreak('user1');
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(0);
  });

  it('recordActivity increments streak on consecutive days', () => {
    const svc = new LearningProgressService();
    const s1 = svc.recordActivity('user1', 1);
    expect(s1.current).toBe(1);
  });

  it('getSkillProgress returns empty for new user', () => {
    const svc = new LearningProgressService();
    expect(svc.getSkillProgress('user1')).toEqual([]);
  });

  it('updateSkillProgress stores skill', () => {
    const svc = new LearningProgressService();
    const skill: SkillProgressDTO = {
      skillName: 'React',
      category: 'frontend',
      currentLevel: 50,
      targetLevel: 80,
      progress: 50,
    };
    svc.updateSkillProgress('user1', skill);
    const skills = svc.getSkillProgress('user1');
    expect(skills.length).toBe(1);
    expect(skills[0].skillName).toBe('React');
  });

  it('updateSkillProgress overwrites existing skill', () => {
    const svc = new LearningProgressService();
    svc.updateSkillProgress('user1', {
      skillName: 'React',
      category: 'frontend',
      currentLevel: 50,
      targetLevel: 80,
      progress: 50,
    });
    svc.updateSkillProgress('user1', {
      skillName: 'React',
      category: 'frontend',
      currentLevel: 70,
      targetLevel: 80,
      progress: 70,
    });
    expect(svc.getSkillProgress('user1').length).toBe(1);
    expect(svc.getSkillProgress('user1')[0].currentLevel).toBe(70);
  });

  it('updateSkillProgress creates store for new user', () => {
    const svc = new LearningProgressService();
    svc.updateSkillProgress('new_user', {
      skillName: 'Node',
      category: 'backend',
      currentLevel: 30,
      targetLevel: 70,
      progress: 30,
    });
    const skills = svc.getSkillProgress('new_user');
    expect(skills.length).toBe(1);
    expect(skills[0].skillName).toBe('Node');
  });

  it('recordActivity does not increment on same-day call', () => {
    const svc = new LearningProgressService();
    const s1 = svc.recordActivity('user_same', 1);
    expect(s1.current).toBe(1);
    // Second call on same day should not increment (same-day short-circuit)
    const s2 = svc.recordActivity('user_same', 1);
    expect(s2.current).toBe(1);
    expect(s2.weeklyActivity.some((h) => h > 0)).toBe(true);
  });

  it('getStreak returns existing streak for returning user', () => {
    const svc = new LearningProgressService();
    svc.recordActivity('user_ret', 1);
    const streak = svc.getStreak('user_ret');
    expect(streak.current).toBe(1);
  });
});
