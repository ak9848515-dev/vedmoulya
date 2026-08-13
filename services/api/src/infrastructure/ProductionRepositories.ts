// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Production Repositories
// Resolves the real production repositories for the gateway by reusing each
// service module's existing DI registration — no duplicate registration.
// SPRINT PR-002A (identity) + PR-002B (memory, decision, execution, knowledge)
// ─────────────────────────────────────────────────────────────────────────────

import { container, config, logger } from '@vedmoulya/core';
import postgres from 'postgres';
import type { ProviderRepository } from '@vedmoulya/providers';
import {
  InMemoryProviderRepository,
  PostgresProviderRepository,
  createCatalogProviders,
} from '@vedmoulya/providers';
import type { CapabilityRepository } from '@vedmoulya/capabilities';
import { PostgresCapabilityRepository } from '@vedmoulya/capabilities';
import type { ContextRepository } from '@vedmoulya/context';
import { PostgresContextRepository } from '@vedmoulya/context';
import type { ExecutionStrategyRepository } from '@vedmoulya/execution-strategy';
import { PostgresExecutionStrategyRepository } from '@vedmoulya/execution-strategy';
import type { GoalRepository, TaskRepository } from '@vedmoulya/goals';
import { PostgresGoalRepository, PostgresTaskRepository } from '@vedmoulya/goals';
import type { PipelineRepository } from '@vedmoulya/intelligence';
import { PostgresPipelineRepository } from '@vedmoulya/intelligence';
import type { LearningRepository } from '@vedmoulya/learning-intelligence';
import { PostgresLearningRepository } from '@vedmoulya/learning-intelligence';
import type { BrainRepository } from '@vedmoulya/enterprise-brain';
import { PostgresBrainRepository } from '@vedmoulya/enterprise-brain';
import type { KnowledgeRepository as KnowledgeIntelligenceRepository } from '@vedmoulya/knowledge-intelligence';
import { PostgresKnowledgeRepository } from '@vedmoulya/knowledge-intelligence';
import type { MemoryRepository as MemoryIntelligenceRepository } from '@vedmoulya/memory-intelligence';
import { PostgresMemoryRepository } from '@vedmoulya/memory-intelligence';
import type { OSRepository as OSIntelligenceRepository } from '@vedmoulya/os-intelligence';
import { PostgresOSRepository } from '@vedmoulya/os-intelligence';
import type { GraphRepository as ContextFabricGraphRepository } from '@vedmoulya/context-fabric';
import { PostgresGraphRepository } from '@vedmoulya/context-fabric';
import type { RagRepository } from '@vedmoulya/rag';
import {
  PostgresRagRepository,
  runRagMigrations,
  ensureRagReady,
  probeRagSchema,
} from '@vedmoulya/rag';
import type { ApplicationProjectRepository } from '@vedmoulya/app-factory';
import {
  InMemoryApplicationRepository,
  PostgresApplicationRepository,
} from '@vedmoulya/app-factory';
import type { RequirementSessionStore } from '@vedmoulya/requirements';
import {
  InMemoryRequirementSessionStore,
  PostgresRequirementSessionStore,
} from '@vedmoulya/requirements';
import type {
  IdentityRepository,
  MemoryRepository,
  DecisionRepository,
  ExecutionRepository,
  KnowledgeRepository,
  ContentAgencyRepository,
  ClientOpsRepository,
} from '@vedmoulya/domain';
import {
  registerContentAgencyServices,
  initializeDatabase as initializeContentAgencyDb,
} from '@vedmoulya/content-agency';
import {
  registerIdentityServices,
  initializeDatabase as initializeIdentityDb,
} from '@vedmoulya/identity';
import {
  registerMemoryServices,
  initializeDatabase as initializeMemoryDb,
} from '@vedmoulya/memory';
import {
  registerDecisionServices,
  initializeDatabase as initializeDecisionDb,
} from '@vedmoulya/decision';
import {
  registerExecutionServices,
  initializeDatabase as initializeExecutionDb,
} from '@vedmoulya/execution';
import {
  registerKnowledgeServices,
  initializeDatabase as initializeKnowledgeDb,
} from '@vedmoulya/knowledge';

