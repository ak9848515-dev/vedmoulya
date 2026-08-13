// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Domain Types
// EI-009 — Enterprise Knowledge Intelligence Platform
// The Enterprise Knowledge Layer of VedMoulya — the authoritative
// knowledge source used by every Enterprise Intelligence Engine and
// every future business module. This is NOT a document management
// system, NOT a vector database, and NOT another RAG library.
//
// VedMoulya must know WHAT it knows, WHERE it came from, WHO uses it,
// WHETHER it is trusted, WHETHER it is current, WHAT depends on it,
// and HOW it should be used.
//
// A `KnowledgeItem` is one piece of authoritative knowledge with its
// full provenance: source, owner, category, tags, trust score,
// confidence, version history, consumers, dependencies, relationships,
// citations, usage statistics, validation status, and lifecycle status.
// ──────────────────────────────────────────────────────────────────

// ── Categories (the 14 knowledge domains of VedMoulya) ──────────────────────

export type KnowledgeCategory =
  | 'business'
  | 'technical'
  | 'user'
  | 'project'
  | 'ai'
  | 'sap'
  | 'client'
  | 'domain'
  | 'policy'
  | 'document'
  | 'api'
  | 'architecture'
  | 'learning'
  | 'execution';

export const KNOWLEDGE_CATEGORIES: readonly KnowledgeCategory[] = [
  'business',
  'technical',
  'user',
  'project',
  'ai',
  'sap',
  'client',
  'domain',
  'policy',
  'document',
  'api',
  'architecture',
  'learning',
  'execution',
] as const;

/** Human labels used by dashboards, searches, and reports. */
export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  business: 'Business Knowledge',
  technical: 'Technical Knowledge',
  user: 'User Knowledge',
  project: 'Project Knowledge',
  ai: 'AI Knowledge',
  sap: 'SAP Knowledge',
  client: 'Client Knowledge',
  domain: 'Domain Knowledge',
  policy: 'Policy Knowledge',
  document: 'Document Knowledge',
  api: 'API Knowledge',
  architecture: 'Architecture Knowledge',
  learning: 'Learning Knowledge',
  execution: 'Execution Knowledge',
};

// ── Source types (where a knowledge item came from) ──────────────────────────

export type KnowledgeSourceType =
  | 'document'
  | 'api'
  | 'architecture'
  | 'conversation'
  | 'observation'
  | 'export'
  | 'manual'
  | 'generated'
  | 'system'
  | 'report'
  | 'repository'
  | 'database';

export const KNOWLEDGE_SOURCE_TYPES: readonly KnowledgeSourceType[] = [
  'document',
  'api',
  'architecture',
  'conversation',
  'observation',
  'export',
  'manual',
  'generated',
  'system',
  'report',
  'repository',
  'database',
] as const;

/** Intrinsic reliability of a source type — feeds the trust score. */
export const KNOWLEDGE_SOURCE_RELIABILITY: Record<KnowledgeSourceType, number> = {
  repository: 0.95,
  architecture: 0.9,
  api: 0.88,
  database: 0.85,
  report: 0.8,
  system: 0.78,
  document: 0.7,
  export: 0.68,
  observation: 0.6,
  generated: 0.55,
  conversation: 0.45,
  manual: 0.4,
};

// ── Lifecycle (how knowledge ages) ───────────────────────────────────────────

export type KnowledgeLifecycleStatus = 'draft' | 'review' | 'active' | 'deprecated' | 'archived';

export const KNOWLEDGE_LIFECYCLE_STATUSES: readonly KnowledgeLifecycleStatus[] = [
  'draft',
  'review',
  'active',
  'deprecated',
  'archived',
] as const;

// ── Validation (whether knowledge has been checked) ──────────────────────────

export type KnowledgeValidationStatus = 'unvalidated' | 'pending' | 'validated' | 'failed';

export const KNOWLEDGE_VALIDATION_STATUSES: readonly KnowledgeValidationStatus[] = [
  'unvalidated',
  'pending',
  'validated',
  'failed',
] as const;

