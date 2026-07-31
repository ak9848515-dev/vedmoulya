import { describe, it, expect } from 'vitest';
import { MemoryImportance } from '../value-objects/MemoryImportance.js';

describe('MemoryImportance', () => {
  describe('static factory methods', () => {
    it('critical has score 10', () => {
      const imp = MemoryImportance.critical();
      expect(imp.level).toBe('critical');
      expect(imp.score).toBe(10);
    });

    it('high has score 7', () => {
      const imp = MemoryImportance.high();
      expect(imp.level).toBe('high');
      expect(imp.score).toBe(7);
    });

    it('medium has score 5', () => {
      const imp = MemoryImportance.medium();
      expect(imp.level).toBe('medium');
      expect(imp.score).toBe(5);
    });

    it('low has score 3', () => {
      const imp = MemoryImportance.low();
      expect(imp.level).toBe('low');
      expect(imp.score).toBe(3);
    });

    it('trivial has score 1', () => {
      const imp = MemoryImportance.trivial();
      expect(imp.level).toBe('trivial');
      expect(imp.score).toBe(1);
    });
  });

  describe('fromScore', () => {
    it('creates critical for score >= 9', () => {
      expect(MemoryImportance.fromScore(9).level).toBe('critical');
      expect(MemoryImportance.fromScore(10).level).toBe('critical');
    });

    it('creates high for score 6-8', () => {
      expect(MemoryImportance.fromScore(6).level).toBe('high');
      expect(MemoryImportance.fromScore(7).level).toBe('high');
      expect(MemoryImportance.fromScore(8).level).toBe('high');
    });

    it('creates medium for score 4-5', () => {
      expect(MemoryImportance.fromScore(4).level).toBe('medium');
      expect(MemoryImportance.fromScore(5).level).toBe('medium');
    });

    it('creates low for score 2-3', () => {
      expect(MemoryImportance.fromScore(2).level).toBe('low');
      expect(MemoryImportance.fromScore(3).level).toBe('low');
    });

    it('creates trivial for score 1', () => {
      expect(MemoryImportance.fromScore(1).level).toBe('trivial');
    });

    it('clamps to range 1-10', () => {
      expect(MemoryImportance.fromScore(0).level).toBe('trivial');
      expect(MemoryImportance.fromScore(0).score).toBe(1);
      expect(MemoryImportance.fromScore(15).score).toBe(10);
    });
  });

  describe('fromLevel', () => {
    it('parses valid level strings', () => {
      expect(MemoryImportance.fromLevel('critical').score).toBe(10);
      expect(MemoryImportance.fromLevel('high').score).toBe(7);
      expect(MemoryImportance.fromLevel('medium').score).toBe(5);
      expect(MemoryImportance.fromLevel('low').score).toBe(3);
      expect(MemoryImportance.fromLevel('unknown')).toBeDefined();
    });
  });

  describe('boost', () => {
    it('increases importance score', () => {
      const imp = MemoryImportance.medium().boost(2);
      expect(imp.score).toBe(7);
      expect(imp.level).toBe('high');
    });

    it('caps at 10', () => {
      const imp = MemoryImportance.critical().boost(5);
      expect(imp.score).toBe(10);
    });
  });

  describe('reduce', () => {
    it('decreases importance score', () => {
      const imp = MemoryImportance.high().reduce(3);
      expect(imp.score).toBe(4);
      expect(imp.level).toBe('medium');
    });

    it('floors at 1', () => {
      const imp = MemoryImportance.trivial().reduce(5);
      expect(imp.score).toBe(1);
    });
  });

  describe('isAtLeast', () => {
    it('checks minimum threshold', () => {
      const imp = MemoryImportance.high();
      expect(imp.isAtLeast('medium')).toBe(true);
      expect(imp.isAtLeast('high')).toBe(true);
      expect(imp.isAtLeast('critical')).toBe(false);
    });
  });

  describe('equals', () => {
    it('compares by score', () => {
      expect(MemoryImportance.high().equals(MemoryImportance.fromScore(7))).toBe(true);
      expect(MemoryImportance.high().equals(MemoryImportance.medium())).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns formatted string', () => {
      expect(MemoryImportance.medium().toString()).toContain('medium');
      expect(MemoryImportance.medium().toString()).toContain('5');
    });
  });
});
