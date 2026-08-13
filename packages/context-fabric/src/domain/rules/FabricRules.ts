// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Rules
// APP-001 — Post-V1 Application Platform Layer
// Pure deterministic rules: valid relationship endpoints, permission
// scoping, composite ranking weights, token estimation and identity
// helpers. No I/O — every function is a pure function over the
// fabric types so the rules stay unit-testable and provider-free.
// ──────────────────────────────────────────────────────────────────

import type {
  BusinessEntityType,
  ContextEntity,
  ContextRelationship,
  ContextRelationshipType,
  ContextSource,
  FabricEntityType,
  PersonalEntityType,
} from '../../types/fabric-types.js';

// ── Identity ──────────────────────────────────────────────────────

/** Stable graph entity ids (scoped, so future graph stores key cleanly). */
export function entityId(graph: 'personal' | 'business', type: string, seed: string): string {
  return `${graph}:${type}:${seed}`;
}

export function isPersonalType(type: FabricEntityType): type is PersonalEntityType {
  return [
    'user',
    'goal',
    'project',
    'task',
    'skill',
    'knowledge',
    'memory',
    'document',
    'application',
    'preference',
    'work_history',
    'learning_history',
    'ai_interaction',
  ].includes(type);
}

export function isBusinessType(type: FabricEntityType): type is BusinessEntityType {
  return [
    'organization',
    'person',
    'team',
    'client',
    'project',
    'process',
    'application',
    'document',
    'policy',
    'knowledge',
    'business_capability',
  ].includes(type);
}

// ── Relationship validity ─────────────────────────────────────────

/** Canonical allowed relationship endpoint kinds (business/enterprise graph). */
const BUSINESS_RELATIONSHIP_ENDPOINTS: Record<ContextRelationshipType, [string, string][]> = {
  member_of: [
    ['person', 'team'],
    ['person', 'organization'],
    ['team', 'organization'],
  ],
  owns: [
    ['organization', 'project'],
    ['organization', 'application'],
    ['person', 'project'],
    ['team', 'project'],
  ],
  uses: [
    ['project', 'application'],
    ['person', 'application'],
    ['process', 'application'],
  ],
  implements: [
    ['application', 'business_capability'],
    ['project', 'business_capability'],
  ],
  describes: [
    ['document', 'project'],
    ['document', 'process'],
    ['document', 'application'],
    ['document', 'organization'],
  ],
  responsible_for: [
    ['person', 'project'],
    ['person', 'process'],
    ['person', 'task'],
    ['team', 'project'],
  ],
  related_to: [
    ['document', 'document'],
    ['project', 'project'],
    ['knowledge', 'knowledge'],
    ['person', 'person'],
  ],
  depends_on: [
    ['project', 'project'],
    ['application', 'application'],
    ['process', 'process'],
    ['task', 'task'],
  ],
  produced_by: [
    ['document', 'person'],
    ['document', 'process'],
    ['knowledge', 'person'],
    ['knowledge', 'system'],
  ],
  references: [
    ['document', 'knowledge'],
    ['document', 'document'],
    ['knowledge', 'knowledge'],
  ],
  part_of: [
    ['team', 'organization'],
    ['process', 'organization'],
    ['application', 'organization'],
    ['project', 'organization'],
  ],
  supports: [
    ['business_capability', 'goal'],
    ['business_capability', 'project'],
    ['knowledge', 'project'],
  ],
  manages: [
    ['person', 'team'],
    ['person', 'person'],
    ['person', 'project'],
  ],
  precedes: [
    ['task', 'task'],
    ['project', 'project'],
    ['process', 'process'],
  ],
};

