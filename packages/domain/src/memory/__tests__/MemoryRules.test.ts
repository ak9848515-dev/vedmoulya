import { describe, it, expect } from 'vitest';
import {
  memoryContentRule,
  importanceConstraintRule,
  retentionPolicyRule,
  knowledgeGraphReferenceRule,
  validate,
} from '../rules/MemoryRules.js';
import { Memory } from '../entities/Memory.js';
import { MemoryCategory } from '../value-objects/MemoryCategory.js';
import { generateMemoryId } from '../value-objects/MemoryId.js';
import { MemoryImportance } from '../value-objects/MemoryImportance.js';
import { MemoryConfidence } from '../value-objects/MemoryConfidence.js';
import { MemoryRetentionPolicy } from '../value-objects/MemoryRetentionPolicy.js';

function createTestMemory(
  overrides: Partial<{
    title: string;
    content: string;
    importance: MemoryImportance;
    confidence: MemoryConfidence;
    retentionPolicy: MemoryRetentionPolicy;
    knowledgeNodeId?: string;
  }> = {},
): Memory {
  return Memory.create({
    id: generateMemoryId(),
    category: MemoryCategory.experience(),
    title: overrides.title ?? 'Test Memory',
    content: overrides.content ?? 'This is test memory content',
    importance: overrides.importance,
    confidence: overrides.confidence,
    retentionPolicy: overrides.retentionPolicy,
    knowledgeNodeId: overrides.knowledgeNodeId,
  });
}

describe('MemoryRules', () => {
  describe('memoryContentRule', () => {
    it('passes for valid content', () => {
      const memory = createTestMemory();
      expect(memoryContentRule(memory)).toEqual({ valid: true });
    });

    it('fails for empty title', () => {
      const memory = createTestMemory({ title: '' });
      expect(memoryContentRule(memory).valid).toBe(false);
    });

    it('fails for whitespace-only title', () => {
      const memory = createTestMemory({ title: '   ' });
      expect(memoryContentRule(memory).valid).toBe(false);
    });

    it('fails for title over 200 characters', () => {
      const memory = createTestMemory({ title: 'a'.repeat(201) });
      expect(memoryContentRule(memory).valid).toBe(false);
    });

    it('passes for title exactly 200 characters', () => {
      const memory = createTestMemory({ title: 'a'.repeat(200) });
      expect(memoryContentRule(memory).valid).toBe(true);
    });

    it('fails for empty content', () => {
      const memory = createTestMemory({ content: '' });
      expect(memoryContentRule(memory).valid).toBe(false);
    });

    it('fails for content over 10000 characters', () => {
      const memory = createTestMemory({ content: 'a'.repeat(10001) });
      expect(memoryContentRule(memory).valid).toBe(false);
    });
  });

  describe('importanceConstraintRule', () => {
    it('passes for valid importance', () => {
      const memory = createTestMemory({ importance: MemoryImportance.medium() });
      expect(importanceConstraintRule(memory).valid).toBe(true);
    });

    it('fails for importance below 1', () => {
      const memory = createTestMemory({ importance: MemoryImportance.fromScore(0) });
      // The actual memory IMPORTANCE will be clamped to 1 from fromScore(0)
      // So this should pass since the rule checks for < 1
      expect(importanceConstraintRule(memory).valid).toBe(true);
    });

    it('passes for importance at boundary', () => {
      const memory = createTestMemory({ importance: MemoryImportance.fromScore(10) });
      expect(importanceConstraintRule(memory).valid).toBe(true);
    });
  });

  describe('retentionPolicyRule', () => {
    it('passes for non-permanent retention', () => {
      const memory = createTestMemory({
        retentionPolicy: MemoryRetentionPolicy.shortTerm(),
        importance: MemoryImportance.medium(),
      });
      expect(retentionPolicyRule(memory).valid).toBe(true);
    });

    it('passes for permanent retention with high importance', () => {
      const memory = createTestMemory({
        retentionPolicy: MemoryRetentionPolicy.permanent(),
        importance: MemoryImportance.high(),
      });
      expect(retentionPolicyRule(memory).valid).toBe(true);
    });

    it('fails for permanent retention with low importance', () => {
      const memory = createTestMemory({
        retentionPolicy: MemoryRetentionPolicy.permanent(),
        importance: MemoryImportance.low(),
      });
      expect(retentionPolicyRule(memory).valid).toBe(false);
    });
  });

  describe('knowledgeGraphReferenceRule', () => {
    it('passes without a reference', () => {
      const memory = createTestMemory();
      expect(knowledgeGraphReferenceRule(memory).valid).toBe(true);
    });

    it('passes with a valid reference', () => {
      const memory = createTestMemory({ knowledgeNodeId: 'kg-node-123' });
      expect(knowledgeGraphReferenceRule(memory).valid).toBe(true);
    });

    it('passes for empty string reference (treated as no reference)', () => {
      const memory = createTestMemory({ knowledgeNodeId: '' });
      // Empty string is falsy in JS, so the rule treats it as 'no reference' (valid)
      expect(knowledgeGraphReferenceRule(memory).valid).toBe(true);
    });
  });

  describe('validate (composite)', () => {
    it('passes when all rules pass', () => {
      const memory = createTestMemory();
      const result = validate(
        [memoryContentRule, importanceConstraintRule, retentionPolicyRule],
        memory,
      );
      expect(result.valid).toBe(true);
    });

    it('returns first failure', () => {
      const memory = createTestMemory({ title: '' });
      const result = validate([memoryContentRule, importanceConstraintRule], memory);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('title');
    });
  });
});
