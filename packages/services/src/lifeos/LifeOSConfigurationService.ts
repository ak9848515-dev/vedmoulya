// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Configuration Service
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSConfigDTO, LifeOSModule } from './LifeOSDTO.js';

const DEFAULT_CONFIG: Omit<LifeOSConfigDTO, 'userId'> = {
  enabledModules: ['dashboard', 'career', 'learning', 'business', 'marketplace'],
  timelineDefaultFilter: 'week',
  notificationPriorityThreshold: 3,
  maxRecommendations: 10,
  enableCrossDomainInsights: true,
  enableGlobalSearch: true,
  cacheTTL: 300_000,
  refreshInterval: 60_000,
};

export class LifeOSConfigurationService {
  private readonly configs = new Map<string, LifeOSConfigDTO>();

  getConfig(userId: string): LifeOSConfigDTO {
    const existing = this.configs.get(userId);
    if (existing) return existing;
    const config: LifeOSConfigDTO = { userId, ...DEFAULT_CONFIG };
    this.configs.set(userId, config);
    return config;
  }

  updateConfig(userId: string, updates: Partial<LifeOSConfigDTO>): LifeOSConfigDTO {
    const current = this.getConfig(userId);
    const updated: LifeOSConfigDTO = { ...current, ...updates };
    this.configs.set(userId, updated);
    return updated;
  }

  resetConfig(userId: string): LifeOSConfigDTO {
    const config: LifeOSConfigDTO = { userId, ...DEFAULT_CONFIG };
    this.configs.set(userId, config);
    return config;
  }

  isModuleEnabled(userId: string, module: LifeOSModule): boolean {
    return this.getConfig(userId).enabledModules.includes(module);
  }
}
