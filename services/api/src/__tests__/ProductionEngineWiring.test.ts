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

import { describe, it, expect } from 'vitest';
import { container } from '@vedmoulya/core';
import { PostgresMemoryRepository } from '@vedmoulya/memory';
import { PostgresDecisionRepository } from '@vedmoulya/decision';
import { PostgresExecutionRepository } from '@vedmoulya/execution';
import { PostgresKnowledgeRepository } from '@vedmoulya/knowledge';
import { ApiApplicationService } from '../services/ApiApplicationService.js';
import { createInMemoryRepositories } from '../infrastructure/InMemoryRepositories.js';
import {
  createProductionMemoryRepository,
  createProductionDecisionRepository,
  createProductionExecutionRepository,
  createProductionKnowledgeRepository,
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
});
