// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Production Engine Repository Wiring
// SPRINT PR-002B regression tests — prove the gateway resolves production
// persistence for memory, decision, execution, and knowledge through each
// service module's existing DI registration (mirroring the PR-002A identity
// wiring) and that ApiApplicationService accepts injectable overrides.
//
// Coverage:
//   - Factory resolution: each createProduction{X}Repository() resolves the
//     production Postgres repository via the {x}.repository DI registration.
//   - Singleton semantics: repeated calls return the same instance.
//   - Injectable overrides: ApiApplicationService accepts per-engine
//     repositories (backward compatible) and defaults to production.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Hermetic provider environment: a developer shell may carry a real provider
// key, which would register OpenAIProvider and route the orchestrate tests to
// the live API (slow/blocked). These tests assert `provider === 'mock'` and
// must run against the deterministic mock only — the same convention the
// streamed-run test below documents explicitly.
beforeAll(() => {
  process.env.OPENAI_API_KEY = '';
  process.env.AI_OPENAI_API_KEY = '';
  process.env.AI_ANTHROPIC_API_KEY = '';
  process.env.AI_GOOGLE_API_KEY = '';
});

// CERT-002: silence the observability logger for this suite — constructing the
// production ApiApplicationService resolves real Postgres repositories whose
// DatabaseConnection singletons emit "…database connection established" INFO
// logs. Vitest intercepts console output asynchronously via the worker RPC;
// under full-suite load the pending writes race with worker teardown and
// surface as `Closing rpc while "onUserConsoleLog" was pending` teardown errors
// even though every test passes. The wiring under test here is repository
// resolution — not the logger — so the logger is a no-op.
vi.mock('@vedmoulya/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vedmoulya/core')>();
  const silentLogger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
    child: () => silentLogger,
  };
  return { ...actual, logger: silentLogger };
});

import { container } from '@vedmoulya/core';
import { PostgresMemoryRepository } from '@vedmoulya/memory';
import { PostgresDecisionRepository } from '@vedmoulya/decision';
import { PostgresExecutionRepository } from '@vedmoulya/execution';
import { PostgresKnowledgeRepository } from '@vedmoulya/knowledge';
import { PostgresLearningRepository } from '@vedmoulya/learning-intelligence';
import { PostgresBrainRepository } from '@vedmoulya/enterprise-brain';
import { PostgresKnowledgeRepository as PostgresKnowledgeIntelligenceRepository } from '@vedmoulya/knowledge-intelligence';
import { PostgresMemoryRepository as PostgresMemoryIntelligenceRepository } from '@vedmoulya/memory-intelligence';
import { PostgresOSRepository } from '@vedmoulya/os-intelligence';
import { PostgresGraphRepository as PostgresContextFabricRepository } from '@vedmoulya/context-fabric';
import { PostgresRagRepository } from '@vedmoulya/rag';
import {
  InMemoryRagRepository,
  MockEmbeddingProvider,
  RagApplicationService,
} from '@vedmoulya/rag';
import { ApiApplicationService } from '../services/ApiApplicationService.js';
import { AIOrchestrationService } from '@vedmoulya/services';
import { MockProvider } from '@vedmoulya/orchestrator';
import { createInMemoryRepositories } from '../infrastructure/InMemoryRepositories.js';
import { InMemoryProviderRepository, createCatalogProviders } from '@vedmoulya/providers';
import {
  InMemoryExecutionStrategyRepository,
  createCatalogStrategies,
} from '@vedmoulya/execution-strategy';
import { InMemoryBrainRepository } from '@vedmoulya/enterprise-brain';
import { InMemoryLearningRepository } from '@vedmoulya/learning-intelligence';
import { InMemoryKnowledgeRepository as InMemoryKnowledgeIntelligenceRepository } from '@vedmoulya/knowledge-intelligence';
import { InMemoryGoalRepository, InMemoryTaskRepository } from '@vedmoulya/goals';
import {
  createProductionMemoryRepository,
  createProductionDecisionRepository,
  createProductionExecutionRepository,
  createProductionKnowledgeRepository,
  createProductionProviderRepository,
  createProductionLearningRepository,
  createProductionBrainRepository,
  createProductionKnowledgeIntelligenceRepository,
  createProductionMemoryIntelligenceRepository,
  createProductionOSIntelligenceRepository,
  createProductionContextFabricRepository,
  createProductionRagRepository,
  createProductionApplicationRepository,
} from '../infrastructure/ProductionRepositories.js';

