// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace DTO Mapper
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type {
  QuickActionDTO,
  MarketplaceMetricsDTO,
  MarketplaceHealthIndicatorDTO,
  MarketplaceTimelineDTO,
  MarketplaceTimelineEntryDTO,
} from './MarketplaceDTO.js';

export class MarketplaceDTOMapper {
  toTimeline(entries: MarketplaceTimelineEntryDTO[]): MarketplaceTimelineDTO {
    return { entries, totalEntries: entries.length, hasMore: entries.length >= 20 };
  }

  createQuickAction(
    id: string,
    label: string,
    description: string,
    icon: string,
    route: string,
    priority: number,
    category: string,
    isAvailable: boolean = true,
    disabledReason?: string,
  ): QuickActionDTO {
    return { id, label, description, icon, route, priority, category, isAvailable, disabledReason };
  }

  createHealthIndicator(
    services: Array<{ name: string; status: 'healthy' | 'degraded' | 'down'; latency: number }>,
  ): MarketplaceHealthIndicatorDTO {
    const warnings: string[] = [];
    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
    for (const svc of services) {
      if (svc.status === 'down') {
        overall = 'critical';
        warnings.push(`${svc.name} is down`);
      } else if (svc.status === 'degraded' && overall !== 'critical') {
        overall = 'degraded';
        warnings.push(`${svc.name} is degraded (${String(svc.latency)}ms)`);
      }
    }
    return { overall, services, lastChecked: new Date().toISOString(), warnings };
  }

  aggregateMetrics(components: {
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
  }): MarketplaceMetricsDTO {
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
      overallHealth: Math.round(
        components.compatibilityScore * 0.3 +
          components.installationSuccessRate * 0.3 +
          components.averageRating * 0.2 +
          (components.activeCount / Math.max(1, components.installedCount)) * 100 * 0.2,
      ),
    };
  }
}
