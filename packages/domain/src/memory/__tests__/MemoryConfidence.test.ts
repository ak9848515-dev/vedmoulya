import { describe, it, expect } from 'vitest';
import { MemoryConfidence } from '../value-objects/MemoryConfidence.js';

describe('MemoryConfidence', () => {
  describe('static factory methods', () => {
    it('high has score 1.0', () => {
      const c = MemoryConfidence.high();
      expect(c.level).toBe('high');
      expect(c.score).toBe(1.0);
    });

    it('medium has score 0.6', () => {
      const c = MemoryConfidence.medium();
      expect(c.level).toBe('medium');
      expect(c.score).toBe(0.6);
    });

    it('low has score 0.3', () => {
      const c = MemoryConfidence.low();
      expect(c.level).toBe('low');
      expect(c.score).toBe(0.3);
    });

    it('unknown has score 0.0', () => {
      const c = MemoryConfidence.unknown();
      expect(c.level).toBe('unknown');
      expect(c.score).toBe(0.0);
    });
  });

  describe('fromScore', () => {
    it('high for score >= 0.8', () => {
      expect(MemoryConfidence.fromScore(0.8).level).toBe('high');
      expect(MemoryConfidence.fromScore(1.0).level).toBe('high');
    });

    it('medium for score 0.4-0.79', () => {
      expect(MemoryConfidence.fromScore(0.4).level).toBe('medium');
      expect(MemoryConfidence.fromScore(0.6).level).toBe('medium');
    });

    it('low for score 0.01-0.39', () => {
      expect(MemoryConfidence.fromScore(0.1).level).toBe('low');
      expect(MemoryConfidence.fromScore(0.3).level).toBe('low');
    });

    it('unknown for score 0', () => {
      expect(MemoryConfidence.fromScore(0).level).toBe('unknown');
    });
  });

  describe('fromLevel', () => {
    it('parses valid level strings', () => {
      expect(MemoryConfidence.fromLevel('high').score).toBe(1.0);
      expect(MemoryConfidence.fromLevel('medium').score).toBe(0.6);
      expect(MemoryConfidence.fromLevel('low').score).toBe(0.3);
    });

    it('defaults to unknown for unrecognized level', () => {
      expect(MemoryConfidence.fromLevel('invalid').level).toBe('unknown');
    });
  });

  describe('isReliable', () => {
    it('returns true for high and medium', () => {
      expect(MemoryConfidence.high().isReliable()).toBe(true);
      expect(MemoryConfidence.medium().isReliable()).toBe(true);
    });

    it('returns false for low and unknown', () => {
      expect(MemoryConfidence.low().isReliable()).toBe(false);
      expect(MemoryConfidence.unknown().isReliable()).toBe(false);
    });
  });

  describe('strengthen', () => {
    it('increases confidence', () => {
      const c = MemoryConfidence.medium().strengthen(0.2);
      expect(c.score).toBeCloseTo(0.8);
      expect(c.level).toBe('high');
    });

    it('caps at 1.0', () => {
      const c = MemoryConfidence.high().strengthen(0.5);
      expect(c.score).toBe(1.0);
    });
  });

  describe('weaken', () => {
    it('decreases confidence', () => {
      const c = MemoryConfidence.medium().weaken(0.4);
      expect(c.score).toBeCloseTo(0.2);
      expect(c.level).toBe('low');
    });

    it('floors at 0', () => {
      const c = MemoryConfidence.low().weaken(1.0);
      expect(c.score).toBe(0);
    });
  });

  describe('equals', () => {
    it('compares by level', () => {
      expect(MemoryConfidence.high().equals(MemoryConfidence.high())).toBe(true);
      expect(MemoryConfidence.high().equals(MemoryConfidence.medium())).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns formatted string', () => {
      expect(MemoryConfidence.medium().toString()).toContain('medium');
      expect(MemoryConfidence.medium().toString()).toContain('0.6');
    });
  });
});