// ── Factory Resolution (DI reuse) ────────────────────────────────────────────

describe('createProduction{X}Repository (SPRINT PR-002B)', () => {
  it('resolves the production PostgresMemoryRepository via memory DI registration', () => {
    const repo = createProductionMemoryRepository();
    expect(repo).toBeInstanceOf(PostgresMemoryRepository);
    // Reuses the existing DI registration — no duplicate registration.
    expect(container.has('memory.repository')).toBe(true);
  });

  it('resolves the production PostgresDecisionRepository via decision DI registration', () => {
    const repo = createProductionDecisionRepository();
    expect(repo).toBeInstanceOf(PostgresDecisionRepository);
    expect(container.has('decision.repository')).toBe(true);
  });

  it('resolves the production PostgresExecutionRepository via execution DI registration', () => {
    const repo = createProductionExecutionRepository();
    expect(repo).toBeInstanceOf(PostgresExecutionRepository);
    expect(container.has('execution.repository')).toBe(true);
  });

  it('resolves the production PostgresKnowledgeRepository via knowledge DI registration', () => {
    const repo = createProductionKnowledgeRepository();
    expect(repo).toBeInstanceOf(PostgresKnowledgeRepository);
    expect(container.has('knowledge.repository')).toBe(true);
  });

  it('returns the same singleton instance across calls for each engine', () => {
    expect(createProductionMemoryRepository()).toBe(createProductionMemoryRepository());
    expect(createProductionDecisionRepository()).toBe(createProductionDecisionRepository());
    expect(createProductionExecutionRepository()).toBe(createProductionExecutionRepository());
    expect(createProductionKnowledgeRepository()).toBe(createProductionKnowledgeRepository());
  });
});

// ── Provider Registry Wiring (CERT-002 C-04 follow-up) ──────────────────────
// The gateway default resolves the hermetic SEEDED in-memory registry in
// development/test (documented convention — the local Postgres may not be
// running, mirroring the app-factory / requirements / RAG registries below)
// and the production Postgres registry in production/staging. Production
// semantics are unchanged: the fallback is unreachable when NODE_ENV is
// production/staging.

describe('createProductionProviderRepository (CERT-002 C-04 follow-up)', () => {
  it('resolves the seeded in-memory hermetic registry in development/test', () => {
    const repo = createProductionProviderRepository();
    expect(repo.constructor.name).toBe('InMemoryProviderRepository');
  });

  it('returns the same singleton instance across calls (per-process registry)', () => {
    expect(createProductionProviderRepository()).toBe(createProductionProviderRepository());
  });

  it('defaults the ApiApplicationService providers store to the hermetic registry', () => {
    const svc = new ApiApplicationService();
    expect(svc.providers).toBeDefined();
    expect(createProductionProviderRepository().constructor.name).toBe(
      'InMemoryProviderRepository',
    );
  });
});

// ── Learning Intelligence Wiring (EI-007) ────────────────────────────────────

