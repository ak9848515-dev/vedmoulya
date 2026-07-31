// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS ViewModel Factory
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type {
  LifeOSSnapshotDTO,
  LifeOSModuleSummaryDTO,
  LifeOSModule,
  LifeOSPriorityDTO,
  LifeOSSearchResultDTO,
  LifeOSRecommendationDTO,
  LifeOSNotificationDTO,
  LifeOSMetricsDTO,
} from './LifeOSDTO.js';

export interface ModuleCardViewModel {
  module: LifeOSModule;
  status: string;
  summary: string;
  metrics: Record<string, number>;
  hasNotifications: boolean;
}

export interface PriorityListViewModel {
  items: LifeOSPriorityDTO[];
  blockedCount: number;
  totalCount: number;
}

export interface SearchSummaryViewModel {
  totalResults: number;
  categories: string[];
  topResult?: LifeOSSearchResultDTO;
}

export interface LifeOSDashboardViewModel {
  greeting: string;
  moduleCards: ModuleCardViewModel[];
  priorities: PriorityListViewModel;
  recommendations: LifeOSRecommendationDTO[];
  notifications: LifeOSNotificationDTO[];
  metrics: LifeOSMetricsDTO;
  healthStatus: string;
  lastRefreshed: string;
}

export class LifeOSViewModelFactory {
  createModuleCardViewModel(summary: LifeOSModuleSummaryDTO): ModuleCardViewModel {
    return {
      module: summary.module,
      status: summary.status,
      summary: summary.summary,
      metrics: summary.metrics,
      hasNotifications: summary.hasNotifications,
    };
  }

  createPriorityListViewModel(priorities: LifeOSPriorityDTO[]): PriorityListViewModel {
    return {
      items: priorities.sort((a, b) => a.priority - b.priority),
      blockedCount: priorities.filter((p) => p.isBlocked).length,
      totalCount: priorities.length,
    };
  }

  createSearchSummaryViewModel(results: LifeOSSearchResultDTO[]): SearchSummaryViewModel {
    const categories = [...new Set(results.map((r) => r.category))];
    return {
      totalResults: results.length,
      categories,
      topResult: results[0],
    };
  }

  createDashboardViewModel(snapshot: LifeOSSnapshotDTO): LifeOSDashboardViewModel {
    return {
      greeting: `Welcome back, ${snapshot.identity.displayName}`,
      moduleCards: [
        this.createModuleCardViewModel(snapshot.dashboard),
        this.createModuleCardViewModel(snapshot.career),
        this.createModuleCardViewModel(snapshot.learning),
        this.createModuleCardViewModel(snapshot.business),
        this.createModuleCardViewModel(snapshot.marketplace),
      ],
      priorities: this.createPriorityListViewModel(snapshot.priorities),
      recommendations: snapshot.crossDomainRecommendations,
      notifications: snapshot.globalNotifications,
      metrics: snapshot.metrics,
      healthStatus: snapshot.platformHealth.overall,
      lastRefreshed: snapshot.generatedAt,
    };
  }
}