// ── Relationships (the Knowledge Graph edge types — 10) ─────────────────────

export type KnowledgeRelationshipType =
  | 'parent'
  | 'child'
  | 'depends_on'
  | 'related_to'
  | 'implements'
  | 'consumes'
  | 'produces'
  | 'supersedes'
  | 'uses'
  | 'owned_by';

export const KNOWLEDGE_RELATIONSHIP_TYPES: readonly KnowledgeRelationshipType[] = [
  'parent',
  'child',
  'depends_on',
  'related_to',
  'implements',
  'consumes',
  'produces',
  'supersedes',
  'uses',
  'owned_by',
] as const;

export const KNOWLEDGE_RELATIONSHIP_LABELS: Record<KnowledgeRelationshipType, string> = {
  parent: 'Parent',
  child: 'Child',
  depends_on: 'Depends On',
  related_to: 'Related To',
  implements: 'Implements',
  consumes: 'Consumes',
  produces: 'Produces',
  supersedes: 'Supersedes',
  uses: 'Uses',
  owned_by: 'Owned By',
};

// ── Trust / Confidence ───────────────────────────────────────────────────────

export type KnowledgeLevel = 'low' | 'medium' | 'high';

/** Trust: how much VedMoulya can rely on this knowledge (provenance + use). */
export interface KnowledgeTrustScore {
  score: number;
  level: KnowledgeLevel;
  factors: string[];
}

/** Confidence: how certain the source/owner was when this knowledge was written. */
export interface KnowledgeConfidence {
  score: number;
  level: KnowledgeLevel;
  factors: string[];
}

// ── Citation (where this knowledge is backed up) ─────────────────────────────

export interface KnowledgeCitation {
  citationId: string;
  /** Source document / repository / URL the knowledge is cited from. */
  sourceId: string;
  sourceTitle: string;
  sourceType: KnowledgeSourceType;
  reference: string;
  retrievedAt: string;
  verified: boolean;
}

// ── Version (a snapshot of one revision) ─────────────────────────────────────

export interface KnowledgeVersion {
  versionId: string;
  knowledgeId: string;
  versionNumber: number;
  title: string;
  description: string;
  tags: string[];
  changeSummary: string;
  actor: string;
  createdAt: string;
}

// ── Relationship (one edge in the Knowledge Graph) ───────────────────────────

export interface KnowledgeRelationship {
  relationshipId: string;
  type: KnowledgeRelationshipType;
  sourceId: string;
  sourceTitle?: string;
  targetId: string;
  targetTitle?: string;
  /** Relevance / criticality weight in [0, 1]. */
  weight: number;
  actor: string;
  note?: string;
  createdAt: string;
}

// ── Dependency (who depends on whom — derived from outgoing edges) ───────────

export interface KnowledgeDependency {
  dependencyId: string;
  targetId: string;
  targetTitle?: string;
  type: 'depends_on' | 'consumes' | 'uses';
  criticality: 'low' | 'medium' | 'high';
  note?: string;
}

// ── Consumer (who uses this knowledge) ───────────────────────────────────────

export type KnowledgeConsumerType = 'engine' | 'module' | 'user' | 'system';

export interface KnowledgeConsumer {
  consumerId: string;
  consumerType: KnowledgeConsumerType;
  consumerLabel: string;
  usageCount: number;
  firstUsedAt: string;
  lastUsedAt: string;
}

// ── Usage statistics ─────────────────────────────────────────────────────────

export interface KnowledgeUsage {
  totalReads: number;
  totalConsumers: number;
  lastAccessedAt?: string;
}

// ── Audit trail ──────────────────────────────────────────────────────────────

export type KnowledgeAuditAction =
  | 'created'
  | 'updated'
  | 'validated'
  | 'versioned'
  | 'related'
  | 'consumed'
  | 'lifecycle'
  | 'deleted';

export interface KnowledgeAuditEntry {
  auditId: string;
  action: KnowledgeAuditAction;
  actor: string;
  note?: string;
  timestamp: string;
}

// ── The Knowledge Item (every field the platform must store) ─────────────────

