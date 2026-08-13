// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain Metrics Service
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Pure aggregation: decisions + plans → DecisionMetrics (totals,
// per-type counts with average confidence, per-status counts, overall
// average confidence, high-confidence count, and a zero-filled daily
// trend). No I/O — deterministic and fully unit-testable.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below indexes closed-union records (decision types /
   statuses from the domain constants) — never attacker-controlled input. */

import type {
  BrainDecision,
  BrainDecisionMetrics,
  BrainDecisionPlan,
  BrainDecisionStatus,
  BrainTrendPoint,
} from '../../types/brain-types.js';
import { BRAIN_DECISION_STATUSES, BRAIN_DECISION_TYPES } from '../../types/brain-types.js';

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export class BrainMetricsService {
  /** Aggregate decisions + plans into DecisionMetrics. */
  aggregate(
    decisions: BrainDecision[],
    plans: BrainDecisionPlan[],
    days = 14,
  ): BrainDecisionMetrics {
    const byType = {} as BrainDecisionMetrics['byType'];
    for (const type of BRAIN_DECISION_TYPES) byType[type] = { count: 0, avgConfidence: 0 };

    const byStatus = {} as Record<BrainDecisionStatus, number>;
    for (const status of BRAIN_DECISION_STATUSES) byStatus[status] = 0;

    let confidenceSum = 0;
    let highConfidenceCount = 0;

    for (const decision of decisions) {
      byType[decision.type].count += 1;
      byType[decision.type].avgConfidence += decision.confidence.score;
      byStatus[decision.status] += 1;
      confidenceSum += decision.confidence.score;
      if (decision.confidence.level === 'high') highConfidenceCount += 1;
    }

    for (const type of BRAIN_DECISION_TYPES) {
      if (byType[type].count > 0) {
        byType[type].avgConfidence = round(byType[type].avgConfidence / byType[type].count);
      }
    }

    return {
      totals: {
        decisions: decisions.length,
        plans: plans.length,
        proposed: byStatus.proposed,
        approved: byStatus.approved,
        rejected: byStatus.rejected,
        handedOff: byStatus.handed_off,
        superseded: byStatus.superseded,
      },
      byType,
      byStatus,
      avgConfidence: decisions.length > 0 ? round(confidenceSum / decisions.length) : 0,
      highConfidenceCount,
      trend: this.trend(decisions, days),
    };
  }

  /** Zero-filled daily buckets (oldest → newest) so charts render a continuous axis. */
  trend(decisions: BrainDecision[], days = 14): BrainTrendPoint[] {
    const now = new Date();
    const buckets: BrainTrendPoint[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const day = new Date(now.getTime() - offset * 86_400_000);
      const key = day.toISOString().slice(0, 10);
      const dayDecisions = decisions.filter((d) => d.createdAt.slice(0, 10) === key);
      const avg =
        dayDecisions.length > 0
          ? dayDecisions.reduce((sum, d) => sum + d.confidence.score, 0) / dayDecisions.length
          : 0;
      buckets.push({ date: key, decisions: dayDecisions.length, avgConfidence: round(avg) });
    }
    // Oldest → newest (index 0 = `days` ago, last = today) so charts render a
    // continuous left-to-right axis without a reversal surprise.
    return buckets;
  }

  /** Average confidence across a plan's decisions (used for overallConfidence). */
  planConfidence(decisions: BrainDecision[]): number {
    if (decisions.length === 0) return 0;
    return round(decisions.reduce((sum, d) => sum + d.confidence.score, 0) / decisions.length);
  }
}
