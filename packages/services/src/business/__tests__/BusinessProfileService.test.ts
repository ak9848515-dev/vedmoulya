import { describe, it, expect } from 'vitest';
import { BusinessProfileService } from '../BusinessProfileService.js';
import type { BusinessProfileDTO } from '../BusinessDTO.js';

describe('BusinessProfileService', () => {
  let svc: BusinessProfileService;
  beforeEach(() => {
    svc = new BusinessProfileService();
  });

  const makeProfile = (userId: string): BusinessProfileDTO => ({
    userId,
    businessName: 'TestBiz',
    businessType: 'llc',
    industry: 'Tech',
    stage: 'startup',
    teamSize: 5,
    description: 'A test business',
    vision: 'To lead',
    mission: 'To innovate',
    coreValues: ['integrity'],
    strengths: ['team'],
    weaknesses: ['funding'],
    updatedAt: new Date().toISOString(),
  });

  it('getProfile returns undefined for unknown user', () => {
    expect(svc.getProfile('unknown')).toBeUndefined();
  });

  it('setProfile stores profile', () => {
    const p = makeProfile('user1');
    svc.setProfile(p);
    expect(svc.getProfile('user1')?.businessName).toBe('TestBiz');
  });

  it('setProfile updates updatedAt', () => {
    const p = makeProfile('user1');
    svc.setProfile(p);
    expect(svc.getProfile('user1')?.updatedAt).toBeTruthy();
  });

  it('updateProfile merges partial updates', () => {
    svc.setProfile(makeProfile('user1'));
    const updated = svc.updateProfile('user1', { businessName: 'NewName' });
    expect(updated.businessName).toBe('NewName');
    expect(updated.industry).toBe('Tech');
  });

  it('updateProfile throws for missing user', () => {
    expect(() => svc.updateProfile('nouser', { businessName: 'x' })).toThrow(
      'Business profile not found',
    );
  });

  it('createGuestProfile creates default profile', () => {
    const p = svc.createGuestProfile('guest1', 'GuestBiz');
    expect(p.userId).toBe('guest1');
    expect(p.businessName).toBe('GuestBiz');
    expect(p.businessType).toBe('sole_proprietorship');
    expect(p.stage).toBe('startup');
    expect(p.teamSize).toBe(1);
  });

  it('createGuestProfile stores profile for retrieval', () => {
    svc.createGuestProfile('guest1', 'GuestBiz');
    expect(svc.getProfile('guest1')?.businessName).toBe('GuestBiz');
  });

  it('deleteProfile removes profile', () => {
    svc.setProfile(makeProfile('user1'));
    svc.deleteProfile('user1');
    expect(svc.getProfile('user1')).toBeUndefined();
  });

  it('deleteProfile is idempotent', () => {
    expect(() => svc.deleteProfile('nouser')).not.toThrow();
  });
});
