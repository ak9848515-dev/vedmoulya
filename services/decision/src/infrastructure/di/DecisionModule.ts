// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Module Registration
// Registers all decision infrastructure services with DI container
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { container, moduleRegistry } from '@vedmoulya/core';
import type { ModuleDefinition } from '@vedmoulya/core';
import type { DecisionRepository } from '@vedmoulya/domain';
import { PostgresDecisionRepository } from '../persistence/PostgresDecisionRepository.js';
import { DecisionCache } from '../cache/DecisionCache.js';
import { DecisionEventPublisher } from '../events/DecisionEventPublisher.js';
import { initializeDatabase, closeDatabase } from '../persistence/DatabaseConnection.js';
import { InMemoryEventBus } from '@vedmoulya/core';
import { DecisionMetrics } from '../../observability/DecisionMetrics.js';
import { DecisionAuditor } from '../../observability/DecisionAudit.js';
import { DecisionTracer } from '../../observability/DecisionTracing.js';

/** Register all decision infrastructure services with the DI container */
export function registerDecisionServices(): void {
  // Database
  container.register('decision.db', () => {
    initializeDatabase();
    return {};
  });

  // Repository
  container.register<DecisionRepository>('decision.repository', () => {
    return new PostgresDecisionRepository();
  });

  // Cache
  container.register<DecisionCache>('decision.cache', () => {
    return new DecisionCache();
  });

  // Event Publisher
  container.register<DecisionEventPublisher>('decision.event-publisher', () => {
    const eventBus = container.has('event-bus')
      ? (container.resolve('event-bus') as InMemoryEventBus)
      : new InMemoryEventBus();
    return new DecisionEventPublisher(eventBus);
  });

  // Observability
  container.register<DecisionMetrics>('decision.metrics', () => {
    return new DecisionMetrics();
  });

  container.register<DecisionAuditor>('decision.auditor', () => {
    return new DecisionAuditor();
  });

  container.register<DecisionTracer>('decision.tracer', () => {
    return new DecisionTracer();
  });
}

/** Define the decision module for the module registry */
export const decisionModule: ModuleDefinition = {
  name: 'decision',
  description:
    'Decision Intelligence Engine — create, evaluate, rank, recommend, complete decisions',
  version: '0.1.0',
  dependencies: ['core'],
  register: () => {
    registerDecisionServices();
  },
  initialize: () => {
    initializeDatabase();
    return Promise.resolve();
  },
  shutdown: async () => {
    await closeDatabase();
  },
};

/** Self-register the module */
moduleRegistry.register(decisionModule);
