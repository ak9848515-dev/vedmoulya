// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Value Objects Tests
// Covers: DecisionConstraint, DecisionOpportunity, DecisionOutcome,
//         DecisionVersion, DecisionReasoning
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { DecisionConstraint } from '../value-objects/DecisionConstraint.js';
import { DecisionOpportunity } from '../value-objects/DecisionOpportunity.js';
import { DecisionOutcome } from '../value-objects/DecisionOutcome.js';
import { DecisionVersion } from '../value-objects/DecisionVersion.js';
import { DecisionReasoning } from '../value-objects/DecisionReasoning.js';

// ── DecisionConstraint ──────────────────────────────────────────────────────

describe('DecisionConstraint', () => {
  it('stores type, category, description and isHard', () => {
    const c = new DecisionConstraint('must', 'cost', 'Stay under budget');
    expect(c.type).toBe('must');
    expect(c.category).toBe('cost');
    expect(c.description).toBe('Stay under budget');
    expect(c.isHard).toBe(true);
  });

  it('derives isHard from type when not provided', () => {
    expect(new DecisionConstraint('must', 'time', 'x').isHard).toBe(true);
    expect(new DecisionConstraint('must_not', 'time', 'x').isHard).toBe(true);
    expect(new DecisionConstraint('should', 'time', 'x').isHard).toBe(false);
    expect(new DecisionConstraint('should_not', 'time', 'x').isHard).toBe(false);
    expect(new DecisionConstraint('limit', 'time', 'x').isHard).toBe(true);
    expect(new DecisionConstraint('requirement', 'time', 'x').isHard).toBe(true);
  });

  it('respects an explicit isHard flag', () => {
    expect(new DecisionConstraint('should', 'quality', 'x', true).isHard).toBe(true);
    expect(new DecisionConstraint('must', 'quality', 'x', false).isHard).toBe(false);
  });

  it('provides static factory constructors', () => {
    expect(DecisionConstraint.must('cost', 'a').type).toBe('must');
    expect(DecisionConstraint.must('cost', 'a').isHard).toBe(true);
    expect(DecisionConstraint.mustNot('cost', 'a').type).toBe('must_not');
    expect(DecisionConstraint.should('cost', 'a').type).toBe('should');
    expect(DecisionConstraint.should('cost', 'a').isHard).toBe(false);
    expect(DecisionConstraint.shouldNot('cost', 'a').type).toBe('should_not');
    expect(DecisionConstraint.limit('cost', 'a').type).toBe('limit');
    expect(DecisionConstraint.requirement('cost', 'a').type).toBe('requirement');
  });

  it('formats a readable string', () => {
    const c = new DecisionConstraint('must', 'compliance', 'Follow the rules');
    expect(c.toString()).toBe('HARD [must] compliance: Follow the rules');
    const soft = new DecisionConstraint('should', 'quality', 'Nice to have');
    expect(soft.toString()).toBe('SOFT [should] quality: Nice to have');
  });

  it('compares equality by value', () => {
    const a = new DecisionConstraint('must', 'cost', 'x');
    const b = new DecisionConstraint('must', 'cost', 'x');
    const c = new DecisionConstraint('must', 'cost', 'y');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

// ── DecisionOpportunity ─────────────────────────────────────────────────────

describe('DecisionOpportunity', () => {
  it('stores level, score, description and expected value', () => {
    const o = new DecisionOpportunity('high', 8, 'Grow revenue', '5000');
    expect(o.level).toBe('high');
    expect(o.score).toBe(8);
    expect(o.description).toBe('Grow revenue');
    expect(o.expectedValue).toBe('5000');
  });

  it('derives opportunity level from score', () => {
    expect(DecisionOpportunity.fromScore(9.6, 'x').level).toBe('transformational');
    expect(DecisionOpportunity.fromScore(7, 'x').level).toBe('high');
    expect(DecisionOpportunity.fromScore(4, 'x').level).toBe('moderate');
    expect(DecisionOpportunity.fromScore(2, 'x').level).toBe('low');
    expect(DecisionOpportunity.fromScore(0, 'x').level).toBe('minimal');
  });

  it('clamps out-of-range scores to 0-10', () => {
    expect(DecisionOpportunity.fromScore(99, 'x').score).toBe(10);
    expect(DecisionOpportunity.fromScore(-5, 'x').score).toBe(0);
  });

  it('marks transformational and high as significant', () => {
    expect(new DecisionOpportunity('transformational', 10, 'x').isSignificant()).toBe(true);
    expect(new DecisionOpportunity('high', 8, 'x').isSignificant()).toBe(true);
    expect(new DecisionOpportunity('moderate', 5, 'x').isSignificant()).toBe(false);
    expect(new DecisionOpportunity('low', 2, 'x').isSignificant()).toBe(false);
    expect(new DecisionOpportunity('minimal', 0, 'x').isSignificant()).toBe(false);
  });

  it('formats a readable string', () => {
    const o = new DecisionOpportunity('high', 8, 'Grow');
    expect(o.toString()).toBe('high opportunity (8/10): Grow');
  });

  it('compares equality by level and description', () => {
    const a = new DecisionOpportunity('high', 8, 'Grow');
    const b = new DecisionOpportunity('high', 6, 'Grow');
    const c = new DecisionOpportunity('moderate', 8, 'Grow');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

// ── DecisionOutcome ─────────────────────────────────────────────────────────

describe('DecisionOutcome', () => {
  it('stores result, description, impact, lessons and measuredAt', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const o = new DecisionOutcome({
      result: 'success',
      description: 'Done',
      actualImpact: 'Good',
      lessons: ['a', 'b'],
      measuredAt: at,
    });
    expect(o.result).toBe('success');
    expect(o.description).toBe('Done');
    expect(o.actualImpact).toBe('Good');
    expect(o.lessons).toEqual(['a', 'b']);
    expect(o.measuredAt).toBe(at);
  });

  it('defaults measuredAt to now', () => {
    const o = new DecisionOutcome({ result: 'neutral', description: 'x' });
    expect(o.measuredAt).toBeInstanceOf(Date);
  });

  it('freezes the lessons array', () => {
    const o = new DecisionOutcome({ result: 'failure', description: 'x', lessons: ['a'] });
    expect(Object.isFrozen(o.lessons)).toBe(true);
  });

  it('provides static factory constructors', () => {
    expect(DecisionOutcome.success('a').result).toBe('success');
    expect(DecisionOutcome.partial('a').result).toBe('partial');
    expect(DecisionOutcome.neutral('a').result).toBe('neutral');
    expect(DecisionOutcome.failure('a').result).toBe('failure');
  });

  it('classifies positive outcomes', () => {
    expect(DecisionOutcome.success('a').isPositive()).toBe(true);
    expect(DecisionOutcome.partial('a').isPositive()).toBe(true);
    expect(DecisionOutcome.neutral('a').isPositive()).toBe(false);
    expect(DecisionOutcome.failure('a').isPositive()).toBe(false);
  });

  it('formats a readable string', () => {
    expect(DecisionOutcome.success('Great').toString()).toBe('success: Great');
  });

  it('compares equality by result and description', () => {
    const a = new DecisionOutcome({ result: 'success', description: 'x' });
    const b = new DecisionOutcome({ result: 'success', description: 'x' });
    const c = new DecisionOutcome({ result: 'failure', description: 'x' });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

// ── DecisionVersion ─────────────────────────────────────────────────────────

describe('DecisionVersion', () => {
  it('defaults to 1.0.0', () => {
    const v = new DecisionVersion();
    expect(v.major).toBe(1);
    expect(v.minor).toBe(0);
    expect(v.patch).toBe(0);
  });

  it('accepts explicit parts and labels them', () => {
    expect(new DecisionVersion(2, 3, 4).label).toBe('v2.3.4');
    expect(DecisionVersion.initial().label).toBe('v1.0.0');
  });

  it('bumps patch, minor, and major', () => {
    const v = new DecisionVersion(1, 2, 3);
    expect(v.bumpPatch().label).toBe('v1.2.4');
    expect(v.bumpMinor().label).toBe('v1.3.0');
    expect(v.bumpMajor().label).toBe('v2.0.0');
    expect(v.bumpPatch().bumpPatch().patch).toBe(5);
  });

  it('compares version ordering', () => {
    expect(new DecisionVersion(1, 0, 0).isNewerThan(new DecisionVersion(1, 0, 0))).toBe(false);
    expect(new DecisionVersion(2, 0, 0).isNewerThan(new DecisionVersion(1, 9, 9))).toBe(true);
    expect(new DecisionVersion(1, 1, 0).isNewerThan(new DecisionVersion(1, 0, 9))).toBe(true);
    expect(new DecisionVersion(1, 0, 1).isNewerThan(new DecisionVersion(1, 0, 0))).toBe(true);
  });

  it('compares equality', () => {
    expect(new DecisionVersion(1, 2, 3).equals(new DecisionVersion(1, 2, 3))).toBe(true);
    expect(new DecisionVersion(1, 2, 3).equals(new DecisionVersion(1, 2, 4))).toBe(false);
  });

  it('converts to string via label', () => {
    expect(String(new DecisionVersion(1, 0, 0))).toBe('v1.0.0');
    expect(new DecisionVersion(1, 0, 0).toString()).toBe('v1.0.0');
  });
});

// ── DecisionReasoning ───────────────────────────────────────────────────────

describe('DecisionReasoning', () => {
  it('stores method, summary, assumptions, pros, cons and confidence factors', () => {
    const r = new DecisionReasoning({
      method: 'analytical',
      summary: 'Compared options',
      assumptions: ['a'],
      pros: ['p'],
      cons: ['c'],
      confidenceFactors: { data: 0.9 },
    });
    expect(r.method).toBe('analytical');
    expect(r.summary).toBe('Compared options');
    expect(r.assumptions).toEqual(['a']);
    expect(r.pros).toEqual(['p']);
    expect(r.cons).toEqual(['c']);
    expect(r.confidenceFactors).toEqual({ data: 0.9 });
  });

  it('defaults lists to empty and freezes them', () => {
    const r = new DecisionReasoning({ method: 'manual', summary: 'x' });
    expect(r.assumptions).toEqual([]);
    expect(r.pros).toEqual([]);
    expect(r.cons).toEqual([]);
    expect(r.confidenceFactors).toEqual({});
    expect(Object.isFrozen(r.assumptions)).toBe(true);
    expect(Object.isFrozen(r.pros)).toBe(true);
    expect(Object.isFrozen(r.cons)).toBe(true);
  });

  it('formats a readable string with counts', () => {
    const r = new DecisionReasoning({
      method: 'rule_based',
      summary: 'x',
      pros: ['a'],
      cons: ['b', 'c'],
    });
    expect(r.toString()).toBe('[rule_based] x (1 pros, 2 cons)');
  });

  it('compares equality by method and summary', () => {
    const a = new DecisionReasoning({ method: 'manual', summary: 'x' });
    const b = new DecisionReasoning({ method: 'manual', summary: 'x' });
    const c = new DecisionReasoning({ method: 'ai_assisted', summary: 'x' });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
