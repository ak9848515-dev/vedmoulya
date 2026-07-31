// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Module Registration
// Registers all memory infrastructure services with DI container
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { container, moduleRegistry } from '@vedmoulya/core';
import type { ModuleDefinition } from '@vedmoulya/core';
import type { MemoryRepository } from '@vedmoulya/domain';
import { PostgresMemoryRepository } from '../persistence/PostgresMemoryRepository.js';
import { MemoryCache } from '../cache/MemoryCache.js';
import { MemoryEventPublisher } from '../events/MemoryEventPublisher.js';
import { initializeDatabase, closeDatabase } from '../persistence/DatabaseConnection.js';
import { InMemoryEventBus } from '@vedmoulya/core';
import { MemoryMetrics } from '../../observability/MemoryMetrics.js';
import { MemoryAuditor } from '../../observability/MemoryAudit.js';
import { MemoryTracer } from '../../observability/MemoryTracing.js';

/** Register all memory infrastructure services with the DI container */
export function registerMemoryServices(): void {
  // Database
  container.register('memory.db', () => {
    initializeDatabase();
    return {};
  });

  // Repository
  container.register<MemoryRepository>('memory.repository', () => {
    return new PostgresMemoryRepository();
  });

  // Cache
  container.register<MemoryCache>('memory.cache', () => {
    return new MemoryCache();
  });

  // Event Publisher
  container.register<MemoryEventPublisher>('memory.event-publisher', () => {
    const eventBus = container.has('event-bus')
      ? (container.resolve('event-bus') as InMemoryEventBus)
      : new InMemoryEventBus();
    return new MemoryEventPublisher(eventBus);
  });

  // Observability
  container.register<MemoryMetrics>('memory.metrics', () => {
    return new MemoryMetrics();
  });

  container.register<MemoryAuditor>('memory.auditor', () => {
    return new MemoryAuditor();
  });

  container.register<MemoryTracer>('memory.tracer', () => {
    return new MemoryTracer();
  });
}

/** Define the memory module for the module registry */
export const memoryModule: ModuleDefinition = {
  name: 'memory',
  description: 'Memory Engine — capture, recall, consolidate, decay, timeline, retention',
  version: '0.1.0',
  dependencies: ['core'],
  register: () => {
    registerMemoryServices();
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
moduleRegistry.register(memoryModule);
