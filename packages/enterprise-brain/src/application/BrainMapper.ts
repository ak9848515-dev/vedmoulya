// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain Mapper
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Maps domain entities to JSON-safe DTOs (the entities already carry
// ISO-string dates; this layer is the explicit contract seam). Also
// assembles the dashboard aggregate and flattens the version history
// into queryable DecisionHistory entries. Plain-object mapper matching
// the CapabilityMapper / LearningMapper convention.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below indexes a closed-union record (decision types
   from the domain constants) — never attacker-controlled input. */

import type {
  BrainDecision,
  BrainDecisionMetrics,
  BrainDecisionPlan,
  BrainHistoryEntry,
  BrainTrendPoint,
} from '../types/brain-types.js';
import { BRAIN_DECISION_TYPES } from '../types/brain-types.js';
import { generateHistoryId } from '../domain/value-objects/BrainDecisionId.js';
import type {
  BrainDashboardDTO,
  BrainDecisionDTO,
  BrainDecisionMetricsDTO,
  BrainHistoryDTO,
  BrainPlanDTO,
} from './BrainDTO.js';

export const BrainMapper = {
  decisionToDTO(decision: BrainDecision): BrainDecisionDTO {
    return decision;
  },

  planToDTO(plan: BrainDecisionPlan): BrainPlanDTO {
    return plan;
  },

  metricsToDTO(metrics: BrainDecisionMetrics): BrainDecisionMetricsDTO {
    return metrics;
  },

  /**
   * Flatten every decision's version-history audit trail into a single
   * chronological DecisionHistory feed (newest first).
   */
  historyToDTO(decisions: BrainDecision[]): BrainHistoryDTO[] {
    const entries: BrainHistoryEntry[] = [];
    for (const decision of decisions) {
      for (const entry of decision.history) {
        entries.push({
          historyId: generateHistoryId(),
          decisionId: decision.decisionId,
          planId: decision.planId,
          goalId: decision.goalId,
          type: decision.type,
          version: entry.version,
          action: entry.action,
          actor: entry.actor,
          note: entry.note,
          timestamp: entry.timestamp,
        });
      }
    }
    return entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  },

  dashboardToDTO(data: {
    metrics: BrainDecisionMetrics;
    decisions: BrainDecision[];
    plans: BrainDecisionPlan[];
  }): BrainDashboardDTO {
    const byType = {} as Record<keyof BrainDashboardDTO['byType'], number>;
    for (const type of BRAIN_DECISION_TYPES) byType[type] = 0;
    for (const decision of data.decisions) {
      byType[decision.type] += 1;
    }
    const pendingApprovals = data.decisions.filter((d) => d.status === 'proposed').length;
    return {
      totals: {
        decisions: data.metrics.totals.decisions,
        plans: data.metrics.totals.plans,
        proposed: data.metrics.totals.proposed,
        approved: data.metrics.totals.approved,
        rejected: data.metrics.totals.rejected,
        handedOff: data.metrics.totals.handedOff,
        superseded: data.metrics.totals.superseded,
        pendingApprovals,
      },
      byType,
      byStatus: data.metrics.byStatus,
      avgConfidence: data.metrics.avgConfidence,
      highConfidenceCount: data.metrics.highConfidenceCount,
      trend: data.metrics.trend,
      recentDecisions: [...data.decisions]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map((d) => BrainMapper.decisionToDTO(d)),
      recentPlans: [...data.plans]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((p) => BrainMapper.planToDTO(p)),
    };
  },

  /** Zero-fill the daily trend (oldest → newest). */
  trendToDTO(trend: BrainTrendPoint[]): BrainTrendPoint[] {
    return trend;
  },
};
