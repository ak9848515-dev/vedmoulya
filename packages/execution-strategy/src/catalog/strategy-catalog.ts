// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Seed Catalog
// Seed data for the Enterprise Execution Strategy Engine
// EI-004 — Enterprise Execution Strategy Engine
// Provides realistic strategies for common business goals.
// ──────────────────────────────────────────────────────────────────

import type { ExecutionStrategy } from '../types/strategy-types.js';
import { ExecutionStrategyService } from '../domain/services/ExecutionStrategyService.js';

export const SEED_STRATEGY_SIZE = 4;

/**
 * Create the seed strategy catalog: 4 strategies covering common goals.
 * Used for development and test.
 */
export function createCatalogStrategies(): ExecutionStrategy[] {
  const service = new ExecutionStrategyService();
  return [
    service.createStrategy({
      goalId: 'goal_blog_001',
      goal: 'Generate a blog post about microservices architecture',
      business: ['content-agency', 'platform'],
      priority: 'high',
      qualityTier: 'premium',
      maxCostUsd: 2,
      maxLatencyMs: 30000,
    }),
    service.createStrategy({
      goalId: 'goal_summary_001',
      goal: 'Summarize the quarterly business report',
      business: ['business', 'platform'],
      priority: 'medium',
      qualityTier: 'standard',
      maxCostUsd: 1,
      maxLatencyMs: 20000,
    }),
    service.createStrategy({
      goalId: 'goal_learn_001',
      goal: 'Create a learning plan for TypeScript mastery',
      business: ['learning', 'career'],
      priority: 'high',
      qualityTier: 'standard',
      maxCostUsd: 1.5,
      maxLatencyMs: 25000,
    }),
    service.createStrategy({
      goalId: 'goal_analyze_001',
      goal: 'Analyze the client engagement data for insights',
      business: ['content-agency', 'business'],
      priority: 'critical',
      qualityTier: 'premium',
      maxCostUsd: 3,
      maxLatencyMs: 40000,
    }),
  ];
}
