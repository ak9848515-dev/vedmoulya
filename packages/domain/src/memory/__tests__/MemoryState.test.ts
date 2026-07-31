import { describe, it, expect } from 'vitest';
import { MemoryState } from '../value-objects/MemoryState.js';

describe('MemoryState', () => {
  describe('static factory methods', () => {
    it('creates active', () => {
      const s = MemoryState.active();
      expect(s.state).toBe('active');
      expect(s.isActive).toBe(true);
    });

    it('creates recalled', () => {
      const s = MemoryState.recalled();
      expect(s.state).toBe('recalled');
      expect(s.isRecalled).toBe(true);
    });

    it('creates decaying with reason', () => {
      const s = MemoryState.decaying('Strength below threshold');
      expect(s.state).toBe('decaying');
      expect(s.isDecaying).toBe(true);
      expect(s.reason).toBe('Strength below threshold');
    });

    it('creates strengthened', () => {
      const s = MemoryState.strengthened();
      expect(s.state).toBe('strengthened');
      expect(s.isStrengthened).toBe(true);
    });

    it('creates merged', () => {
      const s = MemoryState.merged('Consolidated duplicates');
      expect(s.state).toBe('merged');
      expect(s.isMerged).toBe(true);
    });

    it('creates archived with reason', () => {
      const s = MemoryState.archived('User archived');
      expect(s.state).toBe('archived');
      expect(s.isArchived).toBe(true);
      expect(s.reason).toBe('User archived');
    });

    it('creates forgotten with reason', () => {
      const s = MemoryState.forgotten('Expired');
      expect(s.state).toBe('forgotten');
      expect(s.isForgotten).toBe(true);
      expect(s.reason).toBe('Expired');
    });
  });

  describe('fromState', () => {
    it('parses valid state strings', () => {
      expect(MemoryState.fromState('active').state).toBe('active');
      expect(MemoryState.fromState('archived', 'test').state).toBe('archived');
      expect(MemoryState.fromState('archived', 'test').reason).toBe('test');
    });

    it('throws for invalid state', () => {
      expect(() => MemoryState.fromState('invalid')).toThrow('Invalid memory state');
    });
  });

  describe('state flags', () => {
    it('only returns true for the matching state', () => {
      const s = MemoryState.active();
      expect(s.isActive).toBe(true);
      expect(s.isDecaying).toBe(false);
      expect(s.isArchived).toBe(false);
      expect(s.isForgotten).toBe(false);
      expect(s.isRecalled).toBe(false);
    });
  });

  describe('canTransitionTo', () => {
    const transitionTestCases: Array<{ from: MemoryState; to: string; expected: boolean }> = [
      { from: MemoryState.active(), to: 'decaying', expected: true },
      { from: MemoryState.active(), to: 'recalled', expected: true },
      { from: MemoryState.active(), to: 'archived', expected: true },
      { from: MemoryState.active(), to: 'merged', expected: true },
      { from: MemoryState.active(), to: 'forgotten', expected: false },
      { from: MemoryState.recalled(), to: 'active', expected: true },
      { from: MemoryState.recalled(), to: 'strengthened', expected: true },
      { from: MemoryState.decaying(), to: 'active', expected: true },
      { from: MemoryState.decaying(), to: 'archived', expected: true },
      { from: MemoryState.decaying(), to: 'forgotten', expected: true },
      { from: MemoryState.archived(), to: 'forgotten', expected: true },
      { from: MemoryState.archived(), to: 'active', expected: false },
      { from: MemoryState.forgotten(), to: 'active', expected: false },
      { from: MemoryState.forgotten(), to: 'archived', expected: false },
    ];

    for (const { from, to, expected } of transitionTestCases) {
      it(`${from.state} -> ${to} = ${expected}`, () => {
        expect(from.canTransitionTo(to as never)).toBe(expected);
      });
    }
  });

  describe('equals', () => {
    it('compares by state value', () => {
      expect(MemoryState.active().equals(MemoryState.active())).toBe(true);
      expect(MemoryState.active().equals(MemoryState.archived())).toBe(false);
    });
  });

  describe('toString', () => {
    it('includes reason when present', () => {
      const s = MemoryState.archived('test reason');
      expect(s.toString()).toContain('test reason');
    });

    it('returns state only without reason', () => {
      expect(MemoryState.active().toString()).toBe('active');
    });
  });
});
