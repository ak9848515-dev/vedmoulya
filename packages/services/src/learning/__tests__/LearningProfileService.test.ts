import { describe, it, expect } from 'vitest';
import { LearningProfileService } from '../LearningProfileService.js';

describe('LearningProfileService', () => {
  it('returns undefined for missing profile', () => {
    const svc = new LearningProfileService();
    expect(svc.getProfile('nonexistent')).toBeUndefined();
  });

  it('creates guest profile', () => {
    const svc = new LearningProfileService();
    const profile = svc.createGuestProfile('user1', 'Test User');
    expect(profile.userId).toBe('user1');
    expect(profile.displayName).toBe('Test User');
    expect(profile.learningStyle).toBe('mixed');
    expect(profile.currentLevel).toBe('beginner');
  });

  it('sets and retrieves profile', () => {
    const svc = new LearningProfileService();
    const profile = svc.createGuestProfile('user1', 'Test');
    svc.setProfile({ ...profile, weeklyGoalHours: 10 });
    const retrieved = svc.getProfile('user1');
    expect(retrieved?.weeklyGoalHours).toBe(10);
  });

  it('updateProfile throws for non-existent user', () => {
    const svc = new LearningProfileService();
    expect(() => svc.updateProfile('nonexistent', { displayName: 'New' })).toThrow('not found');
  });

  it('updateProfile merges updates', () => {
    const svc = new LearningProfileService();
    svc.createGuestProfile('user1', 'Original');
    const updated = svc.updateProfile('user1', { displayName: 'Updated', weeklyGoalHours: 15 });
    expect(updated.displayName).toBe('Updated');
    expect(updated.weeklyGoalHours).toBe(15);
    expect(updated.currentLevel).toBe('beginner');
  });

  it('deleteProfile removes profile', () => {
    const svc = new LearningProfileService();
    svc.createGuestProfile('user1', 'Test');
    svc.deleteProfile('user1');
    expect(svc.getProfile('user1')).toBeUndefined();
  });
});
