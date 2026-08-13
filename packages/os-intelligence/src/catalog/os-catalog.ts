// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Seed Catalog
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The canonical OS registry: every Enterprise Intelligence Engine
// with its package, sprint, production repository and database table;
// the package build-graph (verified acyclic — no circular
// dependencies); the runtime consultation matrix (the integration
// matrix of who consults whom through narrow port contracts); the
// 15-stage end-to-end pipeline; the nine cross-engine integration
// pairs; and a seed health snapshot for the dashboard history.
//
// The package graph mirrors the real workspace package.json
// dependencies (engine-to-engine edges only); the consultation matrix
// mirrors the port bundles each engine exposes (the same seams as
// MemoryEngines / KnowledgeEngines / BrainEngines).
// ──────────────────────────────────────────────────────────────────

import type { OSEngineId, OSHealthSnapshot } from '../types/os-types.js';
import { OSPIPELINE_ENGINE, OSPIPELINE_LABELS, OSPIPELINE_STAGES } from './os-pipeline.js';

export interface OSEngineSpec {
  engine: OSEngineId;
  name: string;
  packageName: string;
  sprint: string;
  /** Production repository class used by the gateway default wiring. */
  repository: string;
  /** Production database table (JSONB-document pattern). */
  table: string;
  /** Port key on the OSEngines bundle that returns this engine's DTO. */
  port: string;
}

/** The eleven engines of the Enterprise Operating System. */
export const OS_ENGINE_SPECS: OSEngineSpec[] = [
  {
    engine: 'goals',
    name: 'Enterprise Goal & Task Intelligence Engine',
    packageName: '@vedmoulya/goals',
    sprint: 'EI-006',
    repository: 'PostgresGoalRepository',
    table: 'goal_registry',
    port: 'goals',
  },
  {
    engine: 'capabilities',
    name: 'Enterprise Capability Registry',
    packageName: '@vedmoulya/capabilities',
    sprint: 'EI-001',
    repository: 'PostgresCapabilityRepository',
    table: 'capability_registry',
    port: 'capabilities',
  },
  {
    engine: 'providers',
    name: 'Enterprise Provider Registry & Intelligence Platform',
    packageName: '@vedmoulya/providers',
    sprint: 'EI-002',
    repository: 'PostgresProviderRepository',
    table: 'provider_registry',
    port: 'providers',
  },
  {
    engine: 'context',
    name: 'Enterprise Context Intelligence Engine',
    packageName: '@vedmoulya/context',
    sprint: 'EI-003',
    repository: 'PostgresContextRepository',
    table: 'context_registry',
    port: 'context',
  },
  {
    engine: 'strategy',
    name: 'Enterprise Execution Strategy Engine',
    packageName: '@vedmoulya/execution-strategy',
    sprint: 'EI-004',
    repository: 'PostgresExecutionStrategyRepository',
    table: 'execution_strategy_registry',
    port: 'strategies',
  },
  {
    engine: 'orchestrator',
    name: 'Enterprise Execution Orchestrator',
    packageName: '@vedmoulya/execution-orchestrator',
    sprint: 'EI-005',
    repository: 'PostgresExecutionGraphRepository',
    table: 'execution_graph_registry',
    port: 'orchestrator',
  },
  {
    engine: 'intelligence',
    name: 'Enterprise Intelligence Integration Platform',
    packageName: '@vedmoulya/intelligence',
    sprint: 'EI-006 INT-001',
    repository: 'PostgresPipelineRepository',
    table: 'pipeline_registry',
    port: 'intelligence',
  },
  {
    engine: 'learning',
    name: 'Enterprise Learning Intelligence Platform',
    packageName: '@vedmoulya/learning-intelligence',
    sprint: 'EI-007',
    repository: 'PostgresLearningRepository',
    table: 'learning_registry',
    port: 'learning',
  },
  {
    engine: 'brain',
    name: 'Enterprise Brain (Central Decision Intelligence)',
    packageName: '@vedmoulya/enterprise-brain',
    sprint: 'EI-008',
    repository: 'PostgresBrainRepository',
    table: 'brain_registry',
    port: 'brain',
  },
  {
    engine: 'knowledge',
    name: 'Enterprise Knowledge Intelligence Platform',
    packageName: '@vedmoulya/knowledge-intelligence',
    sprint: 'EI-009',
    repository: 'PostgresKnowledgeRepository',
    table: 'knowledge_registry',
    port: 'knowledge',
  },
  {
    engine: 'memory',
    name: 'Enterprise Memory Intelligence Platform',
    packageName: '@vedmoulya/memory-intelligence',
    sprint: 'EI-010',
    repository: 'PostgresMemoryRepository',
    table: 'memory_registry',
    port: 'memory',
  },
];

