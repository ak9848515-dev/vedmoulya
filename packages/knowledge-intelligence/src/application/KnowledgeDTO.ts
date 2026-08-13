// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: DTOs
// EI-009 — Enterprise Knowledge Intelligence Platform
// JSON-safe API surface. All dates are ISO strings; all nested records
// are plain objects (tRPC-safe). Input DTOs are validated at the tRPC
// boundary with zod (RouterRegistry); the application service
// re-validates business rules.
// ──────────────────────────────────────────────────────────────────

import type {
  KnowledgeAnalytics,
  KnowledgeCategory,
  KnowledgeConsumer,
  KnowledgeConsumerType,
  KnowledgeDiff,
  KnowledgeExplanation,
  KnowledgeGraphTraversal,
  KnowledgeItem,
  KnowledgeLifecycleStatus,
  KnowledgeRelationship,
  KnowledgeRelationshipType,
  KnowledgeSearchResult,
  KnowledgeSourceType,
  KnowledgeTimelineEntry,
  KnowledgeTrendPoint,
  KnowledgeValidationReport,
  KnowledgeValidationStatus,
  KnowledgeVersion,
} from '../types/knowledge-types.js';

// ── Input DTOs ──────────────────────────────────────────────────────────────

export interface CreateKnowledgeItemDTO {
  title: string;
  description: string;
  source: string;
  sourceType: KnowledgeSourceType;
  owner: string;
  category: KnowledgeCategory;
  tags?: string[];
  confidence?: { score?: number; factors?: string[] };
  citations?: Array<{
    sourceId: string;
    sourceTitle: string;
    reference: string;
    sourceType?: KnowledgeSourceType;
  }>;
  actor?: string;
  /** Skip the live-engine enrichment pass (default enriches). */
  enrich?: boolean;
}

export interface UpdateKnowledgeItemDTO {
  knowledgeId: string;
  title?: string;
  description?: string;
  source?: string;
  sourceType?: KnowledgeSourceType;
  owner?: string;
  category?: KnowledgeCategory;
  tags?: string[];
  confidence?: { score?: number; factors?: string[] };
  actor?: string;
  /** Snapshot the current revision into version history (default true). */
  version?: boolean;
}

export interface KnowledgeListQueryDTO {
  category?: KnowledgeCategory;
  sourceType?: KnowledgeSourceType;
  lifecycleStatus?: KnowledgeLifecycleStatus;
  validationStatus?: KnowledgeValidationStatus;
  owner?: string;
  tag?: string;
  minTrust?: number;
  page?: number;
  limit?: number;
}

export interface KnowledgeSearchQueryDTO {
  query?: string;
  category?: KnowledgeCategory;
  sourceType?: KnowledgeSourceType;
  lifecycleStatus?: KnowledgeLifecycleStatus;
  validationStatus?: KnowledgeValidationStatus;
  tags?: string[];
  relationshipType?: KnowledgeRelationshipType;
  relationshipTargetId?: string;
  dependencyTargetId?: string;
  consumerType?: KnowledgeConsumerType;
  minTrust?: number;
  versionNumber?: number;
  limit?: number;
  offset?: number;
}

export interface RelateKnowledgeDTO {
  sourceId: string;
  targetId: string;
  type: KnowledgeRelationshipType;
  weight?: number;
  actor: string;
  note?: string;
}

export interface VersionKnowledgeDTO {
  knowledgeId: string;
  changeSummary: string;
  actor: string;
}

export interface DiffKnowledgeDTO {
  knowledgeId: string;
  fromVersion?: number;
  toVersion?: number;
}

export interface ValidateKnowledgeDTO {
  knowledgeId: string;
  actor: string;
}

export interface LifecycleKnowledgeDTO {
  knowledgeId: string;
  to: KnowledgeLifecycleStatus;
  actor: string;
  note?: string;
}

export interface ConsumerUsageDTO {
  knowledgeId: string;
  consumerId?: string;
  consumerType: KnowledgeConsumerType;
  consumerLabel: string;
  actor?: string;
}

export interface GraphQueryDTO {
  knowledgeId: string;
  maxDepth?: number;
}

export interface ShortestPathDTO {
  fromId: string;
  toId: string;
}

export interface KnowledgeTimelineDTO {
  limit?: number;
}

// ── Output DTOs (JSON-safe entity shapes) ───────────────────────────────────

export type KnowledgeItemDTO = KnowledgeItem;
export type KnowledgeRelationshipDTO = KnowledgeRelationship;
export type KnowledgeVersionDTO = KnowledgeVersion;
export type KnowledgeSearchResultDTO = KnowledgeSearchResult;
export type KnowledgeValidationReportDTO = KnowledgeValidationReport;
export type KnowledgeExplanationDTO = KnowledgeExplanation;
export type KnowledgeDiffDTO = KnowledgeDiff;
export type KnowledgeAnalyticsDTO = KnowledgeAnalytics;
export type KnowledgeGraphTraversalDTO = KnowledgeGraphTraversal;
export type KnowledgeTimelineEntryDTO = KnowledgeTimelineEntry;
export type KnowledgeConsumerDTO = KnowledgeConsumer;
export type KnowledgeTrendPointDTO = KnowledgeTrendPoint;

export interface KnowledgeDashboardDTO {
  totals: {
    items: number;
    active: number;
    review: number;
    validated: number;
    deprecated: number;
    relationships: number;
    citations: number;
    consumers: number;
    totalReads: number;
    avgTrust: number;
    avgConfidence: number;
  };
  byCategory: Record<KnowledgeCategory, number>;
  byLifecycle: Record<KnowledgeLifecycleStatus, number>;
  byValidation: Record<KnowledgeValidationStatus, number>;
  trustDistribution: Array<{ band: string; count: number }>;
  trend: KnowledgeTrendPointDTO[];
  recentItems: KnowledgeItemDTO[];
  topTrusted: KnowledgeItemDTO[];
  mostConsumed: KnowledgeItemDTO[];
}
