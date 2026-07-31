// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Insight Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceInsightDTO } from './MarketplaceDTO.js';

export class MarketplaceInsightService {
  generateInsights(input: {
    installErrors: number;
    providerErrors: number;
    compatibilityIssues: number;
    availableUpdates: number;
    newAssetsCount: number;
    pendingActivations: number;
    totalInstalled: number;
    activeCount: number;
  }): MarketplaceInsightDTO[] {
    const insights: MarketplaceInsightDTO[] = [];
    const now = new Date().toISOString();

    if (input.installErrors >= 3) {
      insights.push({
        id: `minsight_inst_${String(Date.now())}`,
        type: 'warning',
        title: 'Multiple Installation Failures',
        description: `${String(input.installErrors)} installations have failed recently. Check your network and configuration.`,
        severity: 'warning',
        source: 'installations',
        timestamp: now,
        actionable: true,
        actionLabel: 'View Installations',
        actionRoute: '/marketplace/installations',
      });
    }
    if (input.providerErrors > 0) {
      insights.push({
        id: `minsight_prov_${String(Date.now())}`,
        type: 'warning',
        title: 'Provider Errors Detected',
        description: `${String(input.providerErrors)} provider${input.providerErrors > 1 ? 's' : ''} experiencing errors. Check API configurations.`,
        severity: 'critical',
        source: 'providers',
        timestamp: now,
        actionable: true,
        actionLabel: 'View Providers',
        actionRoute: '/marketplace/providers',
      });
    }
    if (input.availableUpdates > 5) {
      insights.push({
        id: `minsight_upd_${String(Date.now())}`,
        type: 'warning',
        title: 'Many Updates Available',
        description: `${String(input.availableUpdates)} updates pending. Schedule time to update your assets.`,
        severity: 'info',
        source: 'updates',
        timestamp: now,
        actionable: true,
        actionLabel: 'View Updates',
        actionRoute: '/marketplace/updates',
      });
    }
    if (input.compatibilityIssues > 0) {
      insights.push({
        id: `minsight_comp_${String(Date.now())}`,
        type: 'warning',
        title: 'Compatibility Concerns',
        description: `${String(input.compatibilityIssues)} asset${input.compatibilityIssues > 1 ? 's' : ''} ha${input.compatibilityIssues > 1 ? 've' : 's'} compatibility issues.`,
        severity: 'warning',
        source: 'compatibility',
        timestamp: now,
        actionable: true,
        actionLabel: 'Review',
        actionRoute: '/marketplace/compatibility',
      });
    }
    if (input.newAssetsCount > 0) {
      insights.push({
        id: `minsight_new_${String(Date.now())}`,
        type: 'achievement',
        title: 'New Assets Discovered',
        description: `${String(input.newAssetsCount)} new asset${input.newAssetsCount > 1 ? 's' : ''} available in the catalog.`,
        severity: 'positive',
        source: 'catalog',
        timestamp: now,
        actionable: true,
        actionLabel: 'Browse',
        actionRoute: '/marketplace/catalog',
      });
    }

    return insights.sort((a, b) => {
      const order: Record<string, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
      return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
    });
  }

  getActionableInsights(insights: MarketplaceInsightDTO[]): MarketplaceInsightDTO[] {
    return insights.filter((i) => i.actionable);
  }
}
