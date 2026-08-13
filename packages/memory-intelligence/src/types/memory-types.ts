// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Domain Types
// EI-010 — Enterprise Memory Intelligence Platform
// The Enterprise Memory Layer of VedMoulya — it records, retrieves,
// ranks, compresses, consolidates and evolves experience across the
// entire operating system. This is NOT chat history, NOT a vector
// database, NOT conversation memory.
//
//   Knowledge represents authoritative facts (EI-009).
//   Memory represents evolving experience (EI-010).
//
// The two systems remain architecturally separate but tightly
// integrated: memories reference knowledge items, and knowledge usage
// is recorded as memory events. No duplicated logic.
//
// A `MemoryItem` is one stored experience with its full lifecycle:
// type, owner, source, related goal/task/capability/provider/project/
// user, importance, confidence, frequency, recency, usage count,
// lifecycle status, compression state, retention policy, relationships,
// consumers, citations, and audit trail.
// ──────────────────────────────────────────────────────────────────

// ── Memory types (the 14 memory classes of VedMoulya) ──────────────────────

export type MemoryType =
  | 'working'
  | 'session'
  | 'project'
  | 'business'
  | 'capability'
  | 'provider'
  | 'execution'
  | 'decision'
  | 'learning'
  | 'context'
  | 'user_preference'
  | 'failure'
  | 'success'
  | 'long_term';

export const MEMORY_TYPES: readonly MemoryType[] = [
  'working',
  'session',
  'project',
  'business',
  'capability',
  'provider',
  'execution',
  'decision',
  'learning',
  'context',
  'user_preference',
  'failure',
  'success',
  'long_term',
] as const;

/** Human labels used by dashboards, retrievals, and reports. */
export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  working: 'Working Memory',
  session: 'Session Memory',
  project: 'Project Memory',
  business: 'Business Memory',
  capability: 'Capability Memory',
  provider: 'Provider Memory',
  execution: 'Execution Memory',
  decision: 'Decision Memory',
  learning: 'Learning Memory',
  context: 'Context Memory',
  user_preference: 'User Preference Memory',
  failure: 'Failure Memory',
  success: 'Success Memory',
  long_term: 'Long-Term Memory',
};

// ── Source types (what produced the memory) ──────────────────────────────────

export type MemorySourceType =
  | 'event'
  | 'goal'
  | 'task'
  | 'capability'
  | 'provider'
  | 'project'
  | 'user'
  | 'decision'
  | 'execution'
  | 'learning'
  | 'context'
  | 'business'
  | 'system'
  | 'manual'
  | 'observation';

export const MEMORY_SOURCE_TYPES: readonly MemorySourceType[] = [
  'event',
  'goal',
  'task',
  'capability',
  'provider',
  'project',
  'user',
  'decision',
  'execution',
  'learning',
  'context',
  'business',
  'system',
  'manual',
  'observation',
] as const;

/** Intrinsic reliability of a source type — feeds the confidence score. */
export const MEMORY_SOURCE_RELIABILITY: Record<MemorySourceType, number> = {
  system: 0.95,
  business: 0.9,
  execution: 0.88,
  observation: 0.85,
  event: 0.82,
  decision: 0.8,
  goal: 0.78,
  task: 0.76,
  project: 0.74,
  capability: 0.72,
  provider: 0.7,
  context: 0.68,
  learning: 0.66,
  user: 0.6,
  manual: 0.55,
};

// ── Lifecycle (how memory evolves — the Memory Pipeline) ────────────────────
// Event → Capture → Validation → Consolidation → Ranking → Compression →
// Retrieval → (Enterprise Brain → Execution → Learning → Memory Update) →
// Archive → Expire

export type MemoryLifecycleStatus =
  | 'captured'
  | 'validated'
  | 'consolidated'
  | 'ranked'
  | 'compressed'
  | 'active'
  | 'archived'
  | 'expired';

export const MEMORY_LIFECYCLE_STATUSES: readonly MemoryLifecycleStatus[] = [
  'captured',
  'validated',
  'consolidated',
  'ranked',
  'compressed',
  'active',
  'archived',
  'expired',
] as const;

// ── Compression state (how much the memory has been reduced) ────────────────

export type MemoryCompressionState = 'raw' | 'compressed' | 'summarized' | 'collapsed';

export const MEMORY_COMPRESSION_STATES: readonly MemoryCompressionState[] = [
  'raw',
  'compressed',
  'summarized',
  'collapsed',
] as const;

