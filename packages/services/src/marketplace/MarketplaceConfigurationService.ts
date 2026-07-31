// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Configuration Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceConfigDTO } from './MarketplaceDTO.js';

const DEFAULT_CONFIG: Omit<MarketplaceConfigDTO, 'userId'> = {
  autoUpdate: true,
  autoUpdatePolicies: {
    enabled: false,
    onlyStable: true,
    scheduledDay: 'weekly',
    excludeAssets: [],
  },
  notifyOnUpdates: true,
  notifyOnInstall: true,
  allowBetaVersions: false,
  allowCommunityAssets: true,
  preferredProviders: [],
  cacheTTL: 300_000,
  registryUrl: 'https://marketplace.vedmoulya.com/api/v1',
};

export class MarketplaceConfigurationService {
  private readonly configs = new Map<string, MarketplaceConfigDTO>();

  getConfig(userId: string): MarketplaceConfigDTO {
    const existing = this.configs.get(userId);
    if (existing) return existing;
    const config: MarketplaceConfigDTO = { userId, ...DEFAULT_CONFIG };
    this.configs.set(userId, config);
    return config;
  }

  updateConfig(userId: string, updates: Partial<MarketplaceConfigDTO>): MarketplaceConfigDTO {
    const current = this.getConfig(userId);
    const updated: MarketplaceConfigDTO = { ...current, ...updates };
    this.configs.set(userId, updated);
    return updated;
  }

  resetConfig(userId: string): MarketplaceConfigDTO {
    const config: MarketplaceConfigDTO = { userId, ...DEFAULT_CONFIG };
    this.configs.set(userId, config);
    return config;
  }
}
