// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Validation Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Validates a knowledge item against the platform's quality contract:
// required fields, valid dates, bounded scores, citation expectations
// for documentary sources, relationship integrity, and dependency
// targets. Produces a `KnowledgeValidationReport` (passed + issues).
// Pure and deterministic — no I/O.
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeItem, KnowledgeValidationReport } from '../../types/knowledge-types.js';
import {
  categoryRule,
  entityRule,
  lifecycleStatusRule,
  scoreRule,
  sourceTypeRule,
  titleRule,
  validateItem,
  validationStatusRule,
  versionNumberRule,
} from '../rules/KnowledgeRules.js';

export class KnowledgeValidationService {
  /** Full validation → report. Optionally requires all relationships to have
   *  their targets resolved (existing in the registry) before passing. */
  validate(
    item: KnowledgeItem,
    options: { requireResolvedRelationships?: boolean; knownIds?: Set<string> } = {},
  ): KnowledgeValidationReport {
    const issues: string[] = [];

    // 1. Core shape rules.
    const shape = validateItem(item);
    if (!shape.passed) issues.push(shape.message ?? 'item shape invalid');

    // 2. Explicit checks with human-readable issues (not just the first failure).
    for (const rule of [
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
    ]) {
      if (!rule.passed) issues.push(rule.message ?? 'invalid field');
    }

    // 3. Dates.
    if (Number.isNaN(Date.parse(item.createdAt))) issues.push('createdAt must be a valid ISO date');
    if (Number.isNaN(Date.parse(item.updatedAt))) issues.push('updatedAt must be a valid ISO date');

    // 4. Citation expectation for documentary sources.
    if (
      (item.sourceType === 'document' || item.sourceType === 'report') &&
      item.citations.length === 0
    ) {
      issues.push('documentary knowledge should carry at least one citation');
    }

    // 5. Relationship integrity.
    if (item.relationships.some((r) => r.sourceId === r.targetId)) {
      issues.push('relationship self-loops are not allowed');
    }
    const edgeKeys = new Set<string>();
    for (const r of item.relationships) {
      const key = `${r.type}:${r.sourceId}:${r.targetId}`;
      if (edgeKeys.has(key)) issues.push(`duplicate relationship edge ${key}`);
      edgeKeys.add(key);
    }

    // 6. Dependency targets must resolve (when known ids are provided).
    if (options.requireResolvedRelationships && options.knownIds) {
      for (const dependency of item.dependencies) {
        if (!options.knownIds.has(dependency.targetId)) {
          issues.push(`dependency target ${dependency.targetId} does not exist in the registry`);
        }
      }
      for (const r of item.relationships) {
        if (r.targetId !== item.knowledgeId && !options.knownIds.has(r.targetId)) {
          issues.push(`relationship target ${r.targetId} does not exist in the registry`);
        }
      }
    }

    return {
      knowledgeId: item.knowledgeId,
      passed: issues.length === 0,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }
}
