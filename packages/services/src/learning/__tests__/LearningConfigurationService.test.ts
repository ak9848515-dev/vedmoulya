import { describe, it, expect } from 'vitest';
import { LearningConfigurationService } from '../LearningConfigurationService.js';

describe('LearningConfigurationService', () => {
  it('returns default config for new user', () => {
    const svc = new LearningConfigurationService();
    const config = svc.getConfig('user1');
    expect(config.userId).toBe('user1');
    expect(config.weeklyGoalHours).toBe(5);
    expect(config.enableReminders).toBe(true);
    expect(config.assessmentFrequency).toBe('weekly');
  });

  it('returns existing config for returning user', () => {
    const svc = new LearningConfigurationService();
    svc.getConfig('user1');
    const config = svc.getConfig('user1');
    expect(config.userId).toBe('user1');
    expect(config.weeklyGoalHours).toBe(5);
  });

  it('updates config with partial values', () => {
    const svc = new LearningConfigurationService();
    svc.getConfig('user1');
    const updated = svc.updateConfig('user1', { weeklyGoalHours: 10, enableReminders: false });
    expect(updated.weeklyGoalHours).toBe(10);
    expect(updated.enableReminders).toBe(false);
    expect(updated.difficultyPreference).toBe('intermediate');
  });

  it('resetConfig restores defaults', () => {
    const svc = new LearningConfigurationService();
    svc.getConfig('user1');
    svc.updateConfig('user1', { weeklyGoalHours: 20 });
    const reset = svc.resetConfig('user1');
    expect(reset.weeklyGoalHours).toBe(5);
    expect(reset.enableReminders).toBe(true);
  });
});
