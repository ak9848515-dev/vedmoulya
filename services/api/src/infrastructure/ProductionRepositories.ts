// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Production Repositories
// Resolves the real production repositories for the gateway by reusing each
// service module's existing DI registration — no duplicate registration.
// SPRINT PR-002A (identity) + PR-002B (memory, decision, execution, knowledge)
// ─────────────────────────────────────────────────────────────────────────────

import { container, logger } from '@vedmoulya/core';
import type {
  IdentityRepository,
  MemoryRepository,
  DecisionRepository,
  ExecutionRepository,
  KnowledgeRepository,
} from '@vedmoulya/domain';
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
