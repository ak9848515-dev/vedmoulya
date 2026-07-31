// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Metrics Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessMetricsDTO } from './BusinessDTO.js';

export class BusinessMetricsService {
  calculateBusinessScore(components: {
    revenueHealth: number;
    expenseEfficiency: number;
    profitability: number;
    growthRate: number;
    projectSuccessRate: number;
    kpiAchievementRate: number;
    riskExposure: number;
    opportunityValue: number;
  }): number {
    return Math.round(
      (components.revenueHealth * 0.2 +
        components.expenseEfficiency * 0.1 +
        components.profitability * 0.15 +
        components.growthRate * 0.15 +
        components.projectSuccessRate * 0.1 +
        components.kpiAchievementRate * 0.1 +
        (100 - components.riskExposure) * 0.1 +
        components.opportunityValue * 0.1) *
        10,
    );
  }

  aggregate(components: {
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
    const businessScore = this.calculateBusinessScore(components);
    return {
      businessScore,
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
        (businessScore + components.revenueHealth + components.profitability) / 3,
      ),
    };
  }
}
