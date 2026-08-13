// ──────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Pipeline: Shared Test Harness
// EI-006 / INT-001
// Builds the six REAL engine application services with seeded
// in-memory repositories so pipeline tests exercise genuine reuse.
// ──────────────────────────────────────────────────────────────────

import {
  GoalsApplicationService,
  InMemoryGoalRepository,
  InMemoryTaskRepository,
  createCatalogGoals,
} from '@vedmoulya/goals';
import {
  CapabilityApplicationService,
  InMemoryCapabilityRepository,
  createCatalogCapabilities,
} from '@vedmoulya/capabilities';
import {
  InMemoryProviderRepository,
  ProviderApplicationService,
  createCatalogProviders,
} from '@vedmoulya/providers';
import {
  ContextApplicationService,
  InMemoryContextRepository,
  createCatalogContext,
} from '@vedmoulya/context';
import {
  ExecutionStrategyApplicationService,
  InMemoryExecutionStrategyRepository,
  createCatalogStrategies,
} from '@vedmoulya/execution-strategy';
import {
  InMemoryExecutionGraphRepository,
  InMemoryExecutionHistoryRepository,
  InMemoryExecutionQueueRepository,
  InMemoryExecutionSessionRepository,
  InMemoryWorkerRegistry,
  OrchestratorApplicationService,
} from '@vedmoulya/execution-orchestrator';
import { IntelligenceApplicationService, InMemoryPipelineRepository } from '../../index.js';
import type { IntelligenceEngines } from '../../contracts/pipeline-engines.js';

export interface TestEngines extends IntelligenceEngines {
  goals: GoalsApplicationService;
  capabilities: CapabilityApplicationService;
  providers: ProviderApplicationService;
  context: ContextApplicationService;
  strategies: ExecutionStrategyApplicationService;
  orchestrator: OrchestratorApplicationService;
}

export function createTestEngines(): TestEngines {
  const goals = new GoalsApplicationService(
    new InMemoryGoalRepository(createCatalogGoals()),
    new InMemoryTaskRepository(),
  );
  const capabilities = new CapabilityApplicationService(
    new InMemoryCapabilityRepository(createCatalogCapabilities()),
  );
  const providers = new ProviderApplicationService(
    new InMemoryProviderRepository(createCatalogProviders()),
  );
  const context = new ContextApplicationService(
    new InMemoryContextRepository(createCatalogContext()),
  );
  const strategies = new ExecutionStrategyApplicationService(
    new InMemoryExecutionStrategyRepository(createCatalogStrategies()),
  );
  const orchestrator = new OrchestratorApplicationService(
    new InMemoryExecutionGraphRepository(),
    new InMemoryExecutionSessionRepository(),
    new InMemoryWorkerRegistry(),
    new InMemoryExecutionQueueRepository(),
    new InMemoryExecutionHistoryRepository(),
  );
  return { goals, capabilities, providers, context, strategies, orchestrator };
}

export function createTestIntelligenceService(engines: TestEngines = createTestEngines()): {
  service: IntelligenceApplicationService;
  engines: TestEngines;
  repository: InMemoryPipelineRepository;
} {
  const repository = new InMemoryPipelineRepository();
  return { service: new IntelligenceApplicationService(repository, engines), engines, repository };
}