/** Personal-graph relationship endpoints (who the user is). */
const PERSONAL_RELATIONSHIP_ENDPOINTS: Record<ContextRelationshipType, [string, string][]> = {
  member_of: [
    ['user', 'organization'],
    ['user', 'team'],
    ['skill', 'skill'],
  ],
  owns: [
    ['user', 'goal'],
    ['user', 'project'],
    ['user', 'document'],
    ['user', 'application'],
  ],
  uses: [
    ['goal', 'application'],
    ['project', 'application'],
    ['user', 'application'],
  ],
  implements: [
    ['application', 'skill'],
    ['project', 'skill'],
  ],
  describes: [
    ['document', 'project'],
    ['document', 'knowledge'],
  ],
  responsible_for: [
    ['user', 'goal'],
    ['user', 'project'],
    ['user', 'task'],
    ['user', 'work_history'],
  ],
  related_to: [
    ['goal', 'goal'],
    ['project', 'project'],
    ['knowledge', 'knowledge'],
    ['memory', 'memory'],
    ['skill', 'skill'],
  ],
  depends_on: [
    ['goal', 'goal'],
    ['project', 'project'],
    ['task', 'task'],
    ['goal', 'project'],
  ],
  produced_by: [
    ['knowledge', 'user'],
    ['document', 'user'],
    ['memory', 'user'],
    ['learning_history', 'user'],
  ],
  references: [
    ['document', 'knowledge'],
    ['document', 'memory'],
    ['knowledge', 'memory'],
  ],
  part_of: [
    ['task', 'project'],
    ['project', 'goal'],
    ['skill', 'learning_history'],
  ],
  supports: [
    ['knowledge', 'goal'],
    ['memory', 'goal'],
    ['skill', 'goal'],
    ['preference', 'goal'],
  ],
  manages: [
    ['user', 'project'],
    ['user', 'task'],
  ],
  precedes: [
    ['task', 'task'],
    ['work_history', 'work_history'],
    ['learning_history', 'learning_history'],
  ],
};

/**
 * Whether a relationship edge is structurally valid for its graph.
 * Returns the reason when invalid (or undefined when valid).
 */
export function relationshipEndpointRule(
  graph: 'personal' | 'business',
  relationship: ContextRelationship,
  from: ContextEntity,
  to: ContextEntity,
): string | undefined {
  const table =
    graph === 'business' ? BUSINESS_RELATIONSHIP_ENDPOINTS : PERSONAL_RELATIONSHIP_ENDPOINTS;
  const allowed = table[relationship.type];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive guard for unvalidated runtime input
  if (!allowed) return `unknown relationship type: ${relationship.type}`;
  const ok = allowed.some(([a, b]) => a === from.type && b === to.type);
  if (!ok) {
    return `invalid ${relationship.type} edge: ${from.type} → ${to.type}`;
  }
  return undefined;
}

/** True when a relationship edge is structurally valid. */
export function isRelationshipValid(
  graph: 'personal' | 'business',
  relationship: ContextRelationship,
  from: ContextEntity,
  to: ContextEntity,
): boolean {
  return relationshipEndpointRule(graph, relationship, from, to) === undefined;
}

// ── Sources ───────────────────────────────────────────────────────

export function isValidSource(source: string): source is ContextSource {
  return [
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
    'user_input',
  ].includes(source);
}

// ── Composite ranking weights ─────────────────────────────────────

export interface FabricRankWeights {
  relevance: number;
  graphProximity: number;
  recency: number;
  confidence: number;
  permission: number;
}

export const DEFAULT_RANK_WEIGHTS: FabricRankWeights = {
  relevance: 0.4,
  graphProximity: 0.25,
  recency: 0.15,
  confidence: 0.1,
  permission: 0.1,
};

export function validateWeights(weights: FabricRankWeights): string | undefined {
  const total =
    weights.relevance +
    weights.graphProximity +
    weights.recency +
    weights.confidence +
    weights.permission;
  if (Math.abs(total - 1) > 1e-6) return `weights must sum to 1 (got ${total})`;
  for (const value of Object.values(weights)) {
    if (value < 0 || value > 1) return `weight out of range: ${value}`;
  }
  return undefined;
}

// ── Token estimation ──────────────────────────────────────────────

const TOKENS_PER_CHAR = 0.27; // ~3.7 chars/token (standard approximation)

export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length * TOKENS_PER_CHAR));
}

export function estimatePackageTokens(contentPreviews: string[]): number {
  return contentPreviews.reduce((sum, preview) => sum + estimateTokens(preview), 0);
}
