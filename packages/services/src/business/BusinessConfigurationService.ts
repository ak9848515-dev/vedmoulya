// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Configuration Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessConfigDTO } from './BusinessDTO.js';

const DEFAULT_CONFIG: Omit<BusinessConfigDTO, 'userId'> = {
  businessName: '',
  fiscalYearStart: '2024-01-01',
  currency: 'USD',
  kpiUpdateFrequency: 'monthly',
  riskReviewFrequency: 'monthly',
  enableNotifications: true,
  enableRiskAlerts: true,
  enableOpportunityAlerts: true,
  reportingPeriod: 'monthly',
  notificationPreferences: ['info', 'warning', 'reminder'],
};

export class BusinessConfigurationService {
  private readonly configs = new Map<string, BusinessConfigDTO>();

  getConfig(userId: string): BusinessConfigDTO {
    const existing = this.configs.get(userId);
    if (existing) return existing;
    const config: BusinessConfigDTO = { userId, ...DEFAULT_CONFIG };
    this.configs.set(userId, config);
    return config;
  }

  updateConfig(userId: string, updates: Partial<BusinessConfigDTO>): BusinessConfigDTO {
    const current = this.getConfig(userId);
    const updated: BusinessConfigDTO = { ...current, ...updates };
    this.configs.set(userId, updated);
    return updated;
  }

  resetConfig(userId: string): BusinessConfigDTO {
    const config: BusinessConfigDTO = { userId, ...DEFAULT_CONFIG };
    this.configs.set(userId, config);
    return config;
  }
}
