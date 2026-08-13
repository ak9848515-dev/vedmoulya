// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Learning Intelligence: DTOs
// EI-007
// JSON-safe API surface for the learning platform. All dates are ISO
// strings; all nested records are plain objects (tRPC-safe).
// ──────────────────────────────────────────────────────────────────

import type {
  LearningCategory,
  LearningCategoryStats,
  LearningDecision,
  LearningEvent,
  LearningInsight,
  LearningModel,
  LearningOutcome,
  LearningRecommendation,
  LearningReport,
  LearningSourceRef,
  LearningTrendPoint,
} from '../types/learning-types.js';

// ── Input DTOs ──────────────────────────────────────────────────────────────

export interface RecordLearningEventDTO {
  category: LearningCategory;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  outcome: LearningOutcome;
  confidence: number;
  costUsd: number;
  latencyMs: number;
  accuracy: number;
  retries: number;
  quality: number;
  feedback?: number;
  businessOutcome?: number;
  sourceRef?: LearningSourceRef;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export interface LearningEventQueryDTO {
  category?: LearningCategory;
  outcome?: LearningOutcome;
  entityId?: string;
  page?: number;
  limit?: number;
}

export interface LearningTimelineDTO {
  limit?: number;
}

export interface LearningModelQueryDTO {
  category?: LearningCategory;
}

export interface LearningCategoryQueryDTO {
  category?: LearningCategory;
}

export interface LearningApprovalDTO {
  recommendationId: string;
  actor: string;
  note?: string;
}

// ── Output DTOs (JSON-safe entity shapes) ───────────────────────────────────

export type LearningEventDTO = LearningEvent;
export type LearningModelDTO = LearningModel;
export type LearningRecommendationDTO = LearningRecommendation;
export type LearningDecisionDTO = LearningDecision;
export type LearningInsightDTO = LearningInsight;
export type LearningReportDTO = LearningReport;
export type LearningTrendPointDTO = LearningTrendPoint;

export interface LearningAnalyticsDTO {
  trend: LearningTrendPointDTO[];
  byCategory: Record<LearningCategory, LearningCategoryStats>;
  totals: {
    events: number;
    successes: number;
    failures: number;
    models: number;
  };
}

export interface LearningDashboardDTO {
  totals: {
    events: number;
    successes: number;
    failures: number;
    pendingApprovals: number;
    approved: number;
    insights: number;
    models: number;
    reports: number;
  };
  byCategory: Record<LearningCategory, LearningCategoryStats>;
  trend: LearningTrendPointDTO[];
  recentEvents: LearningEventDTO[];
  recommendations: LearningRecommendationDTO[];
  insights: LearningInsightDTO[];
  reports: LearningReportDTO[];
  models: LearningModelDTO[];
}
