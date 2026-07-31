// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business DTO Mapper
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  QuickActionDTO,
  BusinessMetricsDTO,
  BusinessHealthIndicatorDTO,
  BusinessTimelineEntryDTO,
  BusinessTimelineDTO,
} from './BusinessDTO.js';

export class BusinessDTOMapper {
  toTimeline(entries: BusinessTimelineEntryDTO[]): BusinessTimelineDTO {
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
  ): BusinessHealthIndicatorDTO {
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
    businessScore: number;
    revenueHealth: number;
    expenseEfficiency: number;
    profitability: number;
    growthRate: number;
    projectSuccessRate: number;
    kpiAchievementRate: number;
    riskExposure: number;
    opportunityValue: number;
    executionVelocity: number;
    goalProgress: number;
  }): BusinessMetricsDTO {
    return {
      businessScore: components.businessScore,
      revenueHealth: components.revenueHealth,
      expenseEfficiency: components.expenseEfficiency,
      profitability: components.profitability,
      growthRate: components.growthRate,
      projectSuccessRate: components.projectSuccessRate,
      kpiAchievementRate: components.kpiAchievementRate,
      riskExposure: components.riskExposure,
      opportunityValue: components.opportunityValue,
      executionVelocity: components.executionVelocity,
      goalProgress: components.goalProgress,
      overallProgress: Math.round(
        (components.businessScore + components.revenueHealth + components.profitability) / 3,
      ),
    };
  }
}
