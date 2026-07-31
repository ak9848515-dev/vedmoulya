import { describe, it, expect } from 'vitest';
import { MemoryCategory } from '../value-objects/MemoryCategory.js';

describe('MemoryCategory', () => {
  describe('static factory methods', () => {
    const categories = [
      'observation',
      'experience',
      'reflection',
      'context',
      'history',
      'conversation',
      'insight',
      'lesson',
      'pattern',
      'preference',
      'routine',
      'interaction',
      'feedback',
      'mood',
      'event',
    ] as const;

    for (const cat of categories) {
      it(`creates ${cat} category`, () => {
        const category = MemoryCategory[cat as keyof typeof MemoryCategory]();
        expect(category.value).toBe(cat);
      });
    }
  });

  describe('create with validation', () => {
    it('creates from valid category string', () => {
      const category = MemoryCategory.create('reflection');
      expect(category.value).toBe('reflection');
    });

    it('throws for invalid category string', () => {
      expect(() => MemoryCategory.create('invalid_category')).toThrow('Invalid memory category');
    });

    it('throws for empty string', () => {
      expect(() => MemoryCategory.create('')).toThrow('Invalid memory category');
    });
  });

  describe('equals', () => {
    it('returns true for same category', () => {
      const a = MemoryCategory.observation();
      const b = MemoryCategory.observation();
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different categories', () => {
      const a = MemoryCategory.observation();
      const b = MemoryCategory.reflection();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns the category value', () => {
      const category = MemoryCategory.insight();
      expect(category.toString()).toBe('insight');
    });
  });
});
