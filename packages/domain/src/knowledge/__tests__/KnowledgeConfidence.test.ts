import { describe, it, expect } from 'vitest';
import { KnowledgeConfidence } from '../value-objects/KnowledgeConfidence.js';

describe('KnowledgeConfidence', () => {
  describe('factory methods', () => {
    it('high confidence has score 1.0', () => {
      const c = KnowledgeConfidence.high();
      expect(c.level).toBe('high');
      expect(c.score).toBe(1.0);
    });

    it('medium confidence has score 0.6', () => {
      const c = KnowledgeConfidence.medium();
      expect(c.level).toBe('medium');
      expect(c.score).toBe(0.6);
    });

    it('low confidence has score 0.3', () => {
      const c = KnowledgeConfidence.low();
      expect(c.level).toBe('low');
      expect(c.score).toBe(0.3);
    });

    it('unknown confidence has score 0.0', () => {
      const c = KnowledgeConfidence.unknown();
      expect(c.level).toBe('unknown');
      expect(c.score).toBe(0.0);
    });
  });

  describe('fromLevel parsing', () => {
    it('parses valid levels', () => {
      expect(KnowledgeConfidence.fromLevel('high').level).toBe('high');
      expect(KnowledgeConfidence.fromLevel('medium').level).toBe('medium');
      expect(KnowledgeConfidence.fromLevel('low').level).toBe('low');
    });

    it('defaults to unknown for unrecognized levels', () => {
      expect(KnowledgeConfidence.fromLevel('unknown').level).toBe('unknown');
      expect(KnowledgeConfidence.fromLevel('invalid').level).toBe('unknown');
    });
  });

  describe('fromScore calculation', () => {
    it('score >= 0.8 is high', () => {
      expect(KnowledgeConfidence.fromScore(0.95).level).toBe('high');
      expect(KnowledgeConfidence.fromScore(0.8).level).toBe('high');
    });

    it('score >= 0.4 is medium', () => {
      expect(KnowledgeConfidence.fromScore(0.6).level).toBe('medium');
      expect(KnowledgeConfidence.fromScore(0.4).level).toBe('medium');
    });

    it('score > 0 is low', () => {
      expect(KnowledgeConfidence.fromScore(0.35).level).toBe('low');
      expect(KnowledgeConfidence.fromScore(0.1).level).toBe('low');
    });

    it('score <= 0 is unknown', () => {
      expect(KnowledgeConfidence.fromScore(0).level).toBe('unknown');
      expect(KnowledgeConfidence.fromScore(-1).level).toBe('unknown');
    });

    it('preserves the original score', () => {
      expect(KnowledgeConfidence.fromScore(0.85).score).toBe(0.85);
      expect(KnowledgeConfidence.fromScore(0.5).score).toBe(0.5);
    });
  });

  describe('isReliable', () => {
    it('high and medium are reliable', () => {
      expect(KnowledgeConfidence.high().isReliable()).toBe(true);
      expect(KnowledgeConfidence.medium().isReliable()).toBe(true);
    });

    it('low and unknown are not reliable', () => {
      expect(KnowledgeConfidence.low().isReliable()).toBe(false);
      expect(KnowledgeConfidence.unknown().isReliable()).toBe(false);
    });
  });

  describe('equals', () => {
    it('same level is equal', () => {
      expect(KnowledgeConfidence.high().equals(KnowledgeConfidence.high())).toBe(true);
    });

    it('different levels are not equal', () => {
      expect(KnowledgeConfidence.high().equals(KnowledgeConfidence.medium())).toBe(false);
    });
  });

  describe('toString', () => {
    it('includes level and score', () => {
      expect(KnowledgeConfidence.high().toString()).toBe('high (1)');
      expect(KnowledgeConfidence.fromScore(0.5).toString()).toBe('medium (0.5)');
    });
  });
});
