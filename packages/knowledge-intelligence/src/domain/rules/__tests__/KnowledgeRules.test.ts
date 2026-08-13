// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Rules tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  canTransitionLifecycle,
  canTransitionValidation,
  categoryRule,
  entityRule,
  lifecycleStatusRule,
  nonNegativeRule,
  relationshipTypeRule,
  scoreRule,
  sourceTypeRule,
  titleRule,
  validate,
  validateItem,
  validateRelationship,
  validateVersion,
  validationStatusRule,
  versionNumberRule,
} from '../KnowledgeRules.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

const seedItem = createCatalogKnowledgeItems()[0];

describe('KnowledgeRules', () => {
  it('accepts known categories and rejects unknown ones', () => {
    expect(categoryRule('ai').passed).toBe(true);
    expect(categoryRule('sap').passed).toBe(true);
    expect(categoryRule('alien').passed).toBe(false);
  });

  it('accepts known source types and rejects unknown ones', () => {
    expect(sourceTypeRule('repository').passed).toBe(true);
    expect(sourceTypeRule('conversation').passed).toBe(true);
    expect(sourceTypeRule('telepathy').passed).toBe(false);
  });

  it('accepts known lifecycle/validation statuses and rejects unknown ones', () => {
    expect(lifecycleStatusRule('active').passed).toBe(true);
    expect(lifecycleStatusRule('shipped').passed).toBe(false);
    expect(validationStatusRule('validated').passed).toBe(true);
    expect(validationStatusRule('maybe').passed).toBe(false);
  });

  it('accepts the ten relationship types and rejects unknown ones', () => {
    for (const type of [
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
    ]) {
      expect(relationshipTypeRule(type as never).passed).toBe(true);
    }
    expect(relationshipTypeRule('borrows' as never).passed).toBe(false);
  });

  it('bounds scores and non-negative numbers', () => {
    expect(scoreRule(0.5, 'trust').passed).toBe(true);
    expect(scoreRule(1.2, 'trust').passed).toBe(false);
    expect(scoreRule(-0.1, 'trust').passed).toBe(false);
    expect(scoreRule(Number.NaN, 'trust').passed).toBe(false);
    expect(nonNegativeRule(3, 'reads').passed).toBe(true);
    expect(nonNegativeRule(-1, 'reads').passed).toBe(false);
  });

  it('enforces entity and title shape', () => {
    expect(entityRule('kn_1', 'knowledgeId').passed).toBe(true);
    expect(entityRule('  ', 'knowledgeId').passed).toBe(false);
    expect(titleRule('The blog playbook').passed).toBe(true);
    expect(titleRule('ab').passed).toBe(false);
  });

  it('enforces version numbers', () => {
    expect(versionNumberRule(1).passed).toBe(true);
    expect(versionNumberRule(0).passed).toBe(false);
    expect(versionNumberRule(1.5).passed).toBe(false);
  });

  it('validates seed items (shape-clean catalog)', () => {
    for (const item of createCatalogKnowledgeItems()) {
      expect(
        validateItem(item).passed,
        `${item.knowledgeId}: ${validateItem(item).message ?? ''}`,
      ).toBe(true);
    }
  });

  it('rejects a malformed item', () => {
    expect(
      validateItem({
        ...seedItem,
        knowledgeId: '',
        trust: { ...seedItem.trust, score: 1.5 },
        createdAt: 'not-a-date',
      }).passed,
    ).toBe(false);
  });

  it('rejects self-loop and empty relationships', () => {
    expect(
      validateRelationship({ ...seedItem.relationships[0], sourceId: 'same', targetId: 'same' })
        .passed,
    ).toBe(false);
    expect(
      validateRelationship({ ...seedItem.relationships[0], sourceId: '', targetId: 't' }).passed,
    ).toBe(false);
  });

  it('accepts a valid relationship and rejects invalid weight', () => {
    const valid = seedItem.relationships[0];
    expect(validateRelationship(valid).passed).toBe(true);
    expect(validateRelationship({ ...valid, weight: 2 }).passed).toBe(false);
  });

  it('validates versions', () => {
    const version = {
      versionId: 'ver_1',
      knowledgeId: 'kn_1',
      versionNumber: 2,
      title: 'Title',
      description: 'Desc',
      tags: [],
      changeSummary: 'sum',
      actor: 'owner',
      createdAt: '2026-08-01T00:00:00.000Z',
    };
    expect(validateVersion(version).passed).toBe(true);
    expect(validateVersion({ ...version, versionNumber: 0 }).passed).toBe(false);
    expect(validateVersion({ ...version, createdAt: 'soon' }).passed).toBe(false);
  });

  describe('lifecycle transitions', () => {
    it('follows draft → review → active → deprecated → archived', () => {
      expect(canTransitionLifecycle('draft', 'review').allowed).toBe(true);
      expect(canTransitionLifecycle('review', 'active').allowed).toBe(true);
      expect(canTransitionLifecycle('active', 'deprecated').allowed).toBe(true);
      expect(canTransitionLifecycle('deprecated', 'archived').allowed).toBe(true);
    });

    it('permits draft → archived and deprecated → active re-activation', () => {
      expect(canTransitionLifecycle('draft', 'archived').allowed).toBe(true);
      expect(canTransitionLifecycle('deprecated', 'active').allowed).toBe(true);
    });

    it('rejects illegal jumps', () => {
      expect(canTransitionLifecycle('draft', 'active').allowed).toBe(false);
      expect(canTransitionLifecycle('active', 'draft').allowed).toBe(false);
      expect(canTransitionLifecycle('archived', 'active').allowed).toBe(false);
      expect(canTransitionLifecycle('review', 'archived').allowed).toBe(false);
    });
  });

  describe('validation transitions', () => {
    it('follows unvalidated → pending → validated', () => {
      expect(canTransitionValidation('unvalidated', 'pending').allowed).toBe(true);
      expect(canTransitionValidation('pending', 'validated').allowed).toBe(true);
    });

    it('permits failures and re-opens', () => {
      expect(canTransitionValidation('pending', 'failed').allowed).toBe(true);
      expect(canTransitionValidation('validated', 'failed').allowed).toBe(true);
      expect(canTransitionValidation('failed', 'pending').allowed).toBe(true);
    });

    it('rejects illegal validation jumps', () => {
      expect(canTransitionValidation('unvalidated', 'validated').allowed).toBe(false);
      expect(canTransitionValidation('failed', 'validated').allowed).toBe(false);
    });
  });

  it('composes rules with validate()', () => {
    expect(validate([{ passed: true }, { passed: true }]).passed).toBe(true);
    const failing = validate([{ passed: true }, { passed: false, message: 'nope' }]);
    expect(failing.passed).toBe(false);
    expect(failing.message).toBe('nope');
  });
});
