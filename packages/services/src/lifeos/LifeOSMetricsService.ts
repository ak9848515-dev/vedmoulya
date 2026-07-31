// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Metrics Service
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSMetricsDTO } from './LifeOSDTO.js';

export class LifeOSMetricsService {
  calculateLifeScore(components: {
    moduleEngagement: number;
    notificationResponse: number;
    recommendationFollow: number;
    timelineActivity: number;
    searchEngagement: number;
    overallConsistency: number;
  }): number {
    return Math.round(
      (components.moduleEngagement * 0.25 +
        components.notificationResponse * 0.15 +
        components.recommendationFollow * 0.2 +
        components.timelineActivity * 0.15 +
        components.searchEngagement * 0.1 +
        components.overallConsistency * 0.15) *
        10,
    );
  }

  aggregate(components: {
    moduleEngagement: Record<string, number>;
    totalNotifications: number;
    unreadNotifications: number;
    totalRecommendations: number;
    activeRecommendations: number;
    searchPerformed: number;
    timelineEntries: number;
    quickActionsUsed: number;
    engagementScore: number;
    notificationResponse: number;
    recommendationFollow: number;
    timelineActivity: number;
    searchEngagement: number;
    overallConsistency: number;
  }): LifeOSMetricsDTO {
    const lifeScore = this.calculateLifeScore({
      moduleEngagement: components.engagementScore,
      notificationResponse: components.notificationResponse,
      recommendationFollow: components.recommendationFollow,
      timelineActivity: components.timelineActivity,
      searchEngagement: components.searchEngagement,
      overallConsistency: components.overallConsistency,
    });
    return {
      lifeScore,
      moduleEngagement: components.moduleEngagement,
      totalNotifications: components.totalNotifications,
      unreadNotifications: components.unreadNotifications,
      totalRecommendations: components.totalRecommendations,
      activeRecommendations: components.activeRecommendations,
      searchPerformed: components.searchPerformed,
      timelineEntries: components.timelineEntries,
      quickActionsUsed: components.quickActionsUsed,
    };
  }
}