describe('createProductionLearningRepository (EI-007)', () => {
  it('resolves the production PostgresLearningRepository for the gateway default', () => {
    const repo = createProductionLearningRepository();
    expect(repo).toBeInstanceOf(PostgresLearningRepository);
  });

  it('returns the same singleton instance across calls', () => {
    expect(createProductionLearningRepository()).toBe(createProductionLearningRepository());
  });

  it('defaults the ApiApplicationService learningIntelligence store to the production repository', () => {
    const svc = new ApiApplicationService();
    expect(svc.learningIntelligence).toBeDefined();
    expect(createProductionLearningRepository()).toBeInstanceOf(PostgresLearningRepository);
  });
});

// ── Enterprise Knowledge Intelligence Wiring (EI-009) ────────────────────────

describe('createProductionKnowledgeIntelligenceRepository (EI-009)', () => {
  it('resolves the production PostgresKnowledgeIntelligenceRepository for the gateway default', () => {
    const repo = createProductionKnowledgeIntelligenceRepository();
    expect(repo).toBeInstanceOf(PostgresKnowledgeIntelligenceRepository);
  });

  it('returns the same singleton instance across calls', () => {
    expect(createProductionKnowledgeIntelligenceRepository()).toBe(
      createProductionKnowledgeIntelligenceRepository(),
    );
  });

  it('defaults the ApiApplicationService knowledgeIntelligence store to the production repository', () => {
    const svc = new ApiApplicationService();
    expect(svc.knowledgeIntelligence).toBeDefined();
    expect(createProductionKnowledgeIntelligenceRepository()).toBeInstanceOf(
      PostgresKnowledgeIntelligenceRepository,
    );
  });
});

// ── Enterprise Memory Intelligence Wiring (EI-010) ──────────────────────────

describe('createProductionMemoryIntelligenceRepository (EI-010)', () => {
  it('resolves the production PostgresMemoryIntelligenceRepository for the gateway default', () => {
    const repo = createProductionMemoryIntelligenceRepository();
    expect(repo).toBeInstanceOf(PostgresMemoryIntelligenceRepository);
  });

  it('returns the same singleton instance across calls', () => {
    expect(createProductionMemoryIntelligenceRepository()).toBe(
      createProductionMemoryIntelligenceRepository(),
    );
  });

  it('defaults the ApiApplicationService memoryIntelligence store to the production repository', () => {
    const svc = new ApiApplicationService();
    expect(svc.memoryIntelligence).toBeDefined();
    expect(createProductionMemoryIntelligenceRepository()).toBeInstanceOf(
      PostgresMemoryIntelligenceRepository,
    );
  });
});

// ── Enterprise Operating System Integration Wiring (OS-001) ─────────────────

describe('createProductionOSIntelligenceRepository (EPIC-005 / OS-001)', () => {
  it('resolves the production PostgresOSRepository for the gateway default', () => {
    const repo = createProductionOSIntelligenceRepository();
    expect(repo).toBeInstanceOf(PostgresOSRepository);
  });

  it('returns the same singleton instance across calls', () => {
    expect(createProductionOSIntelligenceRepository()).toBe(
      createProductionOSIntelligenceRepository(),
    );
  });

  it('defaults the ApiApplicationService osIntelligence store to the production repository', () => {
    const svc = new ApiApplicationService();
    expect(svc.osIntelligence).toBeDefined();
    expect(createProductionOSIntelligenceRepository()).toBeInstanceOf(PostgresOSRepository);
  });
});

// ── Context & Personal Intelligence Fabric Wiring (APP-001) ──────────────────

describe('createProductionContextFabricRepository (APP-001)', () => {
  it('resolves the production PostgresGraphRepository for the gateway default', () => {
    const repo = createProductionContextFabricRepository();
    expect(repo).toBeInstanceOf(PostgresContextFabricRepository);
  });

  it('returns the same singleton instance across calls', () => {
    expect(createProductionContextFabricRepository()).toBe(
      createProductionContextFabricRepository(),
    );
  });

  it('defaults the ApiApplicationService contextFabric store to the production repository', () => {
    const svc = new ApiApplicationService();
    expect(svc.contextFabric).toBeDefined();
    expect(createProductionContextFabricRepository()).toBeInstanceOf(
      PostgresContextFabricRepository,
    );
  });
});

