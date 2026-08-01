// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — DecisionScore value object unit tests
// ARC-003/ARC-004 — scoring and ranking
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { DecisionScore } from '../DecisionScore.js';

describe('DecisionScore', () => {
  it('computes a weighted overall score', () => {
    const score = DecisionScore.compute([
      { criterion: 'cost', score: 8, weight: 0.5 },
      { criterion: 'speed', score: 6, weight: 0.5 },
    ]);
    expect(score.overall).toBe(7);
    expect(score.criteria).toHaveLength(2);
  });

  it('handles zero total weight by normalizing to 1', () => {
    const score = DecisionScore.compute([
      { criterion: 'a', score: 5, weight: 0 },
      { criterion: 'b', score: 3, weight: 0 },
    ]);
    // overall = (5*0 + 3*0) / 1 = 0
    expect(score.overall).toBe(0);
  });

  it('clamps reported criterion scores to 0-10 but computes overall from raw scores', () => {
    const score = DecisionScore.compute([
      { criterion: 'low', score: -5, weight: 1 },
      { criterion: 'high', score: 15, weight: 1 },
    ]);
    expect(score.criteria[0]?.score).toBe(0);
    expect(score.criteria[1]?.score).toBe(10);
    // overall = (-5*1 + 15*1) / 2 = 5, then clamped to 0..10
    expect(score.overall).toBe(5);
  });

  it('computes weightedScore per criterion', () => {
    const score = DecisionScore.compute([{ criterion: 'cost', score: 8, weight: 0.25 }]);
    // weightedScore = (8 * 0.25) / 0.25 = 8
    expect(score.criteria[0]?.weightedScore).toBe(8);
  });

  it('returns the highest and weakest criteria', () => {
    const score = DecisionScore.compute([
      { criterion: 'low', score: 2, weight: 0.5 },
      { criterion: 'high', score: 9, weight: 0.5 },
    ]);
    expect(score.highestCriterion?.criterion).toBe('high');
    expect(score.weakestCriterion?.criterion).toBe('low');
  });

  it('returns undefined highest/weakest for empty criteria', () => {
    const score = new DecisionScore(0, []);
    expect(score.highestCriterion).toBeUndefined();
    expect(score.weakestCriterion).toBeUndefined();
  });

  it('freezes the criteria array', () => {
    const score = DecisionScore.compute([{ criterion: 'a', score: 5, weight: 1 }]);
    expect(Object.isFrozen(score.criteria)).toBe(true);
  });

  it('isBetterThan compares overall scores', () => {
    const a = DecisionScore.compute([{ criterion: 'a', score: 8, weight: 1 }]);
    const b = DecisionScore.compute([{ criterion: 'b', score: 5, weight: 1 }]);
    expect(a.isBetterThan(b)).toBe(true);
    expect(b.isBetterThan(a)).toBe(false);
  });

  it('equals compares overall scores', () => {
    const a = DecisionScore.compute([{ criterion: 'a', score: 7, weight: 1 }]);
    const b = DecisionScore.compute([{ criterion: 'b', score: 7, weight: 1 }]);
    const c = DecisionScore.compute([{ criterion: 'c', score: 6, weight: 1 }]);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('toString summarizes the score', () => {
    const score = DecisionScore.compute([{ criterion: 'a', score: 7, weight: 1 }]);
    expect(score.toString()).toBe('Score: 7/10 (1 criteria)');
  });
});
