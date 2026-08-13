// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Types
// APP-001 — Post-V1 Application Platform Layer
// The Context Fabric is the unified context abstraction that answers:
//   "Given this user, this goal, this task and this permission set,
//    what information, relationships, memories and knowledge are
//    relevant, where did they come from, why were they selected, and
//    what is the minimum useful context package for the next
//    agent/workflow?"
//
// It CONSUMES the frozen Enterprise Intelligence engines (EI-003
// Context, EI-009 Knowledge, EI-010 Memory, EI-006 Goals, EI-001
// Capabilities) through narrow port contracts — it OWNS none and
// duplicates no logic. These types model the personal intelligence
// graph, the business/enterprise context graph, the unified entity
// model with provenance + permissions, hybrid retrieval, composite
// ranking, explanations and the assembled context package.
// ──────────────────────────────────────────────────────────────────

// ── Entity model ──────────────────────────────────────────────────

/** Personal intelligence graph entity kinds (who the user is). */
export type PersonalEntityType =
  | 'user'
  | 'goal'
  | 'project'
  | 'task'
  | 'skill'
  | 'knowledge'
  | 'memory'
  | 'document'
  | 'application'
  | 'preference'
  | 'work_history'
  | 'learning_history'
  | 'ai_interaction';

/** Business / enterprise context graph entity kinds. */
export type BusinessEntityType =
  | 'organization'
  | 'person'
  | 'team'
  | 'client'
  | 'project'
  | 'process'
  | 'application'
  | 'document'
  | 'policy'
  | 'knowledge'
  | 'business_capability';

/** Union of every entity kind the fabric can model. */
export type FabricEntityType = PersonalEntityType | BusinessEntityType;

export type FabricGraphKind = 'personal' | 'business';

/** Where an entity or relationship came from (provenance). */
export type ContextSource =
  | 'manual'
  | 'import'
  | 'inference'
  | 'system'
  | 'memory'
  | 'knowledge'
  | 'context'
  | 'identity'
  | 'goal'
  | 'task'
  | 'document'
  | 'application'
  | 'capabilities'
  | 'user_input';

export const CONTEXT_FABRIC_SOURCES: readonly ContextSource[] = [
  'manual',
  'import',
  'inference',
  'system',
  'memory',
  'knowledge',
  'context',
  'identity',
  'goal',
  'task',
  'document',
  'application',
  'capabilities',
  'user_input',
] as const;

export type EntityLifecycle = 'active' | 'archived' | 'draft';