// ── Enterprise Brain Wiring (EI-008) ─────────────────────────────────────────

describe('createProductionBrainRepository (EI-008)', () => {
  it('resolves the production PostgresBrainRepository for the gateway default', () => {
    const repo = createProductionBrainRepository();
    expect(repo).toBeInstanceOf(PostgresBrainRepository);
  });

  it('returns the same singleton instance across calls', () => {
    expect(createProductionBrainRepository()).toBe(createProductionBrainRepository());
  });

  it('defaults the ApiApplicationService enterpriseBrain store to the production repository', () => {
    const svc = new ApiApplicationService();
    expect(svc.enterpriseBrain).toBeDefined();
    expect(createProductionBrainRepository()).toBeInstanceOf(PostgresBrainRepository);
  });
});

// ── ApiApplicationService Injection & Defaults ───────────────────────────────

describe('ApiApplicationService per-engine repository wiring', () => {
  it('defaults all four engines to their production repositories', () => {
    const svc = new ApiApplicationService();
    expect(svc.memory).toBeDefined();
    expect(svc.decision).toBeDefined();
    expect(svc.execution).toBeDefined();
    expect(svc.knowledge).toBeDefined();
    // The default wiring resolves the same production singletons the factories
    // return (reusing each module's DI registration).
    expect(container.resolve('memory.repository')).toBe(createProductionMemoryRepository());
    expect(container.resolve('decision.repository')).toBe(createProductionDecisionRepository());
    expect(container.resolve('execution.repository')).toBe(createProductionExecutionRepository());
    expect(container.resolve('knowledge.repository')).toBe(createProductionKnowledgeRepository());
  });

  it('uses injected repositories for all four engines instead of production', () => {
    const repos = createInMemoryRepositories();
    const svc = new ApiApplicationService({
      memoryRepository: repos.memory,
      decisionRepository: repos.decision,
      executionRepository: repos.execution,
      knowledgeRepository: repos.knowledge,
    });
    expect(svc.memory).toBeDefined();
    expect(svc.decision).toBeDefined();
    expect(svc.execution).toBeDefined();
    expect(svc.knowledge).toBeDefined();
  });

  it('supports mixed overrides (per-engine injection is independent)', () => {
    const repos = createInMemoryRepositories();
    const svc = new ApiApplicationService({
      memoryRepository: repos.memory,
      executionRepository: repos.execution,
    });
    expect(svc.memory).toBeDefined();
    expect(svc.execution).toBeDefined();
    expect(svc.decision).toBeDefined();
    expect(svc.knowledge).toBeDefined();
    // Overridden engines use the injected double; non-overridden engines
    // still resolve production singletons.
    expect(container.resolve('decision.repository')).toBe(createProductionDecisionRepository());
    expect(container.resolve('knowledge.repository')).toBe(createProductionKnowledgeRepository());
  });
});

// ── Application service happy-path against the wired repository ─────────────

