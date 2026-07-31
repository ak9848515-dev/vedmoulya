// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Profile Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CareerProfileDTO } from './CareerDTO.js';

export class CareerProfileService {
  private readonly profiles = new Map<string, CareerProfileDTO>();

  getProfile(userId: string): CareerProfileDTO | undefined {
    return this.profiles.get(userId);
  }

  setProfile(profile: CareerProfileDTO): void {
    this.profiles.set(profile.userId, { ...profile, updatedAt: new Date().toISOString() });
  }

  updateProfile(userId: string, updates: Partial<CareerProfileDTO>): CareerProfileDTO {
    const existing = this.profiles.get(userId);
    if (!existing) throw new Error(`Profile not found for user: ${userId}`);
    const updated: CareerProfileDTO = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(userId, updated);
    return updated;
  }

  createGuestProfile(userId: string, displayName: string): CareerProfileDTO {
    const profile: CareerProfileDTO = {
      userId,
      displayName,
      email: '',
      currentTitle: 'Exploring Careers',
      industry: 'Technology',
      yearsOfExperience: 0,
      summary: '',
      strengths: [],
      growthAreas: ['Discover your professional strengths'],
      careerStage: 'exploring',
      preferredLocations: [],
      openToRelocation: false,
      openToRemote: true,
      employmentType: ['full-time'],
      socialLinks: [],
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  deleteProfile(userId: string): void {
    this.profiles.delete(userId);
  }
}