/**
 * Runtime consultation matrix — the integration statement of WHO consults
 * WHOM through narrow port contracts. Cycles here are EXPECTED in an
 * integrated operating system (brain ↔ knowledge, memory ↔ knowledge, …)
 * and are reported as informational; the acyclicity GATE is the package
 * build graph (OS_PACKAGE_DEPENDENCIES).
 */
export const OS_CONSUMPTION_MATRIX: Record<OSEngineId, OSEngineId[]> = {
  goals: ['capabilities', 'providers', 'context', 'strategy', 'orchestrator'],
  capabilities: ['providers'],
  providers: ['capabilities'],
  context: ['knowledge', 'memory', 'capabilities', 'providers'],
  knowledge: [
    'goals',
    'capabilities',
    'providers',
    'context',
    'strategy',
    'orchestrator',
    'learning',
    'brain',
  ],
  memory: [
    'goals',
    'capabilities',
    'providers',
    'context',
    'strategy',
    'orchestrator',
    'learning',
    'brain',
    'knowledge',
  ],
  brain: [
    'goals',
    'learning',
    'capabilities',
    'providers',
    'context',
    'strategy',
    'orchestrator',
    'knowledge',
    'memory',
  ],
  strategy: ['goals', 'capabilities', 'providers', 'context'],
  orchestrator: ['goals', 'capabilities', 'providers', 'strategy'],
  intelligence: ['goals', 'capabilities', 'providers', 'context', 'strategy', 'orchestrator'],
  learning: ['providers', 'capabilities', 'context', 'goals', 'orchestrator', 'brain'],
};

/**
 * Package build graph — engine-to-engine edges derived from the real
 * workspace package.json dependencies (the `@vedmoulya/*` imports only).
 * This graph MUST stay acyclic ("no circular dependencies" gate).
 */
export const OS_PACKAGE_DEPENDENCIES: Record<OSEngineId, OSEngineId[]> = {
  goals: ['strategy'],
  capabilities: [],
  providers: [],
  context: [],
  strategy: ['providers'],
  orchestrator: ['strategy'],
  intelligence: ['goals', 'capabilities', 'providers', 'context', 'strategy', 'orchestrator'],
  learning: ['goals', 'capabilities', 'providers', 'context', 'strategy', 'orchestrator'],
  brain: ['goals', 'capabilities', 'providers', 'context', 'strategy', 'orchestrator', 'learning'],
  knowledge: [
    'goals',
    'capabilities',
    'providers',
    'context',
    'strategy',
    'orchestrator',
    'learning',
    'brain',
  ],
  memory: [
    'goals',
    'capabilities',
    'providers',
    'context',
    'strategy',
    'orchestrator',
    'learning',
    'brain',
    'knowledge',
  ],
};