export interface KnowledgeItem {
  knowledgeId: string;
  title: string;
  description: string;
  /** Human-readable source label (e.g. "Client onboarding doc v3"). */
  source: string;
  sourceType: KnowledgeSourceType;
  owner: string;
  category: KnowledgeCategory;
  tags: string[];
  trust: KnowledgeTrustScore;
  confidence: KnowledgeConfidence;
  /** Current version number (starts at 1). */
  version: number;
  versionHistory: KnowledgeVersion[];
  consumers: KnowledgeConsumer[];
  dependencies: KnowledgeDependency[];
  relationships: KnowledgeRelationship[];
  citations: KnowledgeCitation[];
  usage: KnowledgeUsage;
  validationStatus: KnowledgeValidationStatus;
  lifecycleStatus: KnowledgeLifecycleStatus;
  audit: KnowledgeAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

// ── Search ───────────────────────────────────────────────────────────────────

export type KnowledgeMatchType =
  | 'semantic'
  | 'keyword'
  | 'category'
  | 'relationship'
  | 'dependency'
  | 'consumer'
  | 'trust'
  | 'version';

export const KNOWLEDGE_MATCH_TYPES: readonly KnowledgeMatchType[] = [
  'semantic',
  'keyword',
  'category',
  'relationship',
  'dependency',
  'consumer',
  'trust',
  'version',
] as const;

export interface KnowledgeSearchResult {
  item: KnowledgeItem;
  matchType: KnowledgeMatchType;
  /** Composite relevance score in [0, 1]. */
  score: number;
  matchedFields: string[];
  snippet: string;
}

// ── Validation report / Explanation / Diff / Analytics / Dashboard ───────────

export interface KnowledgeValidationReport {
  knowledgeId: string;
  passed: boolean;
  issues: string[];
  checkedAt: string;
}

export interface KnowledgeExplanation {
  knowledgeId: string;
  title: string;
  why: string;
  trustFactors: string[];
  confidenceFactors: string[];
  rankingScore: number;
  rankingContributions: Array<{ factor: string; weight: number; value: number }>;
  retrievedAt: string;
}

export interface KnowledgeDiff {
  knowledgeId: string;
  fromVersion: number;
  toVersion: number;
  changedFields: string[];
  titleChanged: boolean;
  descriptionChanged: boolean;
  tagsAdded: string[];
  tagsRemoved: string[];
  summary: string;
}

export interface KnowledgeTrendPoint {
  date: string;
  items: number;
  active: number;
}

export interface KnowledgeAnalytics {
  totals: {
    items: number;
    active: number;
    validated: number;
    relationships: number;
    citations: number;
    consumers: number;
    totalReads: number;
    avgTrust: number;
    avgConfidence: number;
  };
  byCategory: Record<KnowledgeCategory, number>;
  bySourceType: Record<KnowledgeSourceType, number>;
  byLifecycle: Record<KnowledgeLifecycleStatus, number>;
  byValidation: Record<KnowledgeValidationStatus, number>;
  trustDistribution: Array<{ band: string; count: number }>;
  usageTop: Array<{ knowledgeId: string; title: string; reads: number; trust: number }>;
  consumersTop: Array<{
    consumerId: string;
    consumerType: KnowledgeConsumerType;
    consumerLabel: string;
    usageCount: number;
  }>;
  trend: KnowledgeTrendPoint[];
}

export interface KnowledgeDashboardData {
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
  trend: KnowledgeTrendPoint[];
  recentItems: KnowledgeItem[];
  topTrusted: KnowledgeItem[];
  mostConsumed: KnowledgeItem[];
}

export interface KnowledgeTimelineEntry {
  knowledgeId: string;
  title: string;
  action: KnowledgeAuditAction;
  actor: string;
  note?: string;
  timestamp: string;
}

export interface KnowledgeGraphTraversal {
  rootId: string;
  depth: number;
  visited: Array<{
    knowledgeId: string;
    title: string;
    depth: number;
    relationships: KnowledgeRelationship[];
  }>;
}
