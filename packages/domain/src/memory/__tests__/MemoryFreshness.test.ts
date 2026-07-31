import { describe, it, expect, vi } from 'vitest';
import { MemoryFreshness } from '../value-objects/MemoryFreshness.js';

describe('MemoryFreshness', () => {
  describe('initial', () => {
    it('creates with current time and count 1', () => {
      const f = MemoryFreshness.initial();
      expect(f.recallCount).toBe(1);
      expect(f.hoursSinceRecall).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recall', () => {
    it('increments recall count', () => {
      const f = MemoryFreshness.initial().recall();
      expect(f.recallCount).toBe(2);
    });

    it('refreshes lastRecalledAt', () => {
      const f = MemoryFreshness.initial();
      const recalled = f.recall();
      expect(recalled.lastRecalledAt.getTime()).toBeGreaterThanOrEqual(f.lastRecalledAt.getTime());
    });
  });

  describe('state computation', () => {
    it('is vivid when just recalled', () => {
      const f = MemoryFreshness.initial();
      expect(f.state).toBe('vivid');
    });

    it('is vivid for less than 1 hour', () => {
      const recent = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      const f = new MemoryFreshness(recent, 5);
      expect(f.state).toBe('vivid');
    });
  });

  describe('isVivid / isStale', () => {
    it('isVivid returns true for vivid state', () => {
      expect(MemoryFreshness.initial().isVivid()).toBe(true);
    });

    it('isStale returns true for stale or archival', () => {
      const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year
      const f = new MemoryFreshness(longAgo, 1);
      expect(f.isStale()).toBe(true);
    });
  });

  describe('equals', () => {
    it('compares by state and recall count', () => {
      const a = MemoryFreshness.initial();
      const b = MemoryFreshness.initial();
      expect(a.equals(b)).toBe(true);

      const c = a.recall();
      expect(a.equals(c)).toBe(false);
    });
  });
});
