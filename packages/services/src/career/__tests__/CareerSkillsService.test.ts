import { describe, it, expect } from 'vitest';
import { CareerSkillsService } from '../CareerSkillsService.js';

const mockSkill = (
  id: string,
  name: string,
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master' = 'intermediate',
) => ({
  id,
  name,
  category: 'technical' as const,
  level,
  yearsOfExperience: 2,
  confidence: 0.8,
  certifications: [],
  projects: [],
  endorsements: 0,
  isVerified: false,
  isFavorite: false,
});

describe('CareerSkillsService', () => {
  it('returns empty skills for new user', () => {
    expect(new CareerSkillsService().getSkills('u1')).toHaveLength(0);
  });

  it('adds and retrieves skills', () => {
    const svc = new CareerSkillsService();
    svc.addSkill('u1', mockSkill('s1', 'TypeScript', 'advanced'));
    expect(svc.getSkills('u1')).toHaveLength(1);
  });

  it('getSkill returns specific skill', () => {
    const svc = new CareerSkillsService();
    svc.addSkill('u1', mockSkill('s1', 'TS'));
    expect(svc.getSkill('u1', 's1')!.name).toBe('TS');
  });

  it('updateSkill modifies skill', () => {
    const svc = new CareerSkillsService();
    svc.addSkill('u1', mockSkill('s1', 'TS'));
    svc.updateSkill('u1', 's1', { level: 'expert' });
    expect(svc.getSkill('u1', 's1')!.level).toBe('expert');
  });

  it('updateSkill throws for missing', () => {
    expect(() => new CareerSkillsService().updateSkill('u1', 'missing', {})).toThrow(
      'Skill not found',
    );
  });

  it('removeSkill deletes skill', () => {
    const svc = new CareerSkillsService();
    svc.addSkill('u1', mockSkill('s1', 'TS'));
    svc.removeSkill('u1', 's1');
    expect(svc.getSkills('u1')).toHaveLength(0);
  });

  it('getSkillsByCategory filters correctly', () => {
    const svc = new CareerSkillsService();
    svc.addSkill('u1', { ...mockSkill('s1', 'TS'), category: 'technical' });
    svc.addSkill('u1', { ...mockSkill('s2', 'Comm'), category: 'communication' });
    expect(svc.getSkillsByCategory('u1', 'technical')).toHaveLength(1);
    expect(svc.getSkillsByCategory('u1', 'communication')).toHaveLength(1);
  });

  it('getSkillsByLevel filters correctly', () => {
    const svc = new CareerSkillsService();
    svc.addSkill('u1', mockSkill('s1', 'TS', 'advanced'));
    svc.addSkill('u1', mockSkill('s2', 'JS', 'beginner'));
    expect(svc.getSkillsByLevel('u1', 'advanced')).toHaveLength(1);
  });

  it('getTopSkills returns highest level skills sorted', () => {
    const svc = new CareerSkillsService();
    svc.addSkill('u1', mockSkill('s1', 'Low', 'beginner'));
    svc.addSkill('u1', mockSkill('s2', 'High', 'expert'));
    const top = svc.getTopSkills('u1', 1);
    expect(top).toHaveLength(1);
    expect(top[0]!.name).toBe('High');
  });

  it('getSkillInventory returns inventory with count', () => {
    const svc = new CareerSkillsService();
    svc.addSkill('u1', mockSkill('s1', 'TS'));
    const inv = svc.getSkillInventory('u1');
    expect(inv.totalCount).toBe(1);
    expect(inv.skills).toHaveLength(1);
  });
});
