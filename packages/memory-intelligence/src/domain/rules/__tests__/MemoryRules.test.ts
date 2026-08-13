// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Rules tests
// EI-010 — Enterprise Memory Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  canTransitionLifecycle,
  compressionStateRule,
  entityRule,
  lifecycleStatusRule,
  memoryTypeRule,
  nonNegativeRule,
  relationshipTypeRule,
  retentionPolicyRule,
  scoreRule,
  sourceTypeRule,
  titleRule,
  validateItem,
  validateRelationship,
} from '../MemoryRules.js';
import type { MemoryItem, MemoryRelationship } from '../../../types/memory-types.js';

function baseItem(): MemoryItem {
  return {
    memoryId: 'mem_test_1',
    type: 'provider',
    title: 'OpenAI reliability memory',
    content: 'Three consecutive runs completed with high quality.',
    source: 'execution history',
    sourceType: 'execution',
    owner: 'platform',
    tags: ['openai'],
    importance: { score: 0.8, level: 'high', factors: [] },
    confidence: { score: 0.85, level: 'high', factors: [] },
    usage: { totalRetrievals: 5, totalConsumers: 1, frequency: 2, recency: 0.9 },
    lifecycleStatus: 'active',
    compressionState: 'summarized',
    retentionPolicy: 'long_term',
    consumers: [],
    relationships: [],
    citations: [],
    audit: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('enum membership rules', () => {
  it('accepts valid enums and rejects unknown ones', () => {
    expect(memoryTypeRule('provider').passed).toBe(true);
    expect(memoryTypeRule('ghost' as never).passed).toBe(false);
    expect(sourceTypeRule('event').passed).toBe(true);
    expect(sourceTypeRule('ghost' as never).passed).toBe(false);
    expect(lifecycleStatusRule('active').passed).toBe(true);
    expect(lifecycleStatusRule('ghost' as never).passed).toBe(false);
    expect(compressionStateRule('summarized').passed).toBe(true);
    expect(compressionStateRule('ghost' as never).passed).toBe(false);
    expect(retentionPolicyRule('permanent').passed).toBe(true);
    expect(retentionPolicyRule('ghost' as never).passed).toBe(false);
    expect(relationshipTypeRule('recalls').passed).toBe(true);
    expect(relationshipTypeRule('ghost' as never).passed).toBe(false);
  });
});

describe('numeric bound rules', () => {
  it('enforces [0, 1] scores and non-negative counts', () => {
    expect(scoreRule(0.5, 'x').passed).toBe(true);
    expect(scoreRule(1.2, 'x').passed).toBe(false);
    expect(scoreRule(-0.1, 'x').passed).toBe(false);
    expect(scoreRule(Number.NaN, 'x').passed).toBe(false);
    expect(nonNegativeRule(3, 'x').passed).toBe(true);
    expect(nonNegativeRule(-1, 'x').passed).toBe(false);
  });
});

describe('entity shape rules', () => {
  it('requires titles of at least 3 chars and non-empty entities', () => {
    expect(titleRule('Good title').passed).toBe(true);
    expect(titleRule('ab').passed).toBe(false);
    expect(entityRule('id-1', 'memoryId').passed).toBe(true);
    expect(entityRule('  ', 'memoryId').passed).toBe(false);
  });
});

describe('validateItem', () => {
  it('passes a well-formed item', () => {
    expect(validateItem(baseItem()).passed).toBe(true);
  });

  it('rejects malformed items', () => {
    expect(validateItem({ ...baseItem(), title: 'x' }).passed).toBe(false);
    expect(validateItem({ ...baseItem(), type: 'ghost' as never }).passed).toBe(false);
    expect(
      validateItem({ ...baseItem(), confidence: { ...baseItem().confidence, score: 2 } }).passed,
    ).toBe(false);
    expect(
      validateItem({ ...baseItem(), usage: { ...baseItem().usage, frequency: -1 } }).passed,
    ).toBe(false);
    expect(validateItem({ ...baseItem(), createdAt: 'not-a-date' }).passed).toBe(false);
  });
});

describe('validateRelationship', () => {
  const relationship: MemoryRelationship = {
    relationshipId: 'mrel_1',
    type: 'recalls',
    sourceId: 'mem_a',
    targetId: 'mem_b',
    weight: 0.7,
    actor: 'platform',
    createdAt: '2026-08-01T00:00:00.000Z',
  };

  it('passes valid edges and rejects self-loops / bad shapes', () => {
    expect(validateRelationship(relationship).passed).toBe(true);
    expect(
      validateRelationship({ ...relationship, sourceId: 'mem_a', targetId: 'mem_a' }).passed,
    ).toBe(false);
    expect(validateRelationship({ ...relationship, type: 'ghost' as never }).passed).toBe(false);
    expect(validateRelationship({ ...relationship, weight: 3 }).passed).toBe(false);
  });
});

describe('canTransitionLifecycle', () => {
  it('walks the memory lifecycle forward', () => {
    expect(canTransitionLifecycle('captured', 'validated').allowed).toBe(true);
    expect(canTransitionLifecycle('validated', 'consolidated').allowed).toBe(true);
    expect(canTransitionLifecycle('consolidated', 'ranked').allowed).toBe(true);
    expect(canTransitionLifecycle('ranked', 'compressed').allowed).toBe(true);
    expect(canTransitionLifecycle('compressed', 'active').allowed).toBe(true);
  });

  it('rejects illegal jumps and allows archive/expire', () => {
    expect(canTransitionLifecycle('captured', 'active').allowed).toBe(false);
    expect(canTransitionLifecycle('validated', 'active').allowed).toBe(false);
    expect(canTransitionLifecycle('expired', 'archived').allowed).toBe(false);
    expect(canTransitionLifecycle('active', 'archived').allowed).toBe(true);
    expect(canTransitionLifecycle('archived', 'active').allowed).toBe(true);
    expect(canTransitionLifecycle('active', 'expired').allowed).toBe(true);
    expect(canTransitionLifecycle('active', 'active').allowed).toBe(true);
  });
});
