// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Module Registration
// Registers all knowledge infrastructure services with DI container
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { container, moduleRegistry } from '@vedmoulya/core';
import type { ModuleDefinition } from '@vedmoulya/core';
import type { KnowledgeRepository } from '@vedmoulya/domain';
import { PostgresKnowledgeRepository } from '../persistence/PostgresKnowledgeRepository.js';
import { KnowledgeCache } from '../cache/KnowledgeCache.js';
import { KnowledgeEventPublisher } from '../events/KnowledgeEventPublisher.js';
import { initializeDatabase, closeDatabase } from '../persistence/DatabaseConnection.js';
import { InMemoryEventBus } from '@vedmoulya/core';
import { KnowledgeMetrics } from '../../observability/KnowledgeMetrics.js';
import { KnowledgeAuditor } from '../../observability/KnowledgeAudit.js';
import { KnowledgeTracer } from '../../observability/KnowledgeTracing.js';

/** Register all knowledge infrastructure services with the DI container */
export function registerKnowledgeServices(): void {
  // Database
  container.register('knowledge.db', async () => {
    await initializeDatabase();
    return {};
  });

  // Repository
  container.register<KnowledgeRepository>('knowledge.repository', () => {
    return new PostgresKnowledgeRepository();
  });

  // Cache
  container.register<KnowledgeCache>('knowledge.cache', () => {
    return new KnowledgeCache();
  });

  // Event Publisher
  container.register<KnowledgeEventPublisher>('knowledge.event-publisher', () => {
    const eventBus = container.has('event-bus')
      ? (container.resolve('event-bus') as InMemoryEventBus)
      : new InMemoryEventBus();
    return new KnowledgeEventPublisher(eventBus);
  });

  // Observability
  container.register<KnowledgeMetrics>('knowledge.metrics', () => {
    return new KnowledgeMetrics();
  });

  container.register<KnowledgeAuditor>('knowledge.auditor', () => {
    return new KnowledgeAuditor();
  });

  container.register<KnowledgeTracer>('knowledge.tracer', () => {
    return new KnowledgeTracer();
  });
}

/** Define the knowledge module for the module registry */
export const knowledgeModule: ModuleDefinition = {
  name: 'knowledge',
  description: 'Knowledge Graph — nodes, edges, traversal, search, and AI context provision',
  version: '0.1.0',
  dependencies: ['core'],
  register: () => {
    registerKnowledgeServices();
  },
  initialize: async () => {
    await initializeDatabase();
  },
  shutdown: async () => {
    await closeDatabase();
  },
};

/** Self-register the module */
moduleRegistry.register(knowledgeModule);
