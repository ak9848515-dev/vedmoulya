// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Constants unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  DECISION_CATEGORIES,
  DECISION_STATUS_VALUES,
  DECISION_INITIATORS,
  PRIORITY_LEVELS,
  CONFIDENCE_LEVELS,
  RISK_LEVELS,
  OPPORTUNITY_LEVELS,
  REASONING_METHODS,
  OUTCOME_RESULTS,
  CONSTRAINT_TYPES,
  CONSTRAINT_CATEGORIES,
  EVIDENCE_TYPES,
  SCORING_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  DEFAULT_SCORING_WEIGHTS,
  EXPLANATION_FORMATS,
  DECISION_EVENT_TYPES,
  PAGINATION,
  ID_PREFIX,
  CACHE_PREFIX,
  API_PATHS,
  EXTERNAL_API_PATHS,
} from '../DecisionConstants.js';

describe('DecisionConstants', () => {
  it('defines the decision categories', () => {
    expect(DECISION_CATEGORIES).toContain('strategic');
    expect(DECISION_CATEGORIES).toContain('career');
    expect(DECISION_CATEGORIES).toContain('personal');
  });

  it('defines the full status state machine values', () => {
    expect(DECISION_STATUS_VALUES).toEqual(
      expect.arrayContaining([
        'requested',
        'analyzing',
        'evaluating',
        'decided',
        'implementing',
        'completed',
        'reviewed',
        'archived',
        'cancelled',
      ]),
    );
  });

  it('defines initiators, priority, confidence, risk, opportunity levels', () => {
    expect(DECISION_INITIATORS).toContain('user');
    expect(PRIORITY_LEVELS).toContain('critical');
    expect(CONFIDENCE_LEVELS).toContain('very_high');
    expect(RISK_LEVELS).toContain('negligible');
    expect(OPPORTUNITY_LEVELS).toContain('transformational');
  });

  it('defines reasoning methods, outcome results, constraint and evidence types', () => {
    expect(REASONING_METHODS).toContain('ai_assisted');
    expect(OUTCOME_RESULTS).toContain('success');
    expect(CONSTRAINT_TYPES).toContain('must_not');
    expect(CONSTRAINT_CATEGORIES).toContain('compliance');
    expect(EVIDENCE_TYPES).toContain('expert_opinion');
  });

  it('defines scoring and confidence thresholds', () => {
    expect(SCORING_THRESHOLDS.EXCEPTIONAL_MIN).toBe(100);
    expect(SCORING_THRESHOLDS.STRONG_MIN).toBe(75);
    expect(CONFIDENCE_THRESHOLDS.VERY_HIGH_MIN).toBe(0.9);
    expect(DEFAULT_SCORING_WEIGHTS.priority).toBe(3);
  });

  it('defines explanation formats and event types', () => {
    expect(EXPLANATION_FORMATS).toContain('standard');
    expect(DECISION_EVENT_TYPES).toContain('decision.made');
  });

  it('defines pagination defaults, id prefixes, and cache prefixes', () => {
    expect(PAGINATION.DEFAULT_LIMIT).toBe(20);
    expect(ID_PREFIX.DECISION).toBe('dec_');
    expect(CACHE_PREFIX.DECISION).toBe('decision:');
  });

  it('defines internal and external API paths', () => {
    expect(API_PATHS.BASE).toBe('/api/v1/decision');
    expect(EXTERNAL_API_PATHS.KNOWLEDGE.CONTEXT).toBe('/api/v1/knowledge/context');
    expect(EXTERNAL_API_PATHS.ORCHESTRATOR.CAPABILITY).toBe('/api/v1/orchestrator/capability');
  });
});
