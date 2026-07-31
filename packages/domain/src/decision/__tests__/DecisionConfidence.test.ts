import { describe, it, expect } from 'vitest';
import { DecisionConfidence } from '../value-objects/DecisionConfidence.js';

describe('DecisionConfidence', () => {
  it('creates from score', () => {
    const confidence = DecisionConfidence.fromScore(0.85);
    expect(confidence.level).toBe('high');
    expect(confidence.score).toBe(0.85);
  });

  it('creates from level', () => {
    const confidence = DecisionConfidence.fromLevel('medium');
    expect(confidence.level).toBe('medium');
    expect(confidence.score).toBe(0.5);
  });

  it('unknown confidence has score 0', () => {
    const confidence = DecisionConfidence.unknown();
    expect(confidence.level).toBe('unknown');
    expect(confidence.score).toBe(0);
  });

  it('very_high is the highest confidence level', () => {
    const confidence = DecisionConfidence.fromScore(0.95);
    expect(confidence.level).toBe('very_high');
  });

  it('returns unknown for negative scores', () => {
    const confidence = DecisionConfidence.fromScore(-0.5);
    expect(confidence.level).toBe('unknown');
    expect(confidence.score).toBe(0);
  });
});
