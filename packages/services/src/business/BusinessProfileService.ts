// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Profile Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessProfileDTO } from './BusinessDTO.js';

export class BusinessProfileService {
  private readonly profiles = new Map<string, BusinessProfileDTO>();

  getProfile(userId: string): BusinessProfileDTO | undefined {
    return this.profiles.get(userId);
  }

  setProfile(profile: BusinessProfileDTO): void {
    this.profiles.set(profile.userId, { ...profile, updatedAt: new Date().toISOString() });
  }

  updateProfile(userId: string, updates: Partial<BusinessProfileDTO>): BusinessProfileDTO {
    const existing = this.profiles.get(userId);
    if (!existing) throw new Error(`Business profile not found: ${userId}`);
    const updated: BusinessProfileDTO = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(userId, updated);
    return updated;
  }

  createGuestProfile(userId: string, businessName: string): BusinessProfileDTO {
    const profile: BusinessProfileDTO = {
      userId,
      businessName,
      businessType: 'sole_proprietorship',
      industry: 'Technology',
      stage: 'startup',
      teamSize: 1,
      description: '',
      vision: '',
      mission: '',
      coreValues: [],
      strengths: [],
      weaknesses: [],
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  deleteProfile(userId: string): void {
    this.profiles.delete(userId);
  }
}
