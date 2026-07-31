import { describe, it, expect } from 'vitest';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';

describe('ExecutionPriority', () => {
  it('creates a medium priority by default', () => {
    const p = ExecutionPriority.medium();
    expect(p.level).toBe('medium');
    expect(p.score).toBe(5);
  });

  it('creates all priority levels', () => {
    expect(ExecutionPriority.critical().level).toBe('critical');
    expect(ExecutionPriority.critical().score).toBe(10);
    expect(ExecutionPriority.high().level).toBe('high');
    expect(ExecutionPriority.high().score).toBe(7);
    expect(ExecutionPriority.low().level).toBe('low');
    expect(ExecutionPriority.low().score).toBe(3);
    expect(ExecutionPriority.optional().level).toBe('optional');
    expect(ExecutionPriority.optional().score).toBe(1);
  });

  it('creates from score', () => {
    expect(ExecutionPriority.fromScore(9).level).toBe('critical');
    expect(ExecutionPriority.fromScore(7).level).toBe('high');
    expect(ExecutionPriority.fromScore(5).level).toBe('medium');
    expect(ExecutionPriority.fromScore(2).level).toBe('low');
    expect(ExecutionPriority.fromScore(0).level).toBe('optional');
  });

  it('creates from level', () => {
    expect(ExecutionPriority.fromLevel('critical').score).toBe(10);
    expect(ExecutionPriority.fromLevel('high').score).toBe(7);
    expect(ExecutionPriority.fromLevel('medium').score).toBe(5);
  });

  it('clamps score to 0-10', () => {
    expect(ExecutionPriority.fromScore(15).score).toBe(10);
    expect(ExecutionPriority.fromScore(-5).score).toBe(1); // clamped min is 1
  });

  it('compares levels', () => {
    const critical = ExecutionPriority.critical();
    const medium = ExecutionPriority.medium();
    expect(critical.isAtLeast('critical')).toBe(true);
    expect(critical.isAtLeast('high')).toBe(true);
    expect(medium.isAtLeast('high')).toBe(false);
  });
});