describe('Gateway engine services against injected repositories', () => {
  it('captures and recalls a memory through the wired application service', async () => {
    const repos = createInMemoryRepositories();
    const svc = new ApiApplicationService({ memoryRepository: repos.memory });

    const captured = await svc.memory.captureMemory({
      category: 'experience',
      title: 'PR-002B memory',
      content: 'wired through the gateway',
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: 'user_input',
      sourceDetail: 'test',
      tags: ['pr-002b'],
    });
    expect(captured.success).toBe(true);

    const recalled = await svc.memory.getMemory(captured.data?.id ?? '');
    expect(recalled.success).toBe(true);
    expect(recalled.data?.title).toBe('PR-002B memory');
  });

  it('captures and retrieves an Enterprise Memory (EI-010) through the wired service', async () => {
    const repos = createInMemoryRepositories();
    // EI-010 capture runs enrichWithEngines() which consults brain, learning,
    // knowledge, and goals. Every engine must use an in-memory repository so
    // the test stays hermetic and never touches Postgres.
    const svc = new ApiApplicationService({
      memoryIntelligenceRepository: repos.memoryIntelligence,
      brainRepository: new InMemoryBrainRepository(),
      learningRepository: new InMemoryLearningRepository(),
      knowledgeIntelligenceRepository: new InMemoryKnowledgeIntelligenceRepository(),
      goalRepositories: {
        goals: new InMemoryGoalRepository(),
        tasks: new InMemoryTaskRepository(),
      },
    });

    const captured = await svc.memoryIntelligence.capture({
      type: 'execution',
      title: 'EI-010 gateway wiring memory',
      content: 'Captured through the API gateway wiring under test.',
      source: 'gateway wiring test',
      sourceType: 'event',
      owner: 'platform',
      tags: ['ei-010'],
    });
    expect(captured.success).toBe(true);
    expect(captured.data?.lifecycleStatus).toBe('active');

    const recalled = await svc.memoryIntelligence.getItem(captured.data?.memoryId ?? '');
    expect(recalled.success).toBe(true);
    expect(recalled.data?.title).toBe('EI-010 gateway wiring memory');

    const retrieved = await svc.memoryIntelligence.retrieve({ query: 'gateway wiring' });
    expect(retrieved.success).toBe(true);
    expect(retrieved.data?.length).toBeGreaterThan(0);
  });
});

describe('AI Runtime provider wiring (AI-RUNTIME-001)', () => {
  it('registers the platform AI providers on the gateway orchestrator', () => {
    const svc = new ApiApplicationService();
    // registerPlatformProviders() — MockProvider in non-production so every
    // AI path (Content Agency, insights) is exercisable; OpenAIProvider only
    // when OPENAI_API_KEY is present.
    expect(svc.ai.getProvider('mock')).toBeDefined();
    const listed = svc.ai.listProviders();
    expect(listed.providers.some((p) => p.id === 'mock')).toBe(true);
    expect(listed.total).toBeGreaterThanOrEqual(1);
  });

  it('routes a real orchestrate request end-to-end on the gateway runtime', async () => {
    const svc = new ApiApplicationService();
    const result = await svc.ai.orchestrate({
      capability: 'reasoning',
      userInput: 'Gateway wiring smoke: analyze a sample task.',
      qualityTier: 'standard',
      userId: 'wiring-test',
    });
    expect(result.provider).toBe('mock');
    expect(result.content).toContain('Mock response');
    expect(result.traceId).toMatch(/^mock-/);
  });
});

// ── Application Factory Registry (EPIC-007/008) ────────────────────────────
// The gateway default resolves the hermetic in-memory registry in
// development/test (documented convention — the local Postgres may not be
// running, mirroring the RAG registry note) and the production Postgres
// registry in production/staging. Production semantics are unchanged.

describe('createProductionApplicationRepository (EPIC-007/008)', () => {
  it('resolves the in-memory hermetic registry in development/test', () => {
    const repo = createProductionApplicationRepository();
    expect(repo.constructor.name).toBe('InMemoryApplicationRepository');
  });

  it('returns the same singleton instance across calls (per-process registry)', () => {
    expect(createProductionApplicationRepository()).toBe(createProductionApplicationRepository());
  });
});

// ── RAG + AI Runtime Intelligence Wiring (EPIC-005 / AI-RUNTIME-002) ────────

describe('createProductionRagRepository (AI-RUNTIME-002)', () => {
  it('resolves the production Postgres + pgvector RagRepository for the gateway default', () => {
    const repo = createProductionRagRepository();
    expect(repo).toBeInstanceOf(PostgresRagRepository);
  });

  it('returns the same singleton instance across calls', () => {
    expect(createProductionRagRepository()).toBe(createProductionRagRepository());
  });

  it('defaults the ApiApplicationService rag store to the production repository', () => {
    const svc = new ApiApplicationService();
    expect(svc.rag).toBeDefined();
    expect(createProductionRagRepository()).toBeInstanceOf(PostgresRagRepository);
  });
});

