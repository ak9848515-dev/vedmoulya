// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Mapper
// EI-007 — Enterprise Learning Intelligence Platform
// Maps domain entities to JSON-safe DTOs (the entities already carry
// ISO-string dates; this layer is the explicit contract seam and also
// carries dashboard aggregation helpers used by the app service).
// Plain-object mapper (matches the CapabilityMapper / PipelineMapper
// convention).
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below indexes a closed-union record (learning
   categories from the domain constants) — never attacker-controlled input. */

import type {
  LearningCategoryStats,
  LearningDecision,
  LearningEvent,
  LearningInsight,
  LearningModel,
  LearningRecommendation,
  LearningReport,
} from '../types/learning-types.js';
import { LEARNING_CATEGORIES } from '../types/learning-types.js';
import type {
  LearningAnalyticsDTO,
  LearningDashboardDTO,
  LearningDecisionDTO,
  LearningEventDTO,
  LearningInsightDTO,
  LearningModelDTO,
  LearningRecommendationDTO,
  LearningReportDTO,
} from './LearningDTO.js';

export const LearningMapper = {
  eventToDTO(event: LearningEvent): LearningEventDTO {
    return event;
  },

  modelToDTO(model: LearningModel): LearningModelDTO {
    return model;
  },

  recommendationToDTO(recommendation: LearningRecommendation): LearningRecommendationDTO {
    return recommendation;
  },

  decisionToDTO(decision: LearningDecision): LearningDecisionDTO {
    return decision;
  },

  insightToDTO(insight: LearningInsight): LearningInsightDTO {
    return insight;
  },

  reportToDTO(report: LearningReport): LearningReportDTO {
    return report;
  },

  /** Analytics aggregate (trend + per-category stats + totals). */
  analyticsToDTO(data: {
    trend: LearningAnalyticsDTO['trend'];
    byCategory: Record<string, LearningCategoryStats>;
    events: LearningEvent[];
    models: LearningModel[];
  }): LearningAnalyticsDTO {
    const successes = data.events.filter((e) => e.outcome === 'success').length;
    return {
      trend: data.trend,
      byCategory: LearningMapper.completeCategoryStats(data.byCategory),
      totals: {
        events: data.events.length,
        successes,
        failures: data.events.length - successes,
        models: data.models.length,
      },
    };
  },

  dashboardToDTO(data: {
    events: LearningEvent[];
    models: LearningModel[];
    recommendations: LearningRecommendation[];
    insights: LearningInsight[];
    reports: LearningReport[];
    trend: LearningAnalyticsDTO['trend'];
    byCategory: Record<string, LearningCategoryStats>;
    pendingApprovals: number;
    approved: number;
  }): LearningDashboardDTO {
    const successes = data.events.filter((e) => e.outcome === 'success').length;
    return {
      totals: {
        events: data.events.length,
        successes,
        failures: data.events.length - successes,
        pendingApprovals: data.pendingApprovals,
        approved: data.approved,
        insights: data.insights.length,
        models: data.models.length,
        reports: data.reports.length,
      },
      byCategory: LearningMapper.completeCategoryStats(data.byCategory),
      trend: data.trend,
      recentEvents: [...data.events]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 10)
        .map((e) => LearningMapper.eventToDTO(e)),
      recommendations: data.recommendations.map((r) => LearningMapper.recommendationToDTO(r)),
      insights: data.insights.map((i) => LearningMapper.insightToDTO(i)),
      reports: data.reports.map((r) => LearningMapper.reportToDTO(r)),
      models: data.models.map((m) => LearningMapper.modelToDTO(m)),
    };
  },

  /** Ensure every category key exists (zero-filled) for the dashboard grid. */
  completeCategoryStats(
    byCategory: Record<string, LearningCategoryStats>,
  ): Record<string, LearningCategoryStats> {
    const result: Record<string, LearningCategoryStats> = {};
    for (const category of LEARNING_CATEGORIES) {
      result[category] = byCategory[category] ?? {
        events: 0,
        successRate: 0,
        models: 0,
        failures: 0,
        avgCostUsd: 0,
      };
    }
    return result;
  },
};
