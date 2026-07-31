import { describe, it, expect } from 'vitest';
import { MemoryStrength } from '../value-objects/MemoryStrength.js';

describe('MemoryStrength', () => {
  describe('initial', () => {
    const s = MemoryStrength.initial();

    it('has value 0.3', () => {
      expect(s.value).toBeCloseTo(0.3);
    });

    it('has interval 1 hour', () => {
      expect(s.interval).toBe(1);
    });

    it('has ease factor 2.5', () => {
      expect(s.easeFactor).toBeCloseTo(2.5);
    });
  });

  describe('successfulRecall', () => {
    it('increases strength value', () => {
      const s = MemoryStrength.initial().successfulRecall();
      expect(s.value).toBeGreaterThan(0.3);
      expect(s.value).toBeLessThanOrEqual(1.0);
    });

    it('increases interval based on ease factor', () => {
      const s = MemoryStrength.initial().successfulRecall();
      expect(s.interval).toBeGreaterThan(1);
    });

    it('increases ease factor', () => {
      const s = MemoryStrength.initial().successfulRecall();
      expect(s.easeFactor).toBeGreaterThan(2.5);
    });

    it('caps strength at 1.0', () => {
      const s = new MemoryStrength(0.95, 24, 2.5).successfulRecall();
      expect(s.value).toBe(1.0);
    });
  });

  describe('failedRecall', () => {
    it('decreases strength value', () => {
      const s = MemoryStrength.initial().failedRecall();
      expect(s.value).toBeLessThan(0.3);
    });

    it('decreases interval', () => {
      const s = new MemoryStrength(0.5, 24, 2.5).failedRecall();
      expect(s.interval).toBeLessThan(24);
    });

    it('decreases ease factor', () => {
      const s = MemoryStrength.initial().failedRecall();
      expect(s.easeFactor).toBeLessThan(2.5);
    });

    it('floors ease factor at 1.3', () => {
      const s = new MemoryStrength(0.5, 24, 1.3).failedRecall();
      expect(s.easeFactor).toBeCloseTo(1.3);
    });

    it('floors strength at 0', () => {
      const s = new MemoryStrength(0.1, 1, 2.5).failedRecall();
      expect(s.value).toBe(0);
    });
  });

  describe('decay', () => {
    it('decreases strength exponentially with time', () => {
      const s = MemoryStrength.initial().decay(48); // 48 hours
      expect(s.value).toBeLessThan(0.3);
      expect(s.value).toBeGreaterThan(0);
    });

    it('returns same strength for zero elapsed time', () => {
      const s = MemoryStrength.initial().decay(0);
      expect(s.value).toBeCloseTo(0.3);
    });

    it('does not change interval or ease factor', () => {
      const s = MemoryStrength.initial().decay(100);
      expect(s.interval).toBe(1);
      expect(s.easeFactor).toBeCloseTo(2.5);
    });
  });

  describe('predictStrength', () => {
    it('predicts future strength', () => {
      const s = MemoryStrength.initial();
      const predicted = s.predictStrength(24);
      expect(predicted).toBeLessThan(0.3);
      expect(predicted).toBeGreaterThan(0);
    });

    it('returns current strength for zero hours', () => {
      const s = MemoryStrength.initial();
      expect(s.predictStrength(0)).toBeCloseTo(0.3);
    });
  });

  describe('isStrong / isWeak', () => {
    it('isStrong for value >= 0.7', () => {
      const s = new MemoryStrength(0.7, 24, 2.5);
      expect(s.isStrong()).toBe(true);
      expect(s.isWeak()).toBe(false);
    });

    it('isWeak for value < 0.3', () => {
      const s = new MemoryStrength(0.2, 1, 2.5);
      expect(s.isWeak()).toBe(true);
      expect(s.isStrong()).toBe(false);
    });

    it('neither strong nor weak for mid-range', () => {
      const s = new MemoryStrength(0.5, 12, 2.5);
      expect(s.isStrong()).toBe(false);
      expect(s.isWeak()).toBe(false);
    });
  });

  describe('constructor clamping', () => {
    it('clamps value to 0-1', () => {
      expect(new MemoryStrength(-1, 1, 2.5).value).toBe(0);
      expect(new MemoryStrength(2, 1, 2.5).value).toBe(1);
    });

    it('clamps interval to min 1', () => {
      expect(new MemoryStrength(0.5, 0, 2.5).interval).toBe(1);
    });

    it('clamps ease factor to 1.3-3.0', () => {
      expect(new MemoryStrength(0.5, 1, 0.5).easeFactor).toBeCloseTo(1.3);
      expect(new MemoryStrength(0.5, 1, 5.0).easeFactor).toBeCloseTo(3.0);
    });
  });

  describe('equals', () => {
    it('compares by value', () => {
      const a = MemoryStrength.initial();
      const b = MemoryStrength.initial();
      expect(a.equals(b)).toBe(true);

      const c = a.successfulRecall();
      expect(a.equals(c)).toBe(false);
    });
  });
});
