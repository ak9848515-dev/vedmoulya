// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Metrics
// Metrics instruments for decision engine operations monitoring
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { metrics } from '@vedmoulya/core';

export const MetricNames = {
  DECISIONS_CREATED: 'decision.created',
  DECISIONS_MADE: 'decision.made',
  DECISIONS_COMPLETED: 'decision.completed',
  DECISIONS_ARCHIVED: 'decision.archived',
  DECISIONS_CANCELLED: 'decision.cancelled',
  OPTIONS_ADDED: 'decision.options.added',
  OPTIONS_SCORED: 'decision.options.scored',
  RISKS_ASSESSED: 'decision.risks.assessed',
  OPPORTUNITIES_ASSESSED: 'decision.opportunities.assessed',
  SEARCHES_EXECUTED: 'decision.searches.executed',
  RANKINGS_PERFORMED: 'decision.rankings.performed',
  RECOMMENDATIONS_MADE: 'decision.recommendations.made',
  COMPARISONS_PERFORMED: 'decision.comparisons.performed',
  CONSTRAINTS_EVALUATED: 'decision.constraints.evaluated',
  CACHE_HITS: 'decision.cache.hits',
  CACHE_MISSES: 'decision.cache.misses',
} as const;

export class DecisionMetrics {
  recordDecisionCreated(): void {
    try {
      metrics.increment(MetricNames.DECISIONS_CREATED);
    } catch {
      /* noop */
    }
  }

  recordDecisionMade(): void {
    try {
      metrics.increment(MetricNames.DECISIONS_MADE);
    } catch {
      /* noop */
    }
  }

  recordDecisionCompleted(): void {
    try {
      metrics.increment(MetricNames.DECISIONS_COMPLETED);
    } catch {
      /* noop */
    }
  }

  recordDecisionArchived(): void {
    try {
      metrics.increment(MetricNames.DECISIONS_ARCHIVED);
    } catch {
      /* noop */
    }
  }

  recordDecisionCancelled(): void {
    try {
      metrics.increment(MetricNames.DECISIONS_CANCELLED);
    } catch {
      /* noop */
    }
  }

  recordOptionAdded(): void {
    try {
      metrics.increment(MetricNames.OPTIONS_ADDED);
    } catch {
      /* noop */
    }
  }

  recordOptionScored(): void {
    try {
      metrics.increment(MetricNames.OPTIONS_SCORED);
    } catch {
      /* noop */
    }
  }

  recordRiskAssessed(): void {
    try {
      metrics.increment(MetricNames.RISKS_ASSESSED);
    } catch {
      /* noop */
    }
  }

  recordOpportunityAssessed(): void {
    try {
      metrics.increment(MetricNames.OPPORTUNITIES_ASSESSED);
    } catch {
      /* noop */
    }
  }

  recordSearchExecuted(): void {
    try {
      metrics.increment(MetricNames.SEARCHES_EXECUTED);
    } catch {
      /* noop */
    }
  }

  recordRankingPerformed(): void {
    try {
      metrics.increment(MetricNames.RANKINGS_PERFORMED);
    } catch {
      /* noop */
    }
  }

  recordRecommendationMade(): void {
    try {
      metrics.increment(MetricNames.RECOMMENDATIONS_MADE);
    } catch {
      /* noop */
    }
  }

  recordComparisonPerformed(): void {
    try {
      metrics.increment(MetricNames.COMPARISONS_PERFORMED);
    } catch {
      /* noop */
    }
  }

  recordConstraintEvaluation(): void {
    try {
      metrics.increment(MetricNames.CONSTRAINTS_EVALUATED);
    } catch {
      /* noop */
    }
  }

  recordCacheHit(): void {
    try {
      metrics.increment(MetricNames.CACHE_HITS);
    } catch {
      /* noop */
    }
  }

  recordCacheMiss(): void {
    try {
      metrics.increment(MetricNames.CACHE_MISSES);
    } catch {
      /* noop */
    }
  }
}
