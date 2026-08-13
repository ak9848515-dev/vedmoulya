// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Test Fixtures
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Shared fixtures: a realistic OSEngines bundle whose ports return
// DTO-shaped data matching the seeded platform catalogs (the same
// entities the seed catalogs load: 5 goals, 13 capabilities, 7
// providers, 30 contexts, 4 strategies, 54 learning events, 14 brain
// decisions, 30 knowledge items, 23 memories).
// ──────────────────────────────────────────────────────────────────

import type { OSEngines, PortResult } from '../../contracts/os-engines.js';
import type { OSEngineId } from '../../types/os-types.js';
import { OS_ENGINE_IDS } from '../../types/os-types.js';

function port<T>(data: T | null, error?: string): () => Promise<PortResult<T>> {
  return async () => {
    if (error) return { success: false, error };
    if (data === null || data === undefined) return { success: false, error: 'engine unavailable' };
    return { success: true, data };
  };
}

/** Realistic DTO-shaped data per engine (defaults = a ready platform). */
export interface FixtureData {
  goals: Record<string, unknown> | null;
  capabilities: Record<string, unknown> | null;
  providers: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  strategy: Record<string, unknown> | null;
  orchestrator: Record<string, unknown> | null;
  intelligence: Record<string, unknown> | null;
  learning: Record<string, unknown> | null;
  brain: Record<string, unknown> | null;
  knowledge: Record<string, unknown> | null;
  memory: Record<string, unknown> | null;
}

/** A ready platform: every engine seeded, orchestrator exercised. */
export function defaultFixtureData(): FixtureData {
  return {
    goals: {
      totalGoals: 5,
      activeGoals: 3,
      completedGoals: 1,
      blockedGoals: 0,
      totalTasks: 12,
      byCategory: {},
      byStatus: {},
      byPriority: {},
      avgConfidence: 0.82,
      avgGoalScore: 0.78,
    },
    capabilities: {
      capabilities: [{ id: 'research' }, { id: 'writing' }],
      total: 13,
      activeCount: 13,
      compositionCount: 2,
      countByStatus: {},
      countByCategory: {},
      countByBusinessModule: {},
    },
    providers: {
      providers: [{ id: 'openai', matrix: [{ capability: 'reasoning' }] }],
      total: 7,
      activeCount: 7,
      healthyCount: 6,
      countByLifecycleStatus: {},
      countByFamily: {},
      countByCapability: { reasoning: 3, coding: 2, vision: 1 },
    },
    context: {
      total: 30,
      totalTokens: 48000,
      countBySource: {
        knowledge_base: 5,
        benchmark_knowledge: 2,
        capability_metadata: 1,
        historical_success: 2,
      },
      countByCategory: {},
      countByPriority: {},
    },
    strategy: { total: 4, averageConfidence: 0.85, countByPriority: {}, countByExecutionMode: {} },
    orchestrator: {
      totalGraphs: 2,
      totalSessions: 5,
      activeSessions: 1,
      completedSessions: 4,
      failedSessions: 0,
      totalWorkers: 3,
      idleWorkers: 2,
      busyWorkers: 1,
      statusByState: {},
    },
    intelligence: {
      engineStatus: [],
      pipelineSummary: { total: 3, ready: 3, failed: 0 },
      pipelines: [],
      goals: {},
      capabilities: {},
      providers: {},
      context: {},
      strategies: {},
      orchestrator: {},
    },
    learning: {
      totals: {
        events: 54,
        successes: 48,
        failures: 6,
        pendingApprovals: 2,
        approved: 5,
        insights: 8,
        models: 12,
        reports: 2,
      },
      byCategory: {},
      trend: [],
      recentEvents: [],
      recommendations: [{ id: 'rec_best_provider' }],
      insights: [],
      reports: [],
      models: [],
    },
    brain: {
      totals: {
        decisions: 14,
        plans: 1,
        proposed: 0,
        approved: 1,
        rejected: 0,
        handedOff: 1,
        superseded: 0,
        pendingApprovals: 0,
      },
      byType: { execution_strategy: 1, provider_selection: 1, goal_priority: 1 },
      byStatus: {},
      avgConfidence: 0.88,
      highConfidenceCount: 12,
      trend: [],
      recentDecisions: [],
      recentPlans: [],
    },
    knowledge: {
      totals: {
        items: 30,
        active: 28,
        review: 2,
        validated: 25,
        deprecated: 0,
        relationships: 26,
        citations: 40,
        consumers: 12,
        totalReads: 900,
        avgTrust: 0.82,
        avgConfidence: 0.84,
      },
      byCategory: {},
      byLifecycle: {},
      byValidation: {},
      trustDistribution: [],
      trend: [],
      recentItems: [],
      topTrusted: [],
      mostConsumed: [],
    },
    memory: {
      totals: {
        memories: 23,
        active: 21,
        archived: 1,
        expired: 1,
        relationships: 17,
        citations: 21,
        consumers: 9,
        totalRetrievals: 180,
        avgImportance: 0.65,
        avgConfidence: 0.79,
        avgRecency: 0.6,
      },
      byType: { learning: 2, provider: 3, execution: 2, decision: 2, success: 2 },
      byLifecycle: {},
      byCompression: {},
      importanceDistribution: [],
      retentionCountdown: [],
      trend: [],
      recentMemories: [],
      mostImportant: [],
      mostRetrieved: [],
    },
  };
}

/** Build an OSEngines bundle from fixture data (null data = engine down). */
export function makeEngines(data: FixtureData = defaultFixtureData()): OSEngines {
  // The fixture data is loosely typed (Record<string, unknown>) on purpose —
  // the OS layer consumes DTOs through tolerant accessors; the cast keeps the
  // bundle structurally conformant with the typed OSEngines ports.
  return {
    goals: { getSummary: port(data.goals) },
    capabilities: { getMarketplace: port(data.capabilities) },
    providers: { getMarketplace: port(data.providers) },
    context: { getContextSummary: port(data.context) },
    strategies: { getSummary: port(data.strategy) },
    orchestrator: { getSummary: port(data.orchestrator) },
    intelligence: { getDashboard: port(data.intelligence) },
    learning: { getDashboard: port(data.learning) },
    brain: { getDashboard: port(data.brain) },
    knowledge: { getDashboard: port(data.knowledge) },
    memory: { getDashboard: port(data.memory) },
  } as unknown as OSEngines;
}

/** Fixture data with the orchestrator store empty (not yet exercised). */
export function emptyOrchestratorFixture(): FixtureData {
  const data = defaultFixtureData();
  data.orchestrator = {
    totalGraphs: 0,
    totalSessions: 0,
    activeSessions: 0,
    completedSessions: 0,
    failedSessions: 0,
    totalWorkers: 2,
    idleWorkers: 2,
    busyWorkers: 0,
    statusByState: {},
  };
  return data;
}

/** Fixture data with one engine unreachable (goals port error). */
export function failingGoalsFixture(): FixtureData {
  const data = defaultFixtureData();
  data.goals = null;
  return data;
}

/** Every engine id present in the fixture bundle. */
export function fixtureEngineIds(): OSEngineId[] {
  return [...OS_ENGINE_IDS];
}
