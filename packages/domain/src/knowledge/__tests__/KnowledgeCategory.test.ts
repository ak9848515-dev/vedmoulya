import { describe, it, expect } from 'vitest';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';

describe('KnowledgeCategory', () => {
  describe('static factory methods', () => {
    it('creates common categories', () => {
      expect(KnowledgeCategory.user().value).toBe('user');
      expect(KnowledgeCategory.goal().value).toBe('goal');
      expect(KnowledgeCategory.skill().value).toBe('skill');
      expect(KnowledgeCategory.knowledge().value).toBe('knowledge');
      expect(KnowledgeCategory.project().value).toBe('project');
      expect(KnowledgeCategory.learning().value).toBe('learning');
      expect(KnowledgeCategory.decision().value).toBe('decision');
      expect(KnowledgeCategory.career().value).toBe('career');
      expect(KnowledgeCategory.business().value).toBe('business');
      expect(KnowledgeCategory.evidence().value).toBe('evidence');
      expect(KnowledgeCategory.competency().value).toBe('competency');
      expect(KnowledgeCategory.artifact().value).toBe('artifact');
      expect(KnowledgeCategory.memory().value).toBe('memory');
      expect(KnowledgeCategory.portfolio().value).toBe('portfolio');
      expect(KnowledgeCategory.reference().value).toBe('reference');
    });
  });

  describe('create with validation', () => {
    it('accepts valid category strings', () => {
      const cat = KnowledgeCategory.create('skill');
      expect(cat.value).toBe('skill');
    });

    it('accepts all known categories', () => {
      const categories = [
        'user',
        'goal',
        'skill',
        'knowledge',
        'mission',
        'project',
        'task',
        'habit',
        'learning',
        'course',
        'book',
        'career',
        'job',
        'interview',
        'company',
        'business',
        'client',
        'service',
        'income',
        'expense',
        'decision',
        'problem',
        'opportunity',
        'achievement',
        'milestone',
        'portfolio',
        'document',
        'conversation',
        'memory',
        'relationship',
        'timeline_event',
        'competency',
        'evidence',
        'artifact',
        'reference',
      ];
      for (const cat of categories) {
        expect(() => KnowledgeCategory.create(cat)).not.toThrow();
      }
    });

    it('rejects invalid category strings', () => {
      expect(() => KnowledgeCategory.create('invalid')).toThrow('Invalid knowledge category');
      expect(() => KnowledgeCategory.create('')).toThrow('Invalid knowledge category');
      expect(() => KnowledgeCategory.create('USER')).toThrow('Invalid knowledge category');
    });
  });

  describe('equals', () => {
    it('same category is equal', () => {
      expect(KnowledgeCategory.skill().equals(KnowledgeCategory.skill())).toBe(true);
    });

    it('different categories are not equal', () => {
      expect(KnowledgeCategory.skill().equals(KnowledgeCategory.knowledge())).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns the category value', () => {
      expect(KnowledgeCategory.business().toString()).toBe('business');
      expect(KnowledgeCategory.create('memory').toString()).toBe('memory');
    });
  });
});
