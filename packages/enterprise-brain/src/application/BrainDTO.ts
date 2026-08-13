// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: DTOs
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// JSON-safe API surface for the Enterprise Brain. All dates are ISO
// strings; all nested records are plain objects (tRPC-safe).
// ──────────────────────────────────────────────────────────────────

import type {
  BrainDecision,
  BrainDecisionMetrics,
  BrainDecisionPlan,
  BrainDecisionStatus,
  BrainDecisionType,
  BrainHistoryEntry,
  BrainTrendPoint,
} from '../types/brain-types.js';

// ── Input DTOs ──────────────────────────────────────────────────────────────

export interface DecideGoalDTO {
  goalId: string;
  /** Optional operator-supplied budget envelope (USD). */
  budgetUsd?: number;
  actor?: string;
}

export interface BrainListDecisionsQueryDTO {
  type?: BrainDecisionType;
  status?: BrainDecisionStatus;
  goalId?: string;
  page?: number;
  limit?: number;
}

export interface BrainTimelineDTO {
  limit?: number;
}

export interface BrainDecisionActionDTO {
  decisionId: string;
  actor: string;
  note?: string;
}

export interface BrainPlanActionDTO {
  planId: string;
  actor: string;
  note?: string;
}

// ── Output DTOs (JSON-safe entity shapes) ───────────────────────────────────

export type BrainDecisionDTO = BrainDecision;
export type BrainPlanDTO = BrainDecisionPlan;
export type BrainHistoryDTO = BrainHistoryEntry;
export type BrainTrendPointDTO = BrainTrendPoint;
export type BrainDecisionMetricsDTO = BrainDecisionMetrics;

export interface BrainDashboardDTO {
  totals: {
    decisions: number;
    plans: number;
    proposed: number;
    approved: number;
    rejected: number;
    handedOff: number;
    superseded: number;
    pendingApprovals: number;
  };
  byType: Record<BrainDecisionType, number>;
  byStatus: Record<BrainDecisionStatus, number>;
  avgConfidence: number;
  highConfidenceCount: number;
  trend: BrainTrendPointDTO[];
  recentDecisions: BrainDecisionDTO[];
  recentPlans: BrainPlanDTO[];
}
