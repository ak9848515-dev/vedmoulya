// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Rules
// EI-009 — Enterprise Knowledge Intelligence Platform
// Validation + lifecycle rules for knowledge items, relationships, and
// versions. Pure functions returning `RuleResult` (same shape as the
// capability registry, learning, and brain rules) so the application
// service re-validates at the boundary and tests can exercise each rule.
// ──────────────────────────────────────────────────────────────────

import type {
  KnowledgeCategory,
  KnowledgeItem,
  KnowledgeLifecycleStatus,
  KnowledgeRelationship,
  KnowledgeRelationshipType,
  KnowledgeSourceType,
  KnowledgeValidationStatus,
  KnowledgeVersion,
} from '../../types/knowledge-types.js';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_LIFECYCLE_STATUSES,
  KNOWLEDGE_RELATIONSHIP_TYPES,
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_VALIDATION_STATUSES,
} from '../../types/knowledge-types.js';

export interface RuleResult {
  passed: boolean;
  message?: string;
}

// ── Enum membership rules ───────────────────────────────────────────────────

export function categoryRule(category: KnowledgeCategory): RuleResult {
  if (!KNOWLEDGE_CATEGORIES.includes(category)) {
    return { passed: false, message: `Unknown knowledge category: ${category}` };
  }
  return { passed: true };
}

export function sourceTypeRule(sourceType: KnowledgeSourceType): RuleResult {
  if (!KNOWLEDGE_SOURCE_TYPES.includes(sourceType)) {
    return { passed: false, message: `Unknown knowledge source type: ${sourceType}` };
  }
  return { passed: true };
}

export function lifecycleStatusRule(status: KnowledgeLifecycleStatus): RuleResult {
  if (!KNOWLEDGE_LIFECYCLE_STATUSES.includes(status)) {
    return { passed: false, message: `Unknown lifecycle status: ${status}` };
  }
  return { passed: true };
}

export function validationStatusRule(status: KnowledgeValidationStatus): RuleResult {
  if (!KNOWLEDGE_VALIDATION_STATUSES.includes(status)) {
    return { passed: false, message: `Unknown validation status: ${status}` };
  }
  return { passed: true };
}

export function relationshipTypeRule(type: KnowledgeRelationshipType): RuleResult {
  if (!KNOWLEDGE_RELATIONSHIP_TYPES.includes(type)) {
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

export function versionNumberRule(version: number): RuleResult {
  if (!Number.isInteger(version) || version < 1) {
    return { passed: false, message: 'version must be an integer >= 1' };
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

export function validateItem(item: KnowledgeItem): RuleResult {
  const checks: RuleResult[] = [
    entityRule(item.knowledgeId, 'knowledgeId'),
    titleRule(item.title),
    entityRule(item.description, 'description'),
    entityRule(item.source, 'source'),
    entityRule(item.owner, 'owner'),
    categoryRule(item.category),
    sourceTypeRule(item.sourceType),
    lifecycleStatusRule(item.lifecycleStatus),
    validationStatusRule(item.validationStatus),
    scoreRule(item.trust.score, 'trust.score'),
    scoreRule(item.confidence.score, 'confidence.score'),
    versionNumberRule(item.version),
    nonNegativeRule(item.usage.totalReads, 'usage.totalReads'),
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

export function validateRelationship(relationship: KnowledgeRelationship): RuleResult {
  const checks: RuleResult[] = [
    entityRule(relationship.relationshipId, 'relationshipId'),
    entityRule(relationship.sourceId, 'sourceId'),
    entityRule(relationship.targetId, 'targetId'),
    relationshipTypeRule(relationship.type),
    scoreRule(relationship.weight, 'weight'),
  ];
  if (relationship.sourceId === relationship.targetId) {
    return { passed: false, message: 'a relationship cannot connect an item to itself' };
  }
  for (const check of checks) {
    if (!check.passed) return check;
  }
  return { passed: true };
}

// ── Version validation ──────────────────────────────────────────────────────

export function validateVersion(version: KnowledgeVersion): RuleResult {
  const checks: RuleResult[] = [
    entityRule(version.versionId, 'versionId'),
    entityRule(version.knowledgeId, 'knowledgeId'),
    versionNumberRule(version.versionNumber),
    titleRule(version.title),
  ];
  if (Number.isNaN(Date.parse(version.createdAt))) {
    return { passed: false, message: 'createdAt must be a valid ISO date' };
  }
  for (const check of checks) {
    if (!check.passed) return check;
  }
  return { passed: true };
}

// ── Lifecycle transition state machine ──────────────────────────────────────
// draft → review → active → deprecated → archived
//        ↘ active (review approved)     ↘ active (re-activation allowed)
// draft → archived (abandoned)
// ────────────────────────────────────────────────────────────────────────────

export function canTransitionLifecycle(
  from: KnowledgeLifecycleStatus,
  to: KnowledgeLifecycleStatus,
): { allowed: boolean; message?: string } {
  if (from === to) {
    return { allowed: true, message: 'no-op transition' };
  }
  switch (to) {
    case 'review':
      return from === 'draft'
        ? { allowed: true }
        : { allowed: false, message: `Cannot send a ${from} item to review` };
    case 'active':
      return from === 'review' || from === 'deprecated'
        ? { allowed: true }
        : { allowed: false, message: `Cannot activate a ${from} item` };
    case 'deprecated':
      return from === 'active'
        ? { allowed: true }
        : { allowed: false, message: `Cannot deprecate a ${from} item` };
    case 'archived':
      return from === 'draft' || from === 'deprecated'
        ? { allowed: true }
        : { allowed: false, message: `Cannot archive a ${from} item` };
    case 'draft':
      return from === 'review'
        ? { allowed: true }
        : { allowed: false, message: `Cannot return a ${from} item to draft` };
    default:
      // Unreachable for typed callers (every target is a case); kept for
      // runtime safety against untyped input.
      return { allowed: false, message: `Unknown transition target: ${String(to)}` };
  }
}

// ── Validation transition rules ─────────────────────────────────────────────
// unvalidated → pending → validated · any → failed · failed → pending

export function canTransitionValidation(
  from: KnowledgeValidationStatus,
  to: KnowledgeValidationStatus,
): { allowed: boolean; message?: string } {
  if (from === to) return { allowed: true };
  if (to === 'failed') {
    return from === 'pending' || from === 'validated'
      ? { allowed: true }
      : { allowed: false, message: `Cannot mark a ${from} item as failed` };
  }
  if (to === 'pending') {
    return from === 'unvalidated' || from === 'failed'
      ? { allowed: true }
      : { allowed: false, message: `Cannot re-open a ${from} item for validation` };
  }
  if (to === 'validated') {
    return from === 'pending'
      ? { allowed: true }
      : { allowed: false, message: 'Only pending items can be validated' };
  }
  return { allowed: false, message: `Unknown validation transition: ${to}` };
}

// ── Composed validate() helper (same convention as CapabilityRules) ─────────

export function validate(rules: RuleResult[]): RuleResult {
  for (const rule of rules) {
    if (!rule.passed) return rule;
  }
  return { passed: true };
}
