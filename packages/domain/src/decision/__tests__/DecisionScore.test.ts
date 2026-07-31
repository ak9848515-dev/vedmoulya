import { describe, it, expect } from 'vitest';
import { DecisionScore } from '../value-objects/DecisionScore.js';

describe('DecisionScore', () => {
  it('computes overall score from weighted criteria', () => {
    const score = DecisionScore.compute([
      { criterion: 'cost', score: 80, weight: 0.5 },
      { criterion: 'speed', score: 60, weight: 0.5 },
    ]);
    expect(score.criteria).toHaveLength(2);
    expect(score.overall).toBeDefined();
  });

  it('handles single criterion', () => {
    const score = DecisionScore.compute([{ criterion: 'cost', score: 100, weight: 1.0 }]);
    expect(score.criteria).toHaveLength(1);
  });

  it('handles zero criteria', () => {
    const score = DecisionScore.compute([]);
    expect(score.criteria).toHaveLength(0);
  });
});
