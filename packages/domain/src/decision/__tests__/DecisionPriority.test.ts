import { describe, it, expect } from 'vitest';
import { DecisionPriority } from '../value-objects/DecisionPriority.js';

describe('DecisionPriority', () => {
  it('creates from score', () => {
    const priority = DecisionPriority.fromScore(8);
    expect(priority.level).toBe('high');
    expect(priority.score).toBe(8);
  });

  it('creates from level', () => {
    const priority = DecisionPriority.fromLevel('critical');
    expect(priority.level).toBe('critical');
    expect(priority.score).toBe(10);
  });

  it('medium priority has correct defaults', () => {
    const priority = DecisionPriority.medium();
    expect(priority.level).toBe('medium');
    expect(priority.score).toBe(5);
  });

  it('provides static level instances', () => {
    expect(DecisionPriority.critical().level).toBe('critical');
    expect(DecisionPriority.high().level).toBe('high');
    expect(DecisionPriority.low().level).toBe('low');
    expect(DecisionPriority.optional().level).toBe('optional');
  });

  it('clamps score to 1-10 range', () => {
    expect(DecisionPriority.fromScore(-5).score).toBe(1);
    expect(DecisionPriority.fromScore(0).score).toBe(1);
    expect(DecisionPriority.fromScore(15).score).toBe(10);
  });

  it('boost and reduce modify priority', () => {
    const p = DecisionPriority.medium();
    expect(p.boost(2).score).toBe(7);
    expect(p.reduce(2).score).toBe(3);
  });
});
