// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Profile Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningProfileDTO } from './LearningDTO.js';

export class LearningProfileService {
  private readonly profiles = new Map<string, LearningProfileDTO>();

  getProfile(userId: string): LearningProfileDTO | undefined {
    return this.profiles.get(userId);
  }

  setProfile(profile: LearningProfileDTO): void {
    this.profiles.set(profile.userId, { ...profile, updatedAt: new Date().toISOString() });
  }

  updateProfile(userId: string, updates: Partial<LearningProfileDTO>): LearningProfileDTO {
    const existing = this.profiles.get(userId);
    if (!existing) throw new Error(`Learning profile not found: ${userId}`);
    const updated: LearningProfileDTO = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(userId, updated);
    return updated;
  }

  createGuestProfile(userId: string, displayName: string): LearningProfileDTO {
    const profile: LearningProfileDTO = {
      userId,
      displayName,
      learningStyle: 'mixed',
      preferredTopics: [],
      currentLevel: 'beginner',
      goals: [],
      weeklyGoalHours: 5,
      averageSessionMinutes: 30,
      preferredTimes: ['morning'],
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  deleteProfile(userId: string): void {
    this.profiles.delete(userId);
  }
}
