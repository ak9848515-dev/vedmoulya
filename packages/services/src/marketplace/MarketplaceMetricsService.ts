// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Metrics Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceMetricsDTO } from './MarketplaceDTO.js';

export class MarketplaceMetricsService {
  calculateMarketplaceScore(components: {
    catalogCompleteness: number;
    installationSuccessRate: number;
    compatibilityScore: number;
    averageRating: number;
    providerHealth: number;
    updateCoverage: number;
  }): number {
    return Math.round(
      (components.catalogCompleteness * 0.2 +
        components.installationSuccessRate * 0.2 +
        components.compatibilityScore * 0.15 +
        components.averageRating * 0.15 +
        components.providerHealth * 0.15 +
        components.updateCoverage * 0.15) *
        10,
    );
  }

  aggregate(components: {
    totalAssets: number;
    installedCount: number;
    activeCount: number;
    availableUpdates: number;
    providerCount: number;
    templateCount: number;
    packCount: number;
    averageRating: number;
    totalDownloads: number;
    compatibilityScore: number;
    installationSuccessRate: number;
    catalogCompleteness: number;
    providerHealth: number;
    updateCoverage: number;
  }): MarketplaceMetricsDTO {
    const overallHealth = this.calculateMarketplaceScore(components);
    return {
      totalAssets: components.totalAssets,
      installedCount: components.installedCount,
      activeCount: components.activeCount,
      availableUpdates: components.availableUpdates,
      providerCount: components.providerCount,
      templateCount: components.templateCount,
      packCount: components.packCount,
      averageRating: components.averageRating,
      totalDownloads: components.totalDownloads,
      compatibilityScore: components.compatibilityScore,
      installationSuccessRate: components.installationSuccessRate,
      overallHealth,
    };
  }
}
