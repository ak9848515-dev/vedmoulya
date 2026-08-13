// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Rules tests
// APP-001 — Post-V1 Application Platform Layer
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RANK_WEIGHTS,
  entityId,
  estimatePackageTokens,
  estimateTokens,
  isBusinessType,
  isPersonalType,
  isRelationshipValid,
  isValidSource,
  relationshipEndpointRule,
  validateWeights,
} from '../FabricRules.js';
import type { ContextEntity, ContextRelationship } from '../../../types/fabric-types.js';

function entity(type: ContextEntity['type'], id: string): ContextEntity {
  return {
    entityId: id,
    graph:
      type === 'organization' || type === 'person' || type === 'team' ? 'business' : 'personal',
    type,
    label: id,
    ownerId: 'user_001',
    tags: [],
    confidence: 0.9,
    lifecycle: 'active',
    source: 'import',
    provenance: {
      source: 'import',
      sourceId: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      producedBy: 'test',
      confidence: 0.9,
    },
    permissions: {
      owner: 'user_001',
      scope: 'private',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      grantedAt: new Date().toISOString(),
    },
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('FabricRules', () => {
  describe('identity helpers', () => {
    it('builds scoped entity ids', () => {
      expect(entityId('personal', 'goal', 'g1')).toBe('personal:goal:g1');
      expect(entityId('business', 'team', 't1')).toBe('business:team:t1');
    });

    it('classifies personal and business types', () => {
      expect(isPersonalType('goal')).toBe(true);
      expect(isPersonalType('skill')).toBe(true);
      expect(isBusinessType('organization')).toBe(true);
      expect(isPersonalType('organization')).toBe(false);
      expect(isBusinessType('task')).toBe(false);
    });
  });

  describe('relationship endpoint rules', () => {
    it('accepts valid business edges', () => {
      const person = entity('person', 'p1');
      const team = entity('team', 't1');
      const rel: ContextRelationship = {
        relationshipId: 'r1',
        fromId: 'p1',
        toId: 't1',
        type: 'member_of',
        weight: 1,
        confidence: 0.9,
        source: 'inference',
        provenance: person.provenance,
        createdAt: person.createdAt,
        metadata: {},
      };
      expect(relationshipEndpointRule('business', rel, person, team)).toBeUndefined();
      expect(isRelationshipValid('business', rel, person, team)).toBe(true);
    });

    it('rejects invalid edges (person member_of person in business graph)', () => {
      const a = entity('person', 'a');
      const b = entity('person', 'b');
      const rel: ContextRelationship = {
        relationshipId: 'r2',
        fromId: 'a',
        toId: 'b',
        type: 'member_of',
        weight: 1,
        confidence: 0.9,
        source: 'inference',
        provenance: a.provenance,
        createdAt: a.createdAt,
        metadata: {},
      };
      expect(relationshipEndpointRule('business', rel, a, b)).toContain('invalid');
      expect(isRelationshipValid('business', rel, a, b)).toBe(false);
    });

    it('accepts valid personal edges (user owns goal)', () => {
      const user = entity('user', 'u');
      const goal = entity('goal', 'g');
      const rel: ContextRelationship = {
        relationshipId: 'r3',
        fromId: 'u',
        toId: 'g',
        type: 'owns',
        weight: 1,
        confidence: 0.9,
        source: 'inference',
        provenance: user.provenance,
        createdAt: user.createdAt,
        metadata: {},
      };
      expect(relationshipEndpointRule('personal', rel, user, goal)).toBeUndefined();
    });
  });

  describe('sources', () => {
    it('validates known sources and rejects unknown', () => {
      expect(isValidSource('memory')).toBe(true);
      expect(isValidSource('knowledge')).toBe(true);
      expect(isValidSource('not_a_source')).toBe(false);
    });
  });

  describe('ranking weights', () => {
    it('default weights sum to 1', () => {
      const sum = Object.values(DEFAULT_RANK_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
      expect(validateWeights(DEFAULT_RANK_WEIGHTS)).toBeUndefined();
    });

    it('rejects weights that do not sum to 1', () => {
      expect(
        validateWeights({
          relevance: 1,
          graphProximity: 1,
          recency: 0,
          confidence: 0,
          permission: 0,
        }),
      ).toContain('must sum to 1');
    });

    it('rejects out-of-range weights', () => {
      expect(
        validateWeights({
          relevance: 2,
          graphProximity: -1,
          recency: 0,
          confidence: 0,
          permission: 0,
        }),
      ).toContain('out of range');
    });
  });

  describe('token estimation', () => {
    it('estimates tokens per character with a floor', () => {
      expect(estimateTokens('')).toBe(1);
      expect(estimateTokens('short')).toBeGreaterThan(0);
      expect(estimateTokens('x'.repeat(100))).toBe(Math.round(100 * 0.27));
    });

    it('sums package tokens', () => {
      expect(estimatePackageTokens(['abc', 'defg'])).toBe(
        estimateTokens('abc') + estimateTokens('defg'),
      );
    });
  });
});