/** Mutable singleton slot used by resolveOnce. */
interface RepositorySlot<T> {
  instance?: T;
}

/** Singleton slot for the RAG repository (AI-RUNTIME-002). */
const ragRegistrySlot: RepositorySlot<RagRepository> = {};

/**
 * Resolve a production repository exactly once per engine:
 * re-register the owning module's services (idempotent — container.register is
 * a Map.set), initialize its database (idempotent — each initializeDatabase
 * guards on an existing singleton), then resolve the repository from the
 * shared DI container. Repeated calls return the same singleton.
 */
function resolveOnce<T>(
  slot: RepositorySlot<T>,
  key: string,
  register: () => void,
  initialize: () => void,
): T {
  if (slot.instance) return slot.instance;
  register();
  initialize();
  slot.instance = container.resolve(key) as T;
  return slot.instance;
}

const identitySlot: RepositorySlot<IdentityRepository> = {};
const memorySlot: RepositorySlot<MemoryRepository> = {};
const decisionSlot: RepositorySlot<DecisionRepository> = {};
const executionSlot: RepositorySlot<ExecutionRepository> = {};
const knowledgeSlot: RepositorySlot<KnowledgeRepository> = {};
const contentAgencySlot: RepositorySlot<ContentAgencyRepository> = {};
const clientOpsSlot: RepositorySlot<ClientOpsRepository> = {};
const providerRegistrySlot: RepositorySlot<ProviderRepository> = {};
const capabilityRegistrySlot: RepositorySlot<CapabilityRepository> = {};
const contextRegistrySlot: RepositorySlot<ContextRepository> = {};
const strategyRegistrySlot: RepositorySlot<ExecutionStrategyRepository> = {};
const goalRegistrySlot: RepositorySlot<GoalRepository> = {};
const taskRegistrySlot: RepositorySlot<TaskRepository> = {};
const pipelineRegistrySlot: RepositorySlot<PipelineRepository> = {};
const learningRegistrySlot: RepositorySlot<LearningRepository> = {};
const brainRegistrySlot: RepositorySlot<BrainRepository> = {};
const knowledgeRegistrySlot: RepositorySlot<KnowledgeIntelligenceRepository> = {};
const memoryRegistrySlot: RepositorySlot<MemoryIntelligenceRepository> = {};
const osRegistrySlot: RepositorySlot<OSIntelligenceRepository> = {};
const contextFabricSlot: RepositorySlot<ContextFabricGraphRepository> = {};

/** Create a lazily-connected postgres pool for an EI engine (same URL as
 *  the other engines; provider pattern). Safe to call in every environment:
 *  no network I/O happens until the first query. */
export function createEISql(applicationName: string): ReturnType<typeof postgres> {
  return postgres(config.database.url, {
    max: 5,
    idle_timeout: 30,
    max_lifetime: 60 * 30,
    connection: {
      application_name: applicationName,
    },
  });
}

