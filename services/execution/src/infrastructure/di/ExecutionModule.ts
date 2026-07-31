// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Module Registration
// Registers all execution infrastructure services with DI container
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { container, moduleRegistry } from '@vedmoulya/core';
import type { ModuleDefinition } from '@vedmoulya/core';
import type { ExecutionRepository } from '@vedmoulya/domain';
import { PostgresExecutionRepository } from '../persistence/PostgresExecutionRepository.js';
import { ExecutionCache } from '../cache/ExecutionCache.js';
import { ExecutionEventPublisher } from '../events/ExecutionEventPublisher.js';
import { initializeDatabase, closeDatabase } from '../persistence/DatabaseConnection.js';
import { InMemoryEventBus } from '@vedmoulya/core';
import { ExecutionMetrics } from '../../observability/ExecutionMetrics.js';
import { ExecutionAuditor } from '../../observability/ExecutionAudit.js';
import { ExecutionTracer } from '../../observability/ExecutionTracing.js';

export function registerExecutionServices(): void {
  // Database
  container.register('execution.db', () => {
    initializeDatabase();
    return {};
  });

  // Repository
  container.register<ExecutionRepository>('execution.repository', () => {
    return new PostgresExecutionRepository();
  });

  // Cache
  container.register<ExecutionCache>('execution.cache', () => {
    return new ExecutionCache();
  });

  // Event Publisher
  container.register<ExecutionEventPublisher>('execution.event-publisher', () => {
    const eventBus = container.has('event-bus')
      ? (container.resolve('event-bus') as InMemoryEventBus)
      : new InMemoryEventBus();
    return new ExecutionEventPublisher(eventBus);
  });

  // Observability
  container.register<ExecutionMetrics>('execution.metrics', () => {
    return new ExecutionMetrics();
  });

  container.register<ExecutionAuditor>('execution.auditor', () => {
    return new ExecutionAuditor();
  });

  container.register<ExecutionTracer>('execution.tracer', () => {
    return new ExecutionTracer();
  });
}

export const executionModule: ModuleDefinition = {
  name: 'execution',
  description: 'Execution Intelligence Engine — plan, schedule, execute, monitor, and recover',
  version: '0.1.0',
  dependencies: ['core'],
  register: () => {
    registerExecutionServices();
  },
  initialize: () => {
    initializeDatabase();
    return Promise.resolve();
  },
  shutdown: async () => {
    await closeDatabase();
  },
};

moduleRegistry.register(executionModule);