/** Consultation reasons for the integration-matrix edges (dashboard copy). */
export const OS_CONSUMPTION_REASONS: Record<string, string> = {
  'goals→capabilities': 'goal planning selects capabilities by AI feature',
  'goals→providers': 'goal planning selects provider families',
  'goals→context': 'goal planning assembles the goal context',
  'goals→strategy': 'goal planning hands off to the strategy engine',
  'goals→orchestrator': 'goal planning hands off to the orchestrator',
  'capabilities→providers': 'capabilities are served by provider matrix entries',
  'providers→capabilities': 'provider matrix is keyed by capability AI features',
  'context→knowledge': 'context sources include the knowledge base',
  'context→memory': 'context sources include enterprise memory',
  'context→capabilities': 'context is tagged by capability',
  'context→providers': 'context carries provider benchmark knowledge',
  'knowledge→goals': 'knowledge links items to goals',
  'knowledge→capabilities': 'knowledge is enriched from capability registry',
  'knowledge→providers': 'knowledge is enriched from provider registry',
  'knowledge→context': 'knowledge registers context consumers',
  'knowledge→strategy': 'knowledge registers strategy consumers',
  'knowledge→orchestrator': 'knowledge registers orchestrator consumers',
  'knowledge→learning': 'knowledge is enriched from learning data',
  'knowledge→brain': 'knowledge registers brain consumers',
  'memory→goals': 'memories link to goals',
  'memory→capabilities': 'memories link to capabilities',
  'memory→providers': 'memories record provider performance',
  'memory→context': 'memories link to context assemblies',
  'memory→strategy': 'memories record strategy outcomes',
  'memory→orchestrator': 'memories record executions',
  'memory→learning': 'memories record learning signals',
  'memory→brain': 'memories record decisions',
  'memory→knowledge': 'memories cite knowledge items',
  'brain→goals': 'brain decides goal priorities',
  'brain→learning': 'brain consults learning recommendations',
  'brain→capabilities': 'brain selects capabilities',
  'brain→providers': 'brain selects providers',
  'brain→context': 'brain decides the context strategy',
  'brain→strategy': 'brain decides the execution strategy',
  'brain→orchestrator': 'brain hands plans to the orchestrator',
  'brain→knowledge': 'brain consults the knowledge layer',
  'brain→memory': 'brain records decisions as memories',
  'strategy→goals': 'strategies are created per goal',
  'strategy→capabilities': 'strategies plan capability steps',
  'strategy→providers': 'strategies rank provider candidates',
  'strategy→context': 'strategies reference context',
  'orchestrator→goals': 'graphs and sessions are per goal',
  'orchestrator→capabilities': 'graph steps map to capabilities',
  'orchestrator→providers': 'sessions bind provider families',
  'orchestrator→strategy': 'graphs are built from strategies',
  'intelligence→goals': 'pipelines are built per goal',
  'intelligence→capabilities': 'pipelines resolve capabilities',
  'intelligence→providers': 'pipelines resolve providers',
  'intelligence→context': 'pipelines assemble context',
  'intelligence→strategy': 'pipelines reference strategies',
  'intelligence→orchestrator': 'pipelines hand off to the orchestrator',
  'learning→providers': 'learning aggregates provider outcomes',
  'learning→capabilities': 'learning aggregates capability outcomes',
  'learning→context': 'learning aggregates context outcomes',
  'learning→goals': 'learning aggregates goal outcomes',
  'learning→orchestrator': 'learning aggregates session outcomes',
  'learning→brain': 'learning feeds brain recommendations',
};

// ── Pipeline (the 15-stage flow is defined in os-pipeline.ts) ─────

export { OSPIPELINE_ENGINE, OSPIPELINE_LABELS, OSPIPELINE_STAGES };

// ── Cross-engine integration pairs (EPIC-005 / OS-001) ────────────

export interface OSCrossEnginePairSpec {
  pair: string;
  from: OSEngineId;
  to: OSEngineId;
}

export const OS_CROSS_ENGINE_PAIRS: OSCrossEnginePairSpec[] = [
  { pair: 'Capability ↔ Provider', from: 'capabilities', to: 'providers' },
  { pair: 'Provider ↔ Context', from: 'providers', to: 'context' },
  { pair: 'Context ↔ Knowledge', from: 'context', to: 'knowledge' },
  { pair: 'Knowledge ↔ Memory', from: 'knowledge', to: 'memory' },
  { pair: 'Memory ↔ Learning', from: 'memory', to: 'learning' },
  { pair: 'Learning ↔ Brain', from: 'learning', to: 'brain' },
  { pair: 'Brain ↔ Strategy', from: 'brain', to: 'strategy' },
  { pair: 'Strategy ↔ Execution', from: 'strategy', to: 'orchestrator' },
  { pair: 'Execution ↔ Learning', from: 'orchestrator', to: 'learning' },
];

// ── Seed health snapshot (dashboard history) ──────────────────────

export const SEED_OS_SNAPSHOT_ID = 'snapshot_os_seed_20260806';

/** A certified-platform seed snapshot for the dashboard history (deterministic id). */
export function createCatalogOSSnapshot(): OSHealthSnapshot {
  return {
    snapshotId: SEED_OS_SNAPSHOT_ID,
    checkedAt: '2026-08-06T12:00:00.000Z',
    overallScore: 96,
    status: 'healthy',
    engineCount: OS_ENGINE_SPECS.length,
    healthyCount: OS_ENGINE_SPECS.length,
    degradedCount: 0,
    unhealthyCount: 0,
    unknownCount: 0,
    pipelineStatus: 'ready',
    pipelineValid: true,
    dependencyAcyclic: true,
    criticalFindings: 0,
    warningFindings: 1,
    passedChecks: 34,
  };
}
