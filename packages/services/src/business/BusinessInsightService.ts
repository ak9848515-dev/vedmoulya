// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Insight Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessInsightDTO } from './BusinessDTO.js';

export class BusinessInsightService {
  generateInsights(input: {
    kpisAtRisk: number;
    hasCriticalRisks: boolean;
    hasNewOpportunities: boolean;
    goalProgress: number;
    revenueGrowth: number;
    hasDelayedProjects: boolean;
  }): BusinessInsightDTO[] {
    const insights: BusinessInsightDTO[] = [];
    const now = new Date().toISOString();

    if (input.kpisAtRisk >= 3) {
      insights.push({
        id: `binsight_kpi_${String(Date.now())}`,
        type: 'warning',
        title: 'Multiple KPIs at Risk',
        description: `${String(input.kpisAtRisk)} KPIs are significantly below target. Review your strategy.`,
        severity: 'warning',
        source: 'kpis',
        timestamp: now,
        actionable: true,
        actionLabel: 'Review KPIs',
        actionRoute: '/business/kpis',
      });
    }
    if (input.hasCriticalRisks) {
      insights.push({
        id: `binsight_risk_${String(Date.now())}`,
        type: 'warning',
        title: 'Critical Business Risks',
        description: 'Your business has critical risks requiring immediate attention.',
        severity: 'critical',
        source: 'risks',
        timestamp: now,
        actionable: true,
        actionLabel: 'View Risks',
        actionRoute: '/business/risks',
      });
    }
    if (input.goalProgress > 80) {
      insights.push({
        id: `binsight_goal_${String(Date.now())}`,
        type: 'achievement',
        title: 'Strong Goal Achievement',
        description: `You've achieved ${String(input.goalProgress)}% of your business goals. Keep the momentum!`,
        severity: 'positive',
        source: 'goals',
        timestamp: now,
        actionable: false,
      });
    }
    if (input.revenueGrowth > 20) {
      insights.push({
        id: `binsight_rev_${String(Date.now())}`,
        type: 'achievement',
        title: 'Revenue Growth Surge',
        description: `Revenue has grown ${String(input.revenueGrowth)}%. Your strategies are working.`,
        severity: 'positive',
        source: 'finance',
        timestamp: now,
        actionable: false,
      });
    }
    if (input.hasNewOpportunities) {
      insights.push({
        id: `binsight_opp_${String(Date.now())}`,
        type: 'prediction',
        title: 'New Opportunities Available',
        description: 'New business opportunities have been identified with high ROI potential.',
        severity: 'info',
        source: 'opportunities',
        timestamp: now,
        actionable: true,
        actionLabel: 'Explore',
        actionRoute: '/business/opportunities',
      });
    }
    if (input.hasDelayedProjects) {
      insights.push({
        id: `binsight_del_${String(Date.now())}`,
        type: 'warning',
        title: 'Project Delays Detected',
        description: 'Some projects are behind schedule. Consider reallocating resources.',
        severity: 'warning',
        source: 'execution',
        timestamp: now,
        actionable: true,
        actionLabel: 'View Projects',
        actionRoute: '/business/projects',
      });
    }

    return insights.sort((a, b) => {
      const order: Record<string, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
      return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
    });
  }

  getActionableInsights(insights: BusinessInsightDTO[]): BusinessInsightDTO[] {
    return insights.filter((i) => i.actionable);
  }
}