// ── Retention policies (when memory expires) ────────────────────────────────

export type MemoryRetentionPolicy =
  'ephemeral' | 'short_term' | 'medium_term' | 'long_term' | 'permanent';

export const MEMORY_RETENTION_POLICIES: readonly MemoryRetentionPolicy[] = [
  'ephemeral',
  'short_term',
  'medium_term',
  'long_term',
  'permanent',
] as const;

/** Retention TTL in days per policy (null = permanent). */
export const MEMORY_RETENTION_DAYS: Record<MemoryRetentionPolicy, number | null> = {
  ephemeral: 1,
  short_term: 7,
  medium_term: 30,
  long_term: 365,
  permanent: null,
};

/** Default retention per memory type (ephemeral working data → long-term). */
export const MEMORY_TYPE_DEFAULT_RETENTION: Record<MemoryType, MemoryRetentionPolicy> = {
  working: 'ephemeral',
  session: 'ephemeral',
  project: 'long_term',
  business: 'long_term',
  capability: 'medium_term',
  provider: 'medium_term',
  execution: 'short_term',
  decision: 'long_term',
  learning: 'medium_term',
  context: 'short_term',
  user_preference: 'long_term',
  failure: 'medium_term',
  success: 'medium_term',
  long_term: 'permanent',
};

// ── Relationships (the Memory Graph edge types — 10) ────────────────────────

export type MemoryRelationshipType =
  | 'recalls'
  | 'follows'
  | 'precedes'
  | 'supports'
  | 'contradicts'
  | 'supersedes'
  | 'depends_on'
  | 'similar_to'
  | 'refines'
  | 'produced_by';

export const MEMORY_RELATIONSHIP_TYPES: readonly MemoryRelationshipType[] = [
  'recalls',
  'follows',
  'precedes',
  'supports',
  'contradicts',
  'supersedes',
  'depends_on',
  'similar_to',
  'refines',
  'produced_by',
] as const;

export const MEMORY_RELATIONSHIP_LABELS: Record<MemoryRelationshipType, string> = {
  recalls: 'Recalls',
  follows: 'Follows',
  precedes: 'Precedes',
  supports: 'Supports',
  contradicts: 'Contradicts',
  supersedes: 'Supersedes',
  depends_on: 'Depends On',
  similar_to: 'Similar To',
  refines: 'Refines',
  produced_by: 'Produced By',
};

// ── Importance / Confidence / Recency / Frequency ───────────────────────────

export type MemoryLevel = 'low' | 'medium' | 'high';

/** Importance: how much this memory matters for future decisions. */
export interface MemoryImportance {
  score: number;
  level: MemoryLevel;
  factors: string[];
}

/** Confidence: how certain the system is that this memory is accurate. */
export interface MemoryConfidence {
  score: number;
  level: MemoryLevel;
  factors: string[];
}

// ── Citation (which knowledge / evidence backs this memory) ─────────────────

export interface MemoryCitation {
  citationId: string;
  /** Source document / registry / event the memory is cited from. */
  sourceId: string;
  sourceTitle: string;
  sourceType: MemorySourceType;
  reference: string;
  retrievedAt: string;
  verified: boolean;
}

// ── Relationship (one edge in the Memory Graph) ─────────────────────────────

export interface MemoryRelationship {
  relationshipId: string;
  type: MemoryRelationshipType;
  sourceId: string;
  sourceTitle?: string;
  targetId: string;
  targetTitle?: string;
  /** Relevance / strength weight in [0, 1]. */
  weight: number;
  actor: string;
  note?: string;
  createdAt: string;
}

// ── Consumer (who retrieves this memory) ────────────────────────────────────

export type MemoryConsumerType = 'engine' | 'module' | 'user' | 'system';

export interface MemoryConsumer {
  consumerId: string;
  consumerType: MemoryConsumerType;
  consumerLabel: string;
  usageCount: number;
  firstUsedAt: string;
  lastUsedAt: string;
}

// ── Usage statistics ────────────────────────────────────────────────────────

export interface MemoryUsage {
  totalRetrievals: number;
  totalConsumers: number;
  /** How many times the underlying event repeated (reinforcement). */
  frequency: number;
  /** Recency in [0, 1] — decays with age unless reinforced. */
  recency: number;
  lastAccessedAt?: string;
}

// ── Audit trail ─────────────────────────────────────────────────────────────

