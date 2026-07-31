// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Configuration Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CareerConfigDTO } from './CareerDTO.js';

const DEFAULT_CONFIG: Omit<CareerConfigDTO, 'userId'> = {
  preferredIndustries: [],
  jobSearchActive: false,
  openToOpportunities: true,
  skillAssessmentFrequency: 'monthly',
  resumeAutoAnalyze: true,
  interviewPracticeReminders: true,
  marketInsightsFrequency: 'weekly',
  notificationPreferences: ['info', 'warning', 'reminder'],
};

export class CareerConfigurationService {
  private readonly configs = new Map<string, CareerConfigDTO>();

  getConfig(userId: string): CareerConfigDTO {
    const existing = this.configs.get(userId);
    if (existing) return existing;
    const config: CareerConfigDTO = { userId, ...DEFAULT_CONFIG };
    this.configs.set(userId, config);
    return config;
  }

  updateConfig(userId: string, updates: Partial<CareerConfigDTO>): CareerConfigDTO {
    const current = this.getConfig(userId);
    const updated: CareerConfigDTO = { ...current, ...updates };
    this.configs.set(userId, updated);
    return updated;
  }

  resetConfig(userId: string): CareerConfigDTO {
    const config: CareerConfigDTO = { userId, ...DEFAULT_CONFIG };
    this.configs.set(userId, config);
    return config;
  }
}
