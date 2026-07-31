// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Recommendation Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessRecommendationDTO } from './BusinessDTO.js';

export class BusinessRecommendationService {
  generateRecommendations(input: {
    hasCriticalRisks: boolean;
    hasHighValueOpps: boolean;
    kpisAtRisk: number;
    goalProgress: number;
    hasDelayedProjects: boolean;
    revenueDeclining: boolean;
    hasBlockedProjects: boolean;
  }): BusinessRecommendationDTO[] {
    const recs: BusinessRecommendationDTO[] = [];
    let priority = 1;

    if (input.hasCriticalRisks) {
      recs.push(
        this.create(
          priority++,
          'risk',
          'Mitigate Critical Risks',
          'Address critical business risks immediately to prevent impact.',
          'Risks with score >= 15 require immediate mitigation.',
          '/business/risks',
          0.95,
        ),
      );
    }
    if (input.hasHighValueOpps) {
      recs.push(
        this.create(
          priority++,
          'opportunity',
          'Pursue High-Value Opportunities',
          'Explore identified opportunities with strong ROI potential.',
          'High ROI opportunities can accelerate business growth.',
          '/business/opportunities',
          0.85,
        ),
      );
    }
    if (input.kpisAtRisk > 0) {
      recs.push(
        this.create(
          priority++,
          'strategic',
          'Review KPI Strategy',
          `${String(input.kpisAtRisk)} KPI${input.kpisAtRisk > 1 ? 's' : ''} ${input.kpisAtRisk > 1 ? 'are' : 'is'} underperforming. Review targets and action plans.`,
          'KPIs below 50% of target need immediate attention.',
          '/business/kpis',
          0.8,
        ),
      );
    }
    if (input.goalProgress < 30 && input.goalProgress > 0) {
      recs.push(
        this.create(
          priority++,
          'strategic',
          'Accelerate Goal Progress',
          'Business goals are behind schedule. Consider reprioritizing.',
          'Low goal progress indicates execution gaps.',
          '/business/goals',
          0.75,
        ),
      );
    }
    if (input.hasDelayedProjects) {
      recs.push(
        this.create(
          priority++,
          'execution',
          'Address Project Delays',
          'Review delayed projects and reallocate resources.',
          'Timely project delivery is critical for business execution.',
          '/business/projects',
          0.7,
        ),
      );
    }
    if (input.revenueDeclining) {
      recs.push(
        this.create(
          priority++,
          'financial',
          'Analyze Revenue Decline',
          'Revenue is declining. Review pricing, costs, and market position.',
          'Revenue decline requires immediate strategic review.',
          '/business/finance',
          0.65,
        ),
      );
    }
    if (input.hasBlockedProjects) {
      recs.push(
        this.create(
          priority++,
          'execution',
          'Resolve Project Blockers',
          'Remove blockers preventing project progress.',
          'Blocked projects create cascading delays.',
          '/business/projects',
          0.6,
        ),
      );
    }

    recs.push(
      this.create(
        priority++,
        'strategic',
        'Review Business Strategy',
        'Schedule a strategic review to assess progress and adjust plans.',
        'Regular strategy reviews keep your business aligned.',
        '/business/strategy',
        0.5,
      ),
    );
    recs.push(
      this.create(
        priority++,
        'operational',
        'Optimize Operations',
        'Look for operational improvements to increase efficiency.',
        'Small efficiency gains compound over time.',
        '/business/strategy',
        0.4,
      ),
    );

    return recs;
  }

  prioritizeRecommendations(
    recs: BusinessRecommendationDTO[],
    maxCount: number = 10,
  ): BusinessRecommendationDTO[] {
    return recs
      .filter((r) => !r.isDismissed)
      .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
      .slice(0, maxCount);
  }

  dismissRecommendation(
    recs: BusinessRecommendationDTO[],
    id: string,
  ): BusinessRecommendationDTO[] {
    return recs.map((r) => (r.id === id ? { ...r, isDismissed: true } : r));
  }

  private create(
    priority: number,
    category: BusinessRecommendationDTO['category'],
    title: string,
    description: string,
    reason: string,
    actionRoute: string,
    confidence: number,
  ): BusinessRecommendationDTO {
    return {
      id: `brec_${String(Date.now())}_${String(priority)}_${Math.random().toString(36).slice(2, 8)}`,
      category,
      title,
      description,
      priority,
      confidence,
      source: 'business',
      reason,
      actionLabel: 'View',
      actionRoute,
      isDismissed: false,
      createdAt: new Date().toISOString(),
    };
  }
}
