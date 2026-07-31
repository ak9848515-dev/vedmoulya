// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace ViewModel Factory
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type {
  MarketplaceSnapshotDTO,
  MarketplaceAssetDTO,
  MarketplaceProviderDTO,
  MarketplaceMetricsDTO,
  MarketplaceHealthIndicatorDTO,
  MarketplaceRecommendationDTO,
  MarketplaceNotificationDTO,
  QuickActionDTO,
  MarketplaceTimelineDTO,
  MarketplaceInstallationDTO,
} from './MarketplaceDTO.js';

export interface CatalogViewModel {
  totalAssets: number;
  categoriesCount: number;
  featuredCount: number;
  popularCount: number;
  recentAdditions: number;
}

export interface AssetHealthViewModel {
  totalInstalled: number;
  activeCount: number;
  updateCount: number;
  installSuccessRate: number;
}

export interface ProviderSummaryViewModel {
  totalProviders: number;
  activeProviders: number;
  errorRate: number;
  hasDefaultProvider: boolean;
}

export interface MarketplaceDashboardViewModel {
  catalog: CatalogViewModel;
  assets: AssetHealthViewModel;
  providers: ProviderSummaryViewModel;
  installedAssets: MarketplaceAssetDTO[];
  providersList: MarketplaceProviderDTO[];
  installations: MarketplaceInstallationDTO[];
  metrics: MarketplaceMetricsDTO;
  timeline: MarketplaceTimelineDTO;
  recommendations: MarketplaceRecommendationDTO[];
  notifications: MarketplaceNotificationDTO[];
  quickActions: QuickActionDTO[];
  health: MarketplaceHealthIndicatorDTO;
  lastRefreshed: string;
}

export class MarketplaceViewModelFactory {
  createCatalogViewModel(snapshot: MarketplaceSnapshotDTO): CatalogViewModel {
    return {
      totalAssets: snapshot.catalog.totalAssets,
      categoriesCount: snapshot.catalog.categories.length,
      featuredCount: snapshot.catalog.featured.length,
      popularCount: snapshot.catalog.popular.length,
      recentAdditions: snapshot.catalog.recent.length,
    };
  }

  createAssetHealthViewModel(snapshot: MarketplaceSnapshotDTO): AssetHealthViewModel {
    return {
      totalInstalled: snapshot.installedAssets.length,
      activeCount: snapshot.installedAssets.filter((a) => a.isActive).length,
      updateCount: snapshot.availableUpdates.length,
      installSuccessRate: snapshot.metrics.installationSuccessRate,
    };
  }

  createProviderSummaryViewModel(snapshot: MarketplaceSnapshotDTO): ProviderSummaryViewModel {
    return {
      totalProviders: snapshot.providers.length,
      activeProviders: snapshot.providers.filter((p) => p.status === 'active').length,
      errorRate:
        snapshot.providers.length > 0
          ? Math.round(
              (snapshot.providers.reduce((s, p) => s + p.errorRate, 0) /
                snapshot.providers.length) *
                100,
            ) / 100
          : 0,
      hasDefaultProvider: snapshot.providers.some((p) => p.isDefault),
    };
  }

  createDashboardViewModel(snapshot: MarketplaceSnapshotDTO): MarketplaceDashboardViewModel {
    return {
      catalog: this.createCatalogViewModel(snapshot),
      assets: this.createAssetHealthViewModel(snapshot),
      providers: this.createProviderSummaryViewModel(snapshot),
      installedAssets: snapshot.installedAssets,
      providersList: snapshot.providers,
      installations: snapshot.installationHistory,
      metrics: snapshot.metrics,
      timeline: snapshot.timeline,
      recommendations: snapshot.recommendations,
      notifications: snapshot.notifications,
      quickActions: snapshot.quickActions,
      health: snapshot.health,
      lastRefreshed: snapshot.generatedAt,
    };
  }
}
