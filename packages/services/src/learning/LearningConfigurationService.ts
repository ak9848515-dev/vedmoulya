// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Configuration Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningConfigDTO } from './LearningDTO.js';

const DEFAULT_CONFIG: Omit<LearningConfigDTO, 'userId'> = {
  weeklyGoalHours: 5,
  preferredTimes: ['morning'],
  learningStyle: 'mixed',
  difficultyPreference: 'intermediate',
  enableReminders: true,
  revisionReminders: true,
  projectSuggestions: true,
  assessmentFrequency: 'weekly',
  preferredTopics: [],
  notificationPreferences: ['info', 'warning', 'reminder'],
};

export class LearningConfigurationService {
  private readonly configs = new Map<string, LearningConfigDTO>();

  getConfig(userId: string): LearningConfigDTO {
    const existing = this.configs.get(userId);
    if (existing) return existing;
    const config: LearningConfigDTO = { userId, ...DEFAULT_CONFIG };
    this.configs.set(userId, config);
    return config;
  }

  updateConfig(userId: string, updates: Partial<LearningConfigDTO>): LearningConfigDTO {
    const current = this.getConfig(userId);
    const updated: LearningConfigDTO = { ...current, ...updates };
    this.configs.set(userId, updated);
    return updated;
  }

  resetConfig(userId: string): LearningConfigDTO {
    const config: LearningConfigDTO = { userId, ...DEFAULT_CONFIG };
    this.configs.set(userId, config);
    return config;
  }
}
