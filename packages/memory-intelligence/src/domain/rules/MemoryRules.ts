// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Rules
// EI-010 — Enterprise Memory Intelligence Platform
// Validation + lifecycle rules for memory items and relationships.
// Pure functions returning `RuleResult` (same shape as the knowledge,
// learning, and brain rules) so the application service re-validates
// at the boundary and tests can exercise each rule.
// ──────────────────────────────────────────────────────────────────

import type {
  MemoryCompressionState,
  MemoryItem,
  MemoryLifecycleStatus,
  MemoryRelationship,
  MemoryRelationshipType,
  MemoryRetentionPolicy,
  MemorySourceType,
  MemoryType,
} from '../../types/memory-types.js';
import {
  MEMORY_COMPRESSION_STATES,
  MEMORY_LIFECYCLE_STATUSES,
  MEMORY_RELATIONSHIP_TYPES,
  MEMORY_RETENTION_POLICIES,
  MEMORY_SOURCE_TYPES,
  MEMORY_TYPES,
} from '../../types/memory-types.js';

export interface RuleResult {
  passed: boolean;
  message?: string;
}

// ── Enum membership rules ───────────────────────────────────────────────────

export function memoryTypeRule(type: MemoryType): RuleResult {
  if (!MEMORY_TYPES.includes(type)) {
    return { passed: false, message: `Unknown memory type: ${type}` };
  }
  return { passed: true };
}

export function sourceTypeRule(sourceType: MemorySourceType): RuleResult {
  if (!MEMORY_SOURCE_TYPES.includes(sourceType)) {
    return { passed: false, message: `Unknown memory source type: ${sourceType}` };
  }
  return { passed: true };
}

export function lifecycleStatusRule(status: MemoryLifecycleStatus): RuleResult {
  if (!MEMORY_LIFECYCLE_STATUSES.includes(status)) {
    return { passed: false, message: `Unknown lifecycle status: ${status}` };
  }
  return { passed: true };
}

export function compressionStateRule(state: MemoryCompressionState): RuleResult {
  if (!MEMORY_COMPRESSION_STATES.includes(state)) {
    return { passed: false, message: `Unknown compression state: ${state}` };
  }
  return { passed: true };
}

export function retentionPolicyRule(policy: MemoryRetentionPolicy): RuleResult {
  if (!MEMORY_RETENTION_POLICIES.includes(policy)) {
    return { passed: false, message: `Unknown retention policy: ${policy}` };
  }
  return { passed: true };
}

export function relationshipTypeRule(type: MemoryRelationshipType): RuleResult {
  if (!MEMORY_RELATIONSHIP_TYPES.includes(type)) {
    return { passed: false, message: `Unknown relationship type: ${type}` };
  }
  return { passed: true };
}

// ── Numeric bound rules ─────────────────────────────────────────────────────

export function scoreRule(score: number, field: string): RuleResult {
  if (Number.isNaN(score) || score < 0 || score > 1) {
    return { passed: false, message: `${field} must be within [0, 1]` };
  }
  return { passed: true };
}

export function nonNegativeRule(value: number, field: string): RuleResult {
  if (Number.isNaN(value) || value < 0) {
    return { passed: false, message: `${field} must be >= 0` };
  }
  return { passed: true };
}

// ── Entity shape rules ──────────────────────────────────────────────────────

export function entityRule(entityId: string, field: string): RuleResult {
  if (!entityId || entityId.trim().length === 0) {
    return { passed: false, message: `${field} is required` };
  }
  return { passed: true };
}

export function titleRule(title: string): RuleResult {
  if (!title || title.trim().length < 3) {
    return { passed: false, message: 'title must be at least 3 characters' };
  }
  return { passed: true };
}

// ── Full item validation ────────────────────────────────────────────────────

export function validateItem(item: MemoryItem): RuleResult {
  const checks: RuleResult[] = [
    entityRule(item.memoryId, 'memoryId'),
    titleRule(item.title),
    entityRule(item.content, 'content'),
    entityRule(item.source, 'source'),
    entityRule(item.owner, 'owner'),
    memoryTypeRule(item.type),
    sourceTypeRule(item.sourceType),
    lifecycleStatusRule(item.lifecycleStatus),
    compressionStateRule(item.compressionState),
    retentionPolicyRule(item.retentionPolicy),
    scoreRule(item.importance.score, 'importance.score'),
    scoreRule(item.confidence.score, 'confidence.score'),
    nonNegativeRule(item.usage.totalRetrievals, 'usage.totalRetrievals'),
    nonNegativeRule(item.usage.frequency, 'usage.frequency'),
    scoreRule(item.usage.recency, 'usage.recency'),
  ];
  if (Number.isNaN(Date.parse(item.createdAt))) {
    return { passed: false, message: 'createdAt must be a valid ISO date' };
  }
  if (Number.isNaN(Date.parse(item.updatedAt))) {
    return { passed: false, message: 'updatedAt must be a valid ISO date' };
  }
  for (const check of checks) {
    if (!check.passed) return check;
  }
  return { passed: true };
}

// ── Relationship validation ─────────────────────────────────────────────────

export function validateRelationship(relationship: MemoryRelationship): RuleResult {
  const checks: RuleResult[] = [
    entityRule(relationship.relationshipId, 'relationshipId'),
    entityRule(relationship.sourceId, 'sourceId'),
    entityRule(relationship.targetId, 'targetId'),
    relationshipTypeRule(relationship.type),
    scoreRule(relationship.weight, 'weight'),
  ];
  if (relationship.sourceId === relationship.targetId) {
    return { passed: false, message: 'a relationship cannot connect a memory to itself' };
  }
  for (const check of checks) {
    if (!check.passed) return check;
  }
  return { passed: true };
}

// ── Lifecycle transition state machine ──────────────────────────────────────
// captured → validated → consolidated → ranked → compressed → active
// Any non-expired → archived · Any non-expired → expired
// archived → active (restore) · archived → expired
// ────────────────────────────────────────────────────────────────────────────

export function canTransitionLifecycle(
  from: MemoryLifecycleStatus,
  to: MemoryLifecycleStatus,
): { allowed: boolean; message?: string } {
  if (from === to) {
    return { allowed: true, message: 'no-op transition' };
  }
  switch (to) {
    case 'validated':
      return from === 'captured'
        ? { allowed: true }
        : { allowed: false, message: `Cannot validate a ${from} memory` };
    case 'consolidated':
      return from === 'validated'
        ? { allowed: true }
        : { allowed: false, message: `Cannot consolidate a ${from} memory` };
    case 'ranked':
      return from === 'consolidated'
        ? { allowed: true }
        : { allowed: false, message: `Cannot rank a ${from} memory` };
    case 'compressed':
      return from === 'ranked'
        ? { allowed: true }
        : { allowed: false, message: `Cannot compress a ${from} memory` };
    case 'active':
      return from === 'compressed' || from === 'archived'
        ? { allowed: true }
        : { allowed: false, message: `Cannot activate a ${from} memory` };
    case 'archived':
      return from !== 'expired'
        ? { allowed: true }
        : { allowed: false, message: 'Cannot archive an expired memory' };
    case 'expired':
      return { allowed: true };
    default:
      return { allowed: false, message: `Unknown transition target: ${to}` };
  }
}

// ── Composed validate() helper (same convention as KnowledgeRules) ──────────

export function validate(rules: RuleResult[]): RuleResult {
  for (const rule of rules) {
    if (!rule.passed) return rule;
  }
  return { passed: true };
}