/** One node in the personal or business graph. */
export interface ContextEntity {
  entityId: string;
  graph: FabricGraphKind;
  type: FabricEntityType;
  label: string;
  description?: string;
  /** Owning user (the user the entity belongs to). */
  ownerId: string;
  /** Organization scope for business-graph entities. */
  organizationId?: string;
  tags: string[];
  /** Confidence in the entity itself (0–1). */
  confidence: number;
  lifecycle: EntityLifecycle;
  source: ContextSource;
  provenance: ContextProvenance;
  permissions: ContextPermission;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ── Relationship model ────────────────────────────────────────────

export type ContextRelationshipType =
  | 'member_of'
  | 'owns'
  | 'uses'
  | 'implements'
  | 'describes'
  | 'responsible_for'
  | 'related_to'
  | 'depends_on'
  | 'produced_by'
  | 'references'
  | 'part_of'
  | 'supports'
  | 'manages'
  | 'precedes';

export const CONTEXT_RELATIONSHIP_TYPES: readonly ContextRelationshipType[] = [
  'member_of',
  'owns',
  'uses',
  'implements',
  'describes',
  'responsible_for',
  'related_to',
  'depends_on',
  'produced_by',
  'references',
  'part_of',
  'supports',
  'manages',
  'precedes',
] as const;

/** One directed edge in the personal or business graph. */
export interface ContextRelationship {
  relationshipId: string;
  fromId: string;
  toId: string;
  type: ContextRelationshipType;
  /** Edge weight 0–1. */
  weight: number;
  /** Confidence in the relationship 0–1. */
  confidence: number;
  source: ContextSource;
  provenance: ContextProvenance;
  createdAt: string;
  metadata: Record<string, unknown>;
}

// ── Permissions ──────────────────────────────────────────────────

export type PermissionScope = 'private' | 'organization' | 'public';

/** Access model attached to every entity and relationship. */
export interface ContextPermission {
  /** Entity owner (user id). */
  owner: string;
  scope: PermissionScope;
  /** Explicitly allowed users beyond the owner. */
  allowedUsers: string[];
  /** Roles that may access (e.g. 'admin', 'member'). */
  allowedRoles: string[];
  /** Capability gates that apply (e.g. 'content-agency'). */
  capability: string[];
  /** Organization scope id when scope === 'organization'. */
  organizationId?: string;
  /** When the permission was last evaluated / granted. */
  grantedAt: string;
}

/** The result of evaluating one entity against an access request. */
export interface PermissionEvaluation {
  entityId: string;
  allowed: boolean;
  /** Why access is allowed or denied — drives the explanation. */
  reasons: string[];
}

// ── Provenance ────────────────────────────────────────────────────

/** Every context item must answer: where / when / who / why. */
export interface ContextProvenance {
  source: ContextSource;
  /** Original source id (e.g. a memory id, knowledge id, document id). */
  sourceId: string;
  createdAt: string;
  updatedAt: string;
  /** Who/what produced it (service, module, user). */
  producedBy: string;
  /** Why it exists / was selected. */
  reason?: string;
  /** Confidence attributed at the source (0–1). */
  confidence: number;
}

// ── Retrieval ────────────────────────────────────────────────────

export interface ContextRetrievalQuery {
  userId: string;
  organizationId?: string;
  query: string;
  goalId?: string;
  projectId?: string;
  taskId?: string;
  filters?: {
    sources?: ContextSource[];
    types?: FabricEntityType[];
    tags?: string[];
    minConfidence?: number;
    dateFrom?: string;
    dateTo?: string;
  };
  /** Maximum entities to return. */
  limit?: number;
}

/** One ranked retrieval candidate. */
export interface ContextRankingResult {
  entityId: string;
  /** Composite score 0–1. */
  score: number;
  /** Weighted component scores that produced the composite. */
  components: Record<string, number>;
  /** Human-readable reasons — the raw material for explanations. */
  reasons: string[];
}

export interface ContextRetrievalResult {
  query: ContextRetrievalQuery;
  entities: ContextEntity[];
  relationships: ContextRelationship[];
  ranking: ContextRankingResult[];
  total: number;
  latencyMs: number;
}

// ── Explanation ───────────────────────────────────────────────────

/** "Selected because …" model (feeds APP-004 Intelligence Trace). */
export interface ContextExplanation {
  entityId: string;
  entityLabel: string;
  selected: boolean;
  score: number;
  /** Ordered human-readable reasons. */
  reasons: string[];
}

// ── Graphs ────────────────────────────────────────────────────────

export interface GraphStats {
  entityCount: number;
  relationshipCount: number;
  countByType: Record<string, number>;
  avgConfidence: number;
}

export interface PersonalGraph {
  userId: string;
  entities: ContextEntity[];
  relationships: ContextRelationship[];
  stats: GraphStats;
}

export interface BusinessGraph {
  organizationId: string;
  entities: ContextEntity[];
  relationships: ContextRelationship[];
  stats: GraphStats;
}

// ── Context package ───────────────────────────────────────────────

export interface ContextPackageItem {
  entityId: string;
  entityLabel: string;
  type: FabricEntityType;
  /** How much of the entity content is included. */
  contentPreview: string;
  /** Estimated tokens contributed. */
  estimatedTokens: number;
  provenance: ContextProvenance;
  permission: PermissionEvaluation;
  explanation: ContextExplanation;
}

/**
 * The assembled, permission-safe, minimum-useful context package
 * consumable by Agent Builder, Execution Strategy, Execution
 * Orchestrator, Quality Engine and the future Application Factory.
 */
export interface ContextFabricPackage {
  packageId: string;
  userId: string;
  organizationId?: string;
  goalId?: string;
  taskId?: string;
  query: string;
  items: ContextPackageItem[];
  relationships: ContextRelationship[];
  relevantCapabilities: string[];
  /** Token/cost estimate for the packaged context. */
  estimatedTokens: number;
  estimatedCostUsd?: number;
  /** Unique package version (bumped per assembly). */
  contextVersion: string;
  assembledAt: string;
  /** Ordered top-level reasons for the package as a whole. */
  summary: ContextExplanation[];
}

// ── Health / diagnostics ──────────────────────────────────────────

export interface FabricHealthSource {
  source: ContextSource;
  entityCount: number;
}

export interface FabricHealth {
  entityCount: number;
  relationshipCount: number;
  personalCount: number;
  businessCount: number;
  countByType: Record<string, number>;
  countBySource: Record<string, number>;
  permissionCoverage: number;
  avgConfidence: number;
  checkedAt: string;
}