/** Fire-and-forget table creation (safe: IF NOT EXISTS, every startup). */
function ensureTable(repo: { ensureTable(): Promise<void> }, label: string): void {
  void repo.ensureTable().catch((error: unknown) => {
    logger.warn(`${label} table creation failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Resolve the production IdentityRepository for the API gateway.
 *
 * Reuses the identity module's existing DI registration (`identity.repository`
 * → `PostgresIdentityRepository`) instead of duplicating it. The Postgres
 * client is created lazily (no network I/O at construction), so this is safe
 * to call in every environment; the first identity query connects.
 */
export function createProductionIdentityRepository(): IdentityRepository {
  return resolveOnce(identitySlot, 'identity.repository', registerIdentityServices, () => {
    initializeIdentityDb();
  });
}

/**
 * Resolve the production MemoryRepository via the memory module's existing DI
 * registration (`memory.repository` → `PostgresMemoryRepository`).
 */
export function createProductionMemoryRepository(): MemoryRepository {
  return resolveOnce(memorySlot, 'memory.repository', registerMemoryServices, () => {
    initializeMemoryDb();
  });
}

/**
 * Resolve the production DecisionRepository via the decision module's existing
 * DI registration (`decision.repository` → `PostgresDecisionRepository`).
 */
export function createProductionDecisionRepository(): DecisionRepository {
  return resolveOnce(decisionSlot, 'decision.repository', registerDecisionServices, () => {
    initializeDecisionDb();
  });
}

/**
 * Resolve the production ExecutionRepository via the execution module's
 * existing DI registration (`execution.repository` → `PostgresExecutionRepository`).
 */
export function createProductionExecutionRepository(): ExecutionRepository {
  return resolveOnce(executionSlot, 'execution.repository', registerExecutionServices, () => {
    initializeExecutionDb();
  });
}

/**
 * Resolve the production KnowledgeRepository via the knowledge module's
 * existing DI registration (`knowledge.repository` → `PostgresKnowledgeRepository`).
 * The knowledge `initializeDatabase()` is async but completes synchronously up
 * to the first resolved promise, so it is safe to fire-and-forget; a rejection
 * (e.g. a config/connection error) is logged rather than silently swallowed.
 */
export function createProductionKnowledgeRepository(): KnowledgeRepository {
  return resolveOnce(knowledgeSlot, 'knowledge.repository', registerKnowledgeServices, () => {
    void initializeKnowledgeDb().catch((error: unknown) => {
      logger.warn('Knowledge database initialization rejected (gateway wiring)', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

/**
 * Resolve the production ContentAgencyRepository via the content-agency
 * module's existing DI registration (`content-agency.repository` →
 * `PostgresContentAgencyRepository`). Lazy-connect Postgres client.
 * EPIC-003 / SPRINT AC-001.
 */
export function createProductionContentAgencyRepository(): ContentAgencyRepository {
  return resolveOnce(
    contentAgencySlot,
    'content-agency.repository',
    registerContentAgencyServices,
    () => {
      void initializeContentAgencyDb().catch((error: unknown) => {
        logger.warn('Content-agency database initialization rejected (gateway wiring)', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
  );
}

/**
 * Resolve the production ClientOpsRepository via the content-agency module's
 * existing DI registration (`content-agency.client-ops.repository` →
 * `PostgresClientOpsRepository`). EPIC-003 / SPRINT AC-002.
 */
export function createProductionClientOpsRepository(): ClientOpsRepository {
  return resolveOnce(
    clientOpsSlot,
    'content-agency.client-ops.repository',
    registerContentAgencyServices,
    () => {
      void initializeContentAgencyDb().catch((error: unknown) => {
        logger.warn('Content-agency database initialization rejected (gateway wiring)', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
  );
}

/**
 * Resolve the production Postgres-backed ProviderRepository for the
 * Enterprise Provider Registry (EI-002). Uses the same database URL as
 * the other engines (config.database.url) with a raw postgres.js pool.
 * The provider_registry table stores entities as JSONB documents;
 * ensureTable() creates the table if it does not exist.
 */
export function createProductionProviderRepository(): ProviderRepository {
  if (providerRegistrySlot.instance) return providerRegistrySlot.instance;

  // Same convention as the app-factory + requirements factories below: on a
  // Docker-less development/test machine (NODE_ENV !== production/staging) the
  // registry runs on the deterministic SEEDED in-memory double so provider
  // intelligence, routing and the capability marketplace stay fully usable
  // without Postgres; strict environments ALWAYS use Postgres (fail-fast
  // preserved — no silent in-memory degradation in production/staging).
  const env: string = process.env.NODE_ENV ?? 'development';
  const isStrict = env === 'production' || env === 'staging';
  if (!isStrict) {
    providerRegistrySlot.instance = new InMemoryProviderRepository(createCatalogProviders());
    return providerRegistrySlot.instance;
  }

  const sql = createEISql('vedmoulya-provider-registry');
  const repo = new PostgresProviderRepository(sql);
  ensureTable(repo, 'Provider registry');

  providerRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed CapabilityRepository for the
 * Enterprise Capability Registry (EI-001). JSONB documents in
 * capability_registry; ensureTable() creates the table if missing.
 * CERT-002 C-04 — replaces the in-memory default in production wiring.
 */
export function createProductionCapabilityRepository(): CapabilityRepository {
  if (capabilityRegistrySlot.instance) return capabilityRegistrySlot.instance;

  const sql = createEISql('vedmoulya-capability-registry');
  const repo = new PostgresCapabilityRepository(sql);
  ensureTable(repo, 'Capability registry');

  capabilityRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed ContextRepository for the
 * Enterprise Context Registry (EI-003). JSONB documents in
 * context_registry; ensureTable() creates the table if missing.
 * CERT-002 C-04.
 */
export function createProductionContextRepository(): ContextRepository {
  if (contextRegistrySlot.instance) return contextRegistrySlot.instance;

  const sql = createEISql('vedmoulya-context-registry');
  const repo = new PostgresContextRepository(sql);
  ensureTable(repo, 'Context registry');

  contextRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed ExecutionStrategyRepository for
 * the Enterprise Execution Strategy Engine (EI-004). JSONB documents in
 * execution_strategy_registry; ensureTable() creates the table if missing.
 * CERT-002 C-04.
 */
export function createProductionExecutionStrategyRepository(): ExecutionStrategyRepository {
  if (strategyRegistrySlot.instance) return strategyRegistrySlot.instance;

  const sql = createEISql('vedmoulya-execution-strategy');
  const repo = new PostgresExecutionStrategyRepository(sql);
  ensureTable(repo, 'Execution strategy registry');

  strategyRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed GoalRepository for the Enterprise
 * Goal & Task Intelligence Engine (EI-006). JSONB documents in
 * goal_registry; ensureTable() creates the table if missing.
 * CERT-002 C-04.
 */
export function createProductionGoalRepository(): GoalRepository {
  if (goalRegistrySlot.instance) return goalRegistrySlot.instance;

  const sql = createEISql('vedmoulya-goal-registry');
  const repo = new PostgresGoalRepository(sql);
  ensureTable(repo, 'Goal registry');

  goalRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed TaskRepository for the Enterprise
 * Goal & Task Intelligence Engine (EI-006). JSONB documents in
 * task_registry; ensureTable() creates the table if missing.
 * CERT-002 C-04.
 */
export function createProductionTaskRepository(): TaskRepository {
  if (taskRegistrySlot.instance) return taskRegistrySlot.instance;

  const sql = createEISql('vedmoulya-task-registry');
  const repo = new PostgresTaskRepository(sql);
  ensureTable(repo, 'Task registry');

  taskRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed PipelineRepository for the
 * Enterprise Intelligence Integration Platform (EI-006 / INT-001). JSONB
 * documents in enterprise_pipeline; ensureTable() creates the table if
 * missing. CERT-002 C-04.
 */
export function createProductionPipelineRepository(): PipelineRepository {
  if (pipelineRegistrySlot.instance) return pipelineRegistrySlot.instance;

  const sql = createEISql('vedmoulya-intelligence-pipeline');
  const repo = new PostgresPipelineRepository(sql);
  ensureTable(repo, 'Enterprise pipeline');

  pipelineRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed LearningRepository for the
 * Enterprise Learning Intelligence Platform (EI-007). JSONB documents in
 * learning_registry (events + safety decisions keyed by collection);
 * ensureTable() creates the table if missing.
 */
export function createProductionLearningRepository(): LearningRepository {
  if (learningRegistrySlot.instance) return learningRegistrySlot.instance;

  const sql = createEISql('vedmoulya-learning-intelligence');
  const repo = new PostgresLearningRepository(sql);
  ensureTable(repo, 'Learning intelligence');

  learningRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed BrainRepository for the Enterprise
 * Brain (EI-008). JSONB documents in brain_registry (decision plans +
 * decisions keyed by collection); ensureTable() creates the table if missing.
 */
export function createProductionBrainRepository(): BrainRepository {
  if (brainRegistrySlot.instance) return brainRegistrySlot.instance;

  const sql = createEISql('vedmoulya-enterprise-brain');
  const repo = new PostgresBrainRepository(sql);
  ensureTable(repo, 'Enterprise brain');

  brainRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed KnowledgeRepository for the
 * Enterprise Knowledge Intelligence Platform (EI-009). JSONB documents in
 * knowledge_registry (items + relationship edges keyed by collection);
 * ensureTable() creates the table + filter indexes if missing.
 *
 * Named `createProductionKnowledgeIntelligenceRepository` to stay distinct
 * from the pre-existing `@vedmoulya/knowledge` engine factory (which resolves
 * `knowledge.repository` through the engine's own DI registration).
 */
export function createProductionKnowledgeIntelligenceRepository(): KnowledgeIntelligenceRepository {
  if (knowledgeRegistrySlot.instance) return knowledgeRegistrySlot.instance;

  const sql = createEISql('vedmoulya-knowledge-intelligence');
  const repo = new PostgresKnowledgeRepository(sql);
  ensureTable(repo, 'Knowledge intelligence');

  knowledgeRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed MemoryRepository for the
 * Enterprise Memory Intelligence Platform (EI-010). JSONB documents in
 * memory_registry (memory items + relationship edges keyed by collection);
 * ensureTable() creates the table + filter indexes if missing.
 *
 * Named `createProductionMemoryIntelligenceRepository` to stay distinct
 * from the pre-existing `@vedmoulya/memory` engine factory (which resolves
 * `memory.repository` through the engine's own DI registration).
 */
export function createProductionMemoryIntelligenceRepository(): MemoryIntelligenceRepository {
  if (memoryRegistrySlot.instance) return memoryRegistrySlot.instance;

  const sql = createEISql('vedmoulya-memory-intelligence');
  const repo = new PostgresMemoryRepository(sql);
  ensureTable(repo, 'Memory intelligence');

  memoryRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed OSRepository for the Enterprise
 * Operating System Integration Layer (OS-001). JSONB documents in
 * os_health_registry (health snapshots keyed by snapshot id); ensureTable()
 * creates the table + checkedAt index if missing. EPIC-005 / OS-001.
 */
export function createProductionOSIntelligenceRepository(): OSIntelligenceRepository {
  if (osRegistrySlot.instance) return osRegistrySlot.instance;

  const sql = createEISql('vedmoulya-os-intelligence');
  const repo = new PostgresOSRepository(sql);
  ensureTable(repo, 'OS health registry');

  osRegistrySlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres-backed GraphRepository for the Context &
 * Personal Intelligence Fabric (APP-001). JSONB documents in
 * context_fabric_registry (entities + relationships keyed by collection + id);
 * ensureTable() creates the table + graph/organization indexes if missing.
 * APP-001 — Post-V1 Application Platform Layer. The relational store is the
 * initial graph backend; the GraphRepository contract is the seam for a
 * future graph engine.
 */
export function createProductionContextFabricRepository(): ContextFabricGraphRepository {
  if (contextFabricSlot.instance) return contextFabricSlot.instance;

  const sql = createEISql('vedmoulya-context-fabric');
  const repo = new PostgresGraphRepository(sql);
  ensureTable(repo, 'Context fabric registry');

  contextFabricSlot.instance = repo;
  return repo;
}

const applicationProjectSlot: RepositorySlot<ApplicationProjectRepository> = {};

/**
 * Resolve the ApplicationProjectRepository for the AI Application Factory
 * (EPIC-007/008).
 *
 * Production/staging: Postgres-backed — full AppProject documents as JSONB in
 * `application_projects`, keyed by application_id with owner/status/updated_at
 * columns for owner-scoped listing. ensureTable() creates the table + owner
 * index if missing (idempotent — same lazy pattern as every EI engine).
 * EPIC-008 Phase 1: application projects survive server restart.
 *
 * Development/test: the in-memory repository is the hermetic test double and
 * the local Postgres may not be running (same documented convention as the
 * RAG registry below). The gateway singleton means a single `next dev`
 * process persists applications for the full browser journey (create →
 * approve → build → files → deploy) without Docker. Production semantics are
 * unchanged: this fallback is unreachable when NODE_ENV is production/staging.
 */
export function createProductionApplicationRepository(): ApplicationProjectRepository {
  if (applicationProjectSlot.instance) return applicationProjectSlot.instance;

  const env: string = process.env.NODE_ENV ?? 'development';
  const isStrict = env === 'production' || env === 'staging';
  if (!isStrict) {
    applicationProjectSlot.instance = new InMemoryApplicationRepository();
    return applicationProjectSlot.instance;
  }

  const sql = createEISql('vedmoulya-application-factory');
  const repo = new PostgresApplicationRepository(sql);
  ensureTable(repo, 'Application project registry');

  applicationProjectSlot.instance = repo;
  return repo;
}

const requirementSessionSlot: RepositorySlot<RequirementSessionStore> = {};

/**
 * Resolve the RequirementSessionStore for the Product Intelligence &
 * Requirements Engine (EPIC-009).
 *
 * Production/staging: Postgres-backed — full RequirementSession documents as
 * JSONB in `requirement_sessions`, keyed by session_id with owner/phase/
 * updated_at columns for owner-scoped listing (same lazy pattern as the
 * application-factory registry). Sessions survive server restart.
 *
 * Development/test: the in-memory repository is the hermetic test double
 * (same documented convention as the application-factory registry below).
 */
export function createProductionRequirementSessionStore(): RequirementSessionStore {
  if (requirementSessionSlot.instance) return requirementSessionSlot.instance;

  const env: string = process.env.NODE_ENV ?? 'development';
  const isStrict = env === 'production' || env === 'staging';
  if (!isStrict) {
    requirementSessionSlot.instance = new InMemoryRequirementSessionStore();
    return requirementSessionSlot.instance;
  }

  const sql = createEISql('vedmoulya-requirements');
  const repo = new PostgresRequirementSessionStore(sql);
  ensureTable(repo, 'Requirement session registry');

  requirementSessionSlot.instance = repo;
  return repo;
}

/**
 * Resolve the production Postgres + pgvector RagRepository (AI-RUNTIME-002).
 * The `rag_chunks` schema is created idempotently (CREATE EXTENSION vector;
 * CREATE TABLE IF NOT EXISTS …; GIN index on metadata). The embedding
 * dimension defaults to 1536 (OpenAI text-embedding-3-small); the RAG
 * application service is built in ApiApplicationService with the injected
 * embedding provider (SDK-backed in production, deterministic mock in CI).
 *
 * Fail-fast guarantee (C-01): in production/staging this repository creation
 * performs a SYNCHRONOUS config gate (the vector store must be reachable and
 * the schema must exist — verified by `probeRagSchema` with a bounded
 * timeout) so a missing pgvector store fails fast instead of silently
 * degrading. In development/test the migration is fire-and-forget (the
 * in-memory repository is the hermetic test double and the local Postgres
 * may not be running).
 */
export function createProductionRagRepository(): RagRepository {
  if (ragRegistrySlot.instance) return ragRegistrySlot.instance;

  const sql = createEISql('vedmoulya-rag-registry');
  // AI-RUNTIME-002 C-01: run the production pgvector migrations. In
  // production/staging we run the full `ensureRagReady` gate (migrate +
  // verify) so a missing vector store fails fast instead of silently
  // degrading to an unsafe in-memory fallback. In development/test the
  // migration is fire-and-forget (the in-memory repository is the hermetic
  // test double and the local Postgres may not be running).
  const env: string = process.env.NODE_ENV ?? 'development';
  const isStrict = env === 'production' || env === 'staging';
  if (isStrict) {
    // Synchronous probe with a bounded timeout: if the vector store is not
    // reachable or the schema is absent, fail fast — RAG must never silently
    // degrade in production. The migration itself is still applied
    // idempotently; `ensureRagReady` verifies the schema is queryable.
    void ensureRagReady(sql, 1536).catch((error: unknown) => {
      logger.error('RAG pgvector readiness gate FAILED in production — RAG is unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
    // Synchronous probe so a totally unreachable database fails immediately
    // on the first AI/RAG request instead of on every request with a stale
    // pool. Never throws here (lazy clients); the probe result is surfaced
    // through the `rag.getHealth` procedure.
    void probeRagSchema(sql, 1536);
  } else {
    runRagMigrations(sql, 1536).catch((error: unknown) => {
      logger.warn('RAG schema creation deferred (database unreachable at startup)', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
  const repo = new PostgresRagRepository(sql, 1536);

  ragRegistrySlot.instance = repo;
  return repo;
}
