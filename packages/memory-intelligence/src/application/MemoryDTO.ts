// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: DTOs
// EI-010 — Enterprise Memory Intelligence Platform
// JSON-safe API surface. All dates are ISO strings; all nested records
// are plain objects (tRPC-safe). Input DTOs are validated at the tRPC
// boundary with zod (RouterRegistry); the application service
// re-validates business rules.
// ──────────────────────────────────────────────────────────────────

import type {
  MemoryAnalytics,
  MemoryCompressionState,
  MemoryConfidence,
  MemoryConsumer,
  MemoryConsumerType,
  MemoryGraphTraversal,
  MemoryItem,
  MemoryLifecycleStatus,
  MemoryMatchType,
  MemoryRelationship,
  MemoryRelationshipType,
  MemoryRetentionPolicy,
  MemorySearchResult,
  MemorySourceType,
  MemorySummaryResult,
  MemoryTimelineEntry,
  MemoryTrendPoint,
  MemoryType,
  MemoryValidationReport,
} from '../types/memory-types.js';

// ── Input DTOs ──────────────────────────────────────────────────────────────

export interface MemoryCaptureInput {
  type: MemoryType;
  title: string;
  content: string;
  source: string;
  sourceType: MemorySourceType;
  owner: string;
  relatedGoal?: string;
  relatedTask?: string;
  relatedCapability?: string;
  relatedProvider?: string;
  relatedProject?: string;
  relatedUser?: string;
  relatedContext?: string;
  relatedDecision?: string;
  relatedExecution?: string;
  tags?: string[];
  importance?: number;
  confidence?: { score?: number; factors?: string[] };
  retentionPolicy?: MemoryRetentionPolicy;
  citations?: Array<{
    sourceId: string;
    sourceTitle: string;
    reference: string;
    sourceType?: MemorySourceType;
  }>;
  actor?: string;
  /** Run the full pipeline (validate → consolidate → rank → compress → activate). Default true. */
  pipeline?: boolean;
}

export interface UpdateMemoryDTO {
  memoryId: string;
  title?: string;
  content?: string;
  source?: string;
  sourceType?: MemorySourceType;
  owner?: string;
  relatedGoal?: string;
  relatedTask?: string;
  relatedCapability?: string;
  relatedProvider?: string;
  relatedProject?: string;
  relatedUser?: string;
  relatedContext?: string;
  relatedDecision?: string;
  relatedExecution?: string;
  tags?: string[];
  importance?: number;
  confidence?: { score?: number; factors?: string[] };
  retentionPolicy?: MemoryRetentionPolicy;
  actor?: string;
}

export interface MemoryListQueryDTO {
  type?: MemoryType;
  sourceType?: MemorySourceType;
  lifecycleStatus?: MemoryLifecycleStatus;
  compressionState?: MemoryCompressionState;
  retentionPolicy?: MemoryRetentionPolicy;
  owner?: string;
  tag?: string;
  relatedGoal?: string;
  relatedTask?: string;
  relatedCapability?: string;
  relatedProvider?: string;
  relatedProject?: string;
  relatedUser?: string;
  relatedContext?: string;
  minImportance?: number;
  minConfidence?: number;
  page?: number;
  limit?: number;
}

export interface MemoryRetrievalDTO {
  query?: string;
  relatedGoal?: string;
  relatedProject?: string;
  relatedUser?: string;
  relatedCapability?: string;
  relatedProvider?: string;
  relatedContext?: string;
  relatedDecision?: string;
  relatedExecution?: string;
  from?: string;
  to?: string;
  minImportance?: number;
  includeInactive?: boolean;
  limit?: number;
}

export interface SummarizeMemoryDTO {
  memoryId: string;
  target?: MemoryCompressionState;
  ratio?: number;
  actor?: string;
}

export interface ValidateMemoryDTO {
  memoryId: string;
  actor: string;
}

export interface LifecycleMemoryDTO {
  memoryId: string;
  to: MemoryLifecycleStatus;
  actor: string;
  note?: string;
}

export interface RelateMemoryDTO {
  sourceId: string;
  targetId: string;
  type: MemoryRelationshipType;
  weight?: number;
  actor: string;
  note?: string;
}

export interface ConsumerUsageDTO {
  memoryId: string;
  consumerId?: string;
  consumerType: MemoryConsumerType;
  consumerLabel: string;
  actor?: string;
}

export interface ConsolidateMemoryDTO {
  /** When false, only report candidates (default false = run). */
  dryRun?: boolean;
  actor?: string;
}

export interface ExpireMemoryDTO {
  purge?: boolean;
  actor?: string;
}

export interface GraphQueryDTO {
  memoryId: string;
  maxDepth?: number;
}

export interface ShortestPathDTO {
  fromId: string;
  toId: string;
}

export interface MemoryTimelineDTO {
  limit?: number;
}

// ── Output DTOs (JSON-safe entity shapes) ───────────────────────────────────

export type MemoryItemDTO = MemoryItem;
export type MemoryRelationshipDTO = MemoryRelationship;
export type MemorySearchResultDTO = MemorySearchResult;
export type MemoryValidationReportDTO = MemoryValidationReport;
export type MemorySummaryResultDTO = MemorySummaryResult;
export type MemoryAnalyticsDTO = MemoryAnalytics;
export type MemoryGraphTraversalDTO = MemoryGraphTraversal;
export type MemoryTimelineEntryDTO = MemoryTimelineEntry;
export type MemoryConsumerDTO = MemoryConsumer;
export type MemoryTrendPointDTO = MemoryTrendPoint;
export type MemoryMatchTypeDTO = MemoryMatchType;
export type MemoryConfidenceDTO = MemoryConfidence;

export interface MemoryDashboardDTO {
  totals: {
    memories: number;
    active: number;
    archived: number;
    expired: number;
    relationships: number;
    citations: number;
    consumers: number;
    totalRetrievals: number;
    avgImportance: number;
    avgConfidence: number;
    avgRecency: number;
  };
  byType: Record<MemoryType, number>;
  byLifecycle: Record<MemoryLifecycleStatus, number>;
  byCompression: Record<MemoryCompressionState, number>;
  importanceDistribution: Array<{ band: string; count: number }>;
  retentionCountdown: Array<{ policy: MemoryRetentionPolicy; count: number }>;
  trend: MemoryTrendPointDTO[];
  recentMemories: MemoryItemDTO[];
  mostImportant: MemoryItemDTO[];
  mostRetrieved: MemoryItemDTO[];
}