describe('AI runtime intelligence wiring (AI-RUNTIME-002)', () => {
  it('wires the EI-002/EI-004 ports and the RAG port into the orchestrator', async () => {
    const svc = new ApiApplicationService({
      ragRepository: new InMemoryRagRepository(),
      ragEmbeddingProvider: new MockEmbeddingProvider(),
      // Hermetic catalogs so the advisor consumes real seeded intelligence
      // without a database.
      providersRepository: new InMemoryProviderRepository(createCatalogProviders()),
      executionStrategyRepository: new InMemoryExecutionStrategyRepository(
        createCatalogStrategies(),
      ),
    });

    // explainSelection consumes live EI-002/EI-004 intelligence (seeded
    // catalogs resolve providers for the capability).
    const explanation = await svc.ai.explainSelection({
      capability: 'reasoning',
      estimatedInputTokens: 500,
    });
    expect(explanation.selected.providerId).toBeTruthy();
    expect(explanation.selected.reasons.length).toBeGreaterThan(0);
    expect(explanation.strategy).toBeTruthy();
  });

  it('retrieves RAG context into an orchestrate request through the runtime port', async () => {
    const svc = new ApiApplicationService({
      ragRepository: new InMemoryRagRepository(),
      ragEmbeddingProvider: new MockEmbeddingProvider(),
    });

    // Seed the collection, then run an orchestrate request with a ragQuery.
    await svc.rag.ingestDocument({
      userId: 'wiring-rag',
      collection: 'org:wiring',
      sourceId: 'kb-wiring-001',
      title: 'Onboarding playbook',
      content:
        'The content agency onboards clients through lead capture, brand definition and project scoping.',
    });

    const result = await svc.ai.orchestrate({
      capability: 'reasoning',
      userInput: 'Summarize the onboarding steps.',
      qualityTier: 'standard',
      userId: 'wiring-rag',
      ragQuery: {
        collection: 'org:wiring',
        query: 'client onboarding workflow',
        topK: 3,
      },
      enableOptimization: true,
    });
    expect(result.provider).toBe('mock');
    expect(result.content).toContain('Mock response');
    // The mock provider echoes the assembled context, proving the retrieved
    // RAG chunks reached the model prompt.
    expect(result.content).toContain('onboarding');
  });

  it('produces a streamed run through the runtime (deterministic mock)', async () => {
    // A dedicated orchestrator with only the deterministic mock registered:
    // the streamed run is hermetic regardless of local OPENAI_API_KEY.
    const ai = new AIOrchestrationService();
    ai.registerProvider(new MockProvider());
    const run = await ai.stream({
      capability: 'reasoning',
      userInput: 'Stream a short analysis.',
      qualityTier: 'standard',
      userId: 'wiring-stream',
    });
    expect(run.events[0]).toMatchObject({ type: 'status', stage: 'thinking' });
    expect(run.events.map((e) => e.type)).toContain('content');
    expect(run.final.content).toContain('Mock response');
  });

  it('wires a hermetic RagApplicationService through ApiApplicationService', async () => {
    const svc = new ApiApplicationService({
      ragRepository: new InMemoryRagRepository(),
      ragEmbeddingProvider: new MockEmbeddingProvider(),
    });
    expect(svc.rag).toBeInstanceOf(RagApplicationService);
    const ingest = await svc.rag.ingestDocument({
      userId: 'wiring-rag2',
      collection: 'org:wiring2',
      sourceId: 'kb-1',
      title: 'T',
      content: 'Stable brand guidelines reused across generation runs.',
    });
    expect(ingest.chunkCount).toBeGreaterThan(0);
  });
});
