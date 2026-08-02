// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: In-Memory Repository Integration Tests
// Exercises the platform application services against the Map-backed
// in-memory repositories for the four non-authentication engines (memory,
// decision, execution, knowledge). This regression-guards the PR-002
// load-test finding: the previous `{} as never` dev stubs crashed with
// `repository.findById is not a function` on the first protected procedure
// call (identity.getProfile → 500). With functional repos every gateway
// procedure behaves correctly end-to-end.
//
// NOTE (SPRINT PR-002A): the gateway now wires the identity engine to the
// production `PostgresIdentityRepository` (see ProductionIdentityWiring.test.ts);
// these in-memory identity cases remain as a unit-level check that the
// application service works against a functional repository.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInMemoryRepositories,
  type InMemoryRepositories,
} from '../infrastructure/InMemoryRepositories.js';
import {
  IdentityApplicationService,
  MemoryApplicationService,
  DecisionApplicationService,
  ExecutionApplicationService,
  KnowledgeApplicationService,
} from '@vedmoulya/services';
import { NotFoundError } from '@vedmoulya/core';

describe('InMemoryRepositories (gateway wiring)', () => {
  let repos: InMemoryRepositories;

  beforeEach(() => {
    repos = createInMemoryRepositories();
  });

  describe('identity', () => {
    it('registers and retrieves a user via the real application service (getProfile path)', async () => {
      const service = new IdentityApplicationService(repos.identity);

      const registered = await service.registerUser({
        email: 'gateway@vedmoulya.dev',
        displayName: 'Gateway User',
        givenName: 'Gateway',
        familyName: 'User',
        passwordHash: 'hashed-value',
      });

      // The exact path that 500'd on the old `{}` stub:
      const profile = await service.getUserById(registered.id);
      expect(profile.email).toBe('gateway@vedmoulya.dev');
      expect(profile.displayName).toBe('Gateway User');
    });

    it('returns NotFoundError for a missing user (proper 404, not a 500)', async () => {
      const service = new IdentityApplicationService(repos.identity);
      await expect(service.getUserById('missing-user')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('rejects duplicate emails through the domain service', async () => {
      const service = new IdentityApplicationService(repos.identity);
      await service.registerUser({
        email: 'dup@vedmoulya.dev',
        displayName: 'First',
        passwordHash: 'h',
      });
      await expect(
        service.registerUser({
          email: 'dup@vedmoulya.dev',
          displayName: 'Second',
          passwordHash: 'h',
        }),
      ).rejects.toThrow();
    });

    it('lists users with pagination', async () => {
      const service = new IdentityApplicationService(repos.identity);
      for (let i = 0; i < 3; i += 1) {
        await service.registerUser({
          email: `u${i}@vedmoulya.dev`,
          displayName: `User ${i}`,
          passwordHash: 'h',
        });
      }
      const page = await service.listUsers({ page: 1, limit: 2 });
      expect(page.users).toHaveLength(2);
      expect(page.total).toBe(3);
      expect(page.totalPages).toBe(2);
    });
  });

  describe('memory', () => {
    it('captures, recalls and stats memories', async () => {
      const service = new MemoryApplicationService(repos.memory);

      const created = await service.captureMemory({
        category: 'experience',
        title: 'First trip',
        content: 'Visited the mountains',
        importanceScore: 8,
        confidenceScore: 0.9,
        tags: ['travel'],
      });
      expect(created.success).toBe(true);
      const memoryId = created.data?.id as string;

      const recalled = await service.recallMemory(memoryId, true);
      expect(recalled.success).toBe(true);

      const stats = await service.getStats();
      expect(stats.success).toBe(true);
      expect(stats.data?.total).toBe(1);
    });

    it('returns a graceful error for a missing memory', async () => {
      const service = new MemoryApplicationService(repos.memory);
      const result = await service.getMemory('missing-memory');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('decision', () => {
    it('creates, retrieves, lists and stats decisions', async () => {
      const service = new DecisionApplicationService(repos.decision);

      const created = await service.createDecision({
        title: 'Choose framework',
        description: 'Pick a web framework',
        category: 'strategic',
      });
      expect(created.success).toBe(true);
      const decisionId = created.data?.id as string;

      const fetched = await service.getDecision(decisionId);
      expect(fetched.success).toBe(true);
      expect(fetched.data?.title).toBe('Choose framework');

      // Regression: listDecisions must return real data (search on empty query
      // used to return an empty page with a non-zero total).
      const listed = await service.listDecisions(1, 20);
      expect(listed.success).toBe(true);
      expect(listed.data?.data).toHaveLength(1);
      expect(listed.data?.total).toBe(1);

      const stats = await service.getStats();
      expect(stats.success).toBe(true);
      expect(stats.data?.total).toBe(1);
    });

    it('gracefully reports a missing decision', async () => {
      const service = new DecisionApplicationService(repos.decision);
      const result = await service.getDecision('missing-decision');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('execution', () => {
    it('creates, retrieves, lists and stats plans', async () => {
      const service = new ExecutionApplicationService(repos.execution);

      const created = await service.createPlan({
        title: 'Launch plan',
        description: 'Go to market',
      });
      expect(created.success).toBe(true);
      const planId = created.data?.id as string;

      const fetched = await service.getPlan(planId);
      expect(fetched.success).toBe(true);
      expect(fetched.data?.title).toBe('Launch plan');

      // Regression: listPlans must return real data (search on empty query).
      const listed = await service.listPlans(1, 20);
      expect(listed.success).toBe(true);
      expect(listed.data?.data).toHaveLength(1);
      expect(listed.data?.total).toBe(1);

      const stats = await service.getStats();
      expect(stats.success).toBe(true);
    });
  });

  describe('knowledge', () => {
    it('creates a graph, nodes, searches and traverses', async () => {
      const service = new KnowledgeApplicationService(repos.knowledge);

      const graph = await service.createGraph({ label: 'Career', description: 'Career knowledge' });
      const nodeA = await service.createNode({
        graphId: graph.id,
        category: 'skill',
        label: 'Python',
        description: 'Programming language',
      });
      const nodeB = await service.createNode({
        graphId: graph.id,
        category: 'skill',
        label: 'Data Science',
        description: 'Analytics field',
      });

      const edge = await service.createEdge({
        graphId: graph.id,
        sourceId: nodeA.id,
        targetId: nodeB.id,
        relationshipType: 'relates_to',
      });
      expect(edge.sourceId).toBe(nodeA.id);

      const search = await service.searchNodes('python', { page: 1, limit: 10 });
      expect(search.nodes).toHaveLength(1);

      const traversal = await service.traverse(nodeA.id);
      expect(traversal.path.length).toBeGreaterThanOrEqual(1);
    });

    it('throws NotFoundError for missing graphs and nodes', async () => {
      const service = new KnowledgeApplicationService(repos.knowledge);
      await expect(service.getGraph('missing-graph')).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.getNode('missing-node')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('createInMemoryRepositories', () => {
    it('returns fresh isolated repositories per call', () => {
      const a = createInMemoryRepositories();
      const b = createInMemoryRepositories();
      expect(a.identity).not.toBe(b.identity);
      expect(a.memory).not.toBe(b.memory);
      expect(a.decision).not.toBe(b.decision);
      expect(a.execution).not.toBe(b.execution);
      expect(a.knowledge).not.toBe(b.knowledge);
    });
  });
});