export type MemoryAuditAction =
  | 'captured'
  | 'validated'
  | 'consolidated'
  | 'ranked'
  | 'compressed'
  | 'retrieved'
  | 'learned'
  | 'archived'
  | 'expired'
  | 'related'
  | 'consumed'
  | 'updated'
  | 'deleted';

export interface MemoryAuditEntry {
  auditId: string;
  action: MemoryAuditAction;
  actor: string;
  note?: string;
  timestamp: string;
}

// ── The Memory Item (every field the platform must store) ───────────────────

export interface MemoryItem {
  memoryId: string;
  type: MemoryType;
  title: string;
  /** The stored memory content (raw → compressed → summarized → collapsed). */
  content: string;
  /** Active summary produced by compression. */
  summary?: string;
  /** Human-readable source label (e.g. "goal_blog_seed run #3"). */
  source: string;
  sourceType: MemorySourceType;
  owner: string;
  /** Related entities (integration with EI-001…EI-009, no duplicated logic). */
  relatedGoal?: string;
  relatedTask?: string;
  relatedCapability?: string;
  relatedProvider?: string;
  relatedProject?: string;
  relatedUser?: string;
  relatedContext?: string;
  relatedDecision?: string;
  relatedExecution?: string;
  tags: string[];
  importance: MemoryImportance;
  confidence: MemoryConfidence;
  usage: MemoryUsage;
  lifecycleStatus: MemoryLifecycleStatus;
  compressionState: MemoryCompressionState;
  retentionPolicy: MemoryRetentionPolicy;
  /** Absolute expiration timestamp (computed from retention policy). */
  expiresAt?: string;
  consumers: MemoryConsumer[];
  relationships: MemoryRelationship[];
  citations: MemoryCitation[];
  audit: MemoryAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

// ── Retrieval ───────────────────────────────────────────────────────────────

export type MemoryMatchType =
  | 'goal'
  | 'project'
  | 'user'
  | 'capability'
  | 'provider'
  | 'context'
  | 'time'
  | 'importance'
  | 'similarity'
  | 'business_module'
  | 'keyword';

export const MEMORY_MATCH_TYPES: readonly MemoryMatchType[] = [
  'goal',
  'project',
  'user',
  'capability',
  'provider',
  'context',
  'time',
  'importance',
  'similarity',
  'business_module',
  'keyword',
] as const;

export interface MemorySearchResult {
  memory: MemoryItem;
  matchType: MemoryMatchType;
  /** Composite relevance score in [0, 1]. */
  score: number;
  matchedFields: string[];
  snippet: string;
}

// ── Validation report / Summarization / Explanation / Analytics ─────────────

export interface MemoryValidationReport {
  memoryId: string;
  passed: boolean;
  issues: string[];
  checkedAt: string;
}

export interface MemorySummaryResult {
  memoryId: string;
  beforeLength: number;
  afterLength: number;
  summary: string;
  compressionState: MemoryCompressionState;
}

export interface MemoryExplanation {
  memoryId: string;
  title: string;
  why: string;
  importanceFactors: string[];
  confidenceFactors: string[];
  rankingScore: number;
  rankingContributions: Array<{ factor: string; weight: number; value: number }>;
  retrievedAt: string;
}

export interface MemoryTrendPoint {
  date: string;
  memories: number;
  active: number;
}

export interface MemoryAnalytics {
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
  bySourceType: Record<MemorySourceType, number>;
  byLifecycle: Record<MemoryLifecycleStatus, number>;
  byCompression: Record<MemoryCompressionState, number>;
  importanceDistribution: Array<{ band: string; count: number }>;
  usageTop: Array<{ memoryId: string; title: string; retrievals: number; importance: number }>;
  consumersTop: Array<{
    consumerId: string;
    consumerType: MemoryConsumerType;
    consumerLabel: string;
    usageCount: number;
  }>;
  trend: MemoryTrendPoint[];
}

export interface MemoryDashboardData {
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
  trend: MemoryTrendPoint[];
  recentMemories: MemoryItem[];
  mostImportant: MemoryItem[];
  mostRetrieved: MemoryItem[];
}

export interface MemoryTimelineEntry {
  memoryId: string;
  title: string;
  action: MemoryAuditAction;
  actor: string;
  note?: string;
  timestamp: string;
}

export interface MemoryGraphTraversal {
  rootId: string;
  depth: number;
  visited: Array<{
    memoryId: string;
    title: string;
    depth: number;
    relationships: MemoryRelationship[];
  }>;
}
