// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Metrics unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DecisionMetrics, MetricNames } from '../DecisionMetrics.js';
import { metrics } from '@vedmoulya/core';

describe('DecisionMetrics', () => {
  beforeEach(() => {
    vi.spyOn(metrics, 'increment').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records all decision lifecycle counters', () => {
    const dm = new DecisionMetrics();
    dm.recordDecisionCreated();
    dm.recordDecisionMade();
    dm.recordDecisionCompleted();
    dm.recordDecisionArchived();
    dm.recordDecisionCancelled();
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.DECISIONS_CREATED);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.DECISIONS_MADE);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.DECISIONS_COMPLETED);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.DECISIONS_ARCHIVED);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.DECISIONS_CANCELLED);
  });

  it('records option, risk, opportunity, and search counters', () => {
    const dm = new DecisionMetrics();
    dm.recordOptionAdded();
    dm.recordOptionScored();
    dm.recordRiskAssessed();
    dm.recordOpportunityAssessed();
    dm.recordSearchExecuted();
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.OPTIONS_ADDED);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.OPTIONS_SCORED);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.RISKS_ASSESSED);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.OPPORTUNITIES_ASSESSED);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.SEARCHES_EXECUTED);
  });

  it('records ranking, recommendation, comparison, constraint counters', () => {
    const dm = new DecisionMetrics();
    dm.recordRankingPerformed();
    dm.recordRecommendationMade();
    dm.recordComparisonPerformed();
    dm.recordConstraintEvaluation();
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.RANKINGS_PERFORMED);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.RECOMMENDATIONS_MADE);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.COMPARISONS_PERFORMED);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.CONSTRAINTS_EVALUATED);
  });

  it('records cache hit/miss counters', () => {
    const dm = new DecisionMetrics();
    dm.recordCacheHit();
    dm.recordCacheMiss();
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.CACHE_HITS);
    expect(metrics.increment).toHaveBeenCalledWith(MetricNames.CACHE_MISSES);
  });

  it('swallows metrics errors without throwing', () => {
    vi.spyOn(metrics, 'increment').mockImplementation(() => {
      throw new Error('registry down');
    });
    const dm = new DecisionMetrics();
    expect(() => dm.recordDecisionCreated()).not.toThrow();
  });
});
