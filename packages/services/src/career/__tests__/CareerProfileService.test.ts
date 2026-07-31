import { describe, it, expect } from 'vitest';
import { CareerProfileService } from '../CareerProfileService.js';

describe('CareerProfileService', () => {
  it('returns undefined for missing user', () => {
    expect(new CareerProfileService().getProfile('missing')).toBeUndefined();
  });

  it('creates guest profile', () => {
    const svc = new CareerProfileService();
    const p = svc.createGuestProfile('user1', 'Test User');
    expect(p.userId).toBe('user1');
    expect(p.displayName).toBe('Test User');
    expect(p.currentTitle).toBe('Exploring Careers');
    expect(p.careerStage).toBe('exploring');
  });

  it('stores and retrieves profile', () => {
    const svc = new CareerProfileService();
    const p = svc.createGuestProfile('u1', 'Test');
    const got = svc.getProfile('u1');
    expect(got!.userId).toBe('u1');
  });

  it('setProfile stores a profile', () => {
    const svc = new CareerProfileService();
    const p = svc.createGuestProfile('u1', 'T');
    svc.setProfile({ ...p, summary: 'Hello' });
    expect(svc.getProfile('u1')!.summary).toBe('Hello');
  });

  it('updateProfile modifies existing profile', () => {
    const svc = new CareerProfileService();
    svc.createGuestProfile('u1', 'Test');
    const updated = svc.updateProfile('u1', { currentTitle: 'Senior Dev' });
    expect(updated.currentTitle).toBe('Senior Dev');
  });

  it('updateProfile throws for missing user', () => {
    expect(() => new CareerProfileService().updateProfile('missing', {})).toThrow(
      'Profile not found',
    );
  });

  it('deleteProfile removes profile', () => {
    const svc = new CareerProfileService();
    svc.createGuestProfile('u1', 'Test');
    svc.deleteProfile('u1');
    expect(svc.getProfile('u1')).toBeUndefined();
  });
});
