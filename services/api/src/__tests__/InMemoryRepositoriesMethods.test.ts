// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: In-Memory Repository Method Coverage
// PR-003B — Coverage Certification Sprint
//
// Direct, hermetic unit tests for every method of the five Map-backed
// in-memory repositories (identity, memory, decision, execution, knowledge).
// These tests exist to certify the services/api coverage gate: the repos are
// the largest uncovered source file and every method is exercised through
// both success and miss/edge paths below. No I/O, no timers, no environment
// dependence — all fixtures are plain in-memory objects.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  InMemoryIdentityRepository,
  InMemoryMemoryRepository,
  InMemoryDecisionRepository,
  InMemoryExecutionRepository,
  InMemoryKnowledgeRepository,
} from '../infrastructure/InMemoryRepositories.js';
import type {
  User,
  Memory,
  Decision,
  ExecutionPlan,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
} from '@vedmoulya/domain';
import type { Email } from '@vedmoulya/domain';

// ── Fixture helpers ──────────────────────────────────────────────────────────
// The repos read entity fields through casts (valueOf/dateOf/entityId), so
// plain fixtures with the exact fields the implementation reads are valid.
// `category`/`state`/`status` are provided both as `{ value }` objects and as
// plain strings to cover the `valueOf` helper's two branches.

const page1 = { page: 1, limit: 10 };
const page2 = { page: 2, limit: 2 };

function makeUser(overrides: Record<string, unknown> = {}): User {
  return {
    id: 'usr-1',
    email: 'a@b.com',
    entityStatus: 'active',
    createdAt: new Date('2024-01-15T00:00:00.000Z'),
    ...overrides,
  } as unknown as User;
}

function makeMemory(overrides: Record<string, unknown> = {}): Memory {
  return {
    id: 'mem-1',
    category: { value: 'experience' },
    state: { value: 'active' },
    title: 'First trip',
    content: 'Visited the mountains',
    createdAt: new Date('2024-02-01T00:00:00.000Z'),
    ...overrides,
  } as unknown as Memory;
}

function makeDecision(overrides: Record<string, unknown> = {}): Decision {
  return {
    id: 'dec-1',
    category: 'strategic',
    status: { value: 'pending' },
    title: 'Choose framework',
    description: 'Pick a web framework',
    ...overrides,
  } as unknown as Decision;
}

function makePlan(overrides: Record<string, unknown> = {}): ExecutionPlan {
  return {
    id: 'plan-1',
    planningLevel: 'tactical',
    status: { value: 'active' },
    title: 'Launch plan',
    description: 'Go to market',
    ...overrides,
  } as unknown as ExecutionPlan;
}

function makeNode(overrides: Record<string, unknown> = {}): KnowledgeNode {
  return {
    id: 'node-1',
    graphId: 'graph-1',
    category: { value: 'skill' },
    label: 'Python',
    description: 'Programming language',
    tags: ['code', 'backend'],
    ...overrides,
  } as unknown as KnowledgeNode;
}

function makeEdge(overrides: Record<string, unknown> = {}): KnowledgeEdge {
  return {
    id: 'edge-1',
    graphId: 'graph-1',
    sourceId: 'node-1',
    targetId: 'node-2',
    type: 'RELATES_TO',
    relationshipCategory: 'association',
    ...overrides,
  } as unknown as KnowledgeEdge;
}

function makeGraph(overrides: Record<string, unknown> = {}): KnowledgeGraph {
  return {
    id: 'graph-1',
    label: 'Career',
    description: 'Career knowledge',
    ...overrides,
  } as unknown as KnowledgeGraph;
}

// ── Identity ─────────────────────────────────────────────────────────────────

describe('InMemoryIdentityRepository', () => {
  it('findById returns the saved user and null for a miss', async () => {
    const repo = new InMemoryIdentityRepository();
    expect(await repo.findById('usr-1')).toBeNull();
    await repo.save(makeUser());
    const found = await repo.findById('usr-1');
    expect(found?.id).toBe('usr-1');
    expect(await repo.findById('missing')).toBeNull();
  });

  it('findByEmail matches the email string and returns null on a miss', async () => {
    const repo = new InMemoryIdentityRepository();
    await repo.save(makeUser());
    const found = await repo.findByEmail('a@b.com' as Email);
    expect(found?.email).toBe('a@b.com');
    expect(await repo.findByEmail('nope@x.com' as Email)).toBeNull();
  });

  it('update upserts and delete removes', async () => {
    const repo = new InMemoryIdentityRepository();
    await repo.save(makeUser());
    await repo.update(makeUser({ displayName: 'Renamed' }));
    const found = await repo.findById('usr-1');
    expect((found as unknown as { displayName?: string }).displayName).toBe('Renamed');
    await repo.delete('usr-1');
    expect(await repo.findById('usr-1')).toBeNull();
    // delete on a miss is a no-op
    await expect(repo.delete('nope')).resolves.toBeUndefined();
  });

  it('exists reflects presence by email', async () => {
    const repo = new InMemoryIdentityRepository();
    await repo.save(makeUser());
    expect(await repo.exists('a@b.com' as Email)).toBe(true);
    expect(await repo.exists('missing@x.com' as Email)).toBe(false);
  });

  it('list paginates users', async () => {
    const repo = new InMemoryIdentityRepository();
    for (let i = 0; i < 5; i += 1) {
      await repo.save(makeUser({ id: `usr-${i}`, email: `u${i}@b.com` }));
    }
    const first = await repo.list(page1);
    expect(first.data).toHaveLength(5);
    expect(first.total).toBe(5);
    expect(first.totalPages).toBe(1);
    const secondPage = await repo.list(page2);
    expect(secondPage.data).toHaveLength(2);
    expect(secondPage.totalPages).toBe(3);
  });

  it('findByCreatedAtRange filters by createdAt and honors bounds', async () => {
    const repo = new InMemoryIdentityRepository();
    await repo.save(makeUser({ id: 'early', createdAt: new Date('2024-02-01') }));
    await repo.save(makeUser({ id: 'late', createdAt: new Date('2024-03-01') }));
    const inRange = await repo.findByCreatedAtRange(
      new Date('2024-01-15'),
      new Date('2024-02-15'),
      page1,
    );
    expect(inRange.data.map((u) => u.id)).toEqual(['early']);
    // Users without a valid createdAt are excluded.
    await repo.save(makeUser({ id: 'nodate', createdAt: 'not-a-date' as unknown as Date }));
    const after = await repo.findByCreatedAtRange(
      new Date('2024-01-01'),
      new Date('2024-12-31'),
      page1,
    );
    expect(after.data.map((u) => u.id)).not.toContain('nodate');
  });

  it('count and countActive behave correctly', async () => {
    const repo = new InMemoryIdentityRepository();
    expect(await repo.count()).toBe(0);
    await repo.save(makeUser({ id: 'a', entityStatus: 'active' }));
    await repo.save(makeUser({ id: 'b', entityStatus: 'suspended' }));
    await repo.save(makeUser({ id: 'c', entityStatus: undefined as unknown as string }));
    expect(await repo.count()).toBe(3);
    expect(await repo.countActive()).toBe(1);
  });
});

// ── Memory ───────────────────────────────────────────────────────────────────

describe('InMemoryMemoryRepository', () => {
  it('findById returns the saved memory and null for a miss', async () => {
    const repo = new InMemoryMemoryRepository();
    expect(await repo.findById('mem-1')).toBeNull();
    await repo.save(makeMemory());
    expect((await repo.findById('mem-1'))?.title).toBe('First trip');
    expect(await repo.findById('missing')).toBeNull();
  });

  it('findByCategory matches on the value object and returns empty on a miss', async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.save(makeMemory());
    const hits = await repo.findByCategory('experience', page1);
    expect(hits.data).toHaveLength(1);
    const miss = await repo.findByCategory('reflection', page1);
    expect(miss.data).toHaveLength(0);
  });

  it('findByState matches on the state value object', async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.save(makeMemory({ id: 'm1', state: { value: 'active' } }));
    await repo.save(makeMemory({ id: 'm2', state: { value: 'archived' } }));
    const active = await repo.findByState('active', page1);
    expect(active.data.map((m) => m.id)).toEqual(['m1']);
    const archived = await repo.findByState('archived', page1);
    expect(archived.data.map((m) => m.id)).toEqual(['m2']);
  });

  it('update upserts and delete removes', async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.save(makeMemory());
    await repo.update(makeMemory({ content: 'Updated content' }));
    expect((await repo.findById('mem-1'))?.content).toBe('Updated content');
    await repo.delete('mem-1');
    expect(await repo.findById('mem-1')).toBeNull();
    await expect(repo.delete('nope')).resolves.toBeUndefined();
  });

  it('exists reflects presence by id', async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.save(makeMemory());
    expect(await repo.exists('mem-1')).toBe(true);
    expect(await repo.exists('missing')).toBe(false);
  });

  it('search matches on title or content case-insensitively', async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.save(makeMemory({ id: 'm1', title: 'TypeScript Notes', content: 'types' }));
    await repo.save(makeMemory({ id: 'm2', title: 'Grocery List', content: 'buy milk' }));
    const byTitle = await repo.search({ query: 'typescript' }, page1);
    expect(byTitle.data.map((m) => m.id)).toEqual(['m1']);
    const byContent = await repo.search({ query: 'MILK' }, page1);
    expect(byContent.data.map((m) => m.id)).toEqual(['m2']);
    const none = await repo.search({ query: 'zzz' }, page1);
    expect(none.data).toHaveLength(0);
  });

  it('getTimeline orders by createdAt ascending and descending', async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.save(makeMemory({ id: 'old', createdAt: new Date('2024-01-01') }));
    await repo.save(makeMemory({ id: 'new', createdAt: new Date('2024-06-01') }));
    await repo.save(makeMemory({ id: 'nodate', createdAt: undefined as unknown as Date }));
    const asc = await repo.getTimeline('asc', page1);
    const ascIds = asc.map((t) => t.memory.id);
    // 'nodate' falls back to epoch (new Date(0)) and sorts first ascending.
    expect(ascIds.indexOf('old')).toBeLessThan(ascIds.indexOf('new'));
    expect(ascIds[ascIds.length - 1]).toBe('new');
    const desc = await repo.getTimeline('desc', page1);
    expect(desc[0]?.memory.id).toBe('new');
  });

  it('returns empty results for the dev-simplification queries', async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.save(makeMemory());
    expect(await repo.findByKnowledgeNodeId('kn-1')).toEqual([]);
    const decaying = await repo.findDecayingMemories(page1);
    expect(decaying.data).toHaveLength(0);
    expect(decaying.total).toBe(0);
    const reinforce = await repo.findMemoriesNeedingReinforcement(page1);
    expect(reinforce.data).toHaveLength(0);
    const related = await repo.findRelatedMemories('experience', page1);
    expect(related.data).toHaveLength(0);
  });

  it('counts memories and aggregates by category/state/linkage', async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.save(
      makeMemory({
        id: 'm1',
        category: { value: 'experience' },
        state: { value: 'active' },
        knowledgeNodeId: 'kn-1',
      }),
    );
    await repo.save(makeMemory({ id: 'm2', category: 'insight', state: { value: 'active' } }));
    await repo.save(makeMemory({ id: 'm3', category: { value: 'experience' }, state: 'archived' }));
    expect(await repo.count()).toBe(3);
    const byCategory = await repo.countByCategory();
    expect(byCategory.experience).toBe(2);
    expect(byCategory.insight).toBe(1);
    const byState = await repo.countByState();
    expect(byState.active).toBe(2);
    expect(byState.archived).toBe(1);
    expect(await repo.countLinked()).toBe(1);
  });
});

// ── Decision ─────────────────────────────────────────────────────────────────

describe('InMemoryDecisionRepository', () => {
  it('findById returns the saved decision and null for a miss', async () => {
    const repo = new InMemoryDecisionRepository();
    expect(await repo.findById('dec-1')).toBeNull();
    await repo.save(makeDecision());
    expect((await repo.findById('dec-1'))?.title).toBe('Choose framework');
    expect(await repo.findById('missing')).toBeNull();
  });

  it('findByCategory and findByStatus filter correctly', async () => {
    const repo = new InMemoryDecisionRepository();
    await repo.save(
      makeDecision({ id: 'd1', category: 'strategic', status: { value: 'pending' } }),
    );
    await repo.save(
      makeDecision({ id: 'd2', category: 'tactical', status: { value: 'completed' } }),
    );
    const strategic = await repo.findByCategory('strategic', page1);
    expect(strategic.data.map((d) => d.id)).toEqual(['d1']);
    const completed = await repo.findByStatus('completed', page1);
    expect(completed.data.map((d) => d.id)).toEqual(['d2']);
    const miss = await repo.findByStatus('evaluating', page1);
    expect(miss.data).toHaveLength(0);
  });

  it('update upserts and delete removes', async () => {
    const repo = new InMemoryDecisionRepository();
    await repo.save(makeDecision());
    await repo.update(makeDecision({ title: 'Renamed decision' }));
    expect((await repo.findById('dec-1'))?.title).toBe('Renamed decision');
    await repo.delete('dec-1');
    expect(await repo.findById('dec-1')).toBeNull();
    await expect(repo.delete('nope')).resolves.toBeUndefined();
  });

  it('exists reflects presence by id', async () => {
    const repo = new InMemoryDecisionRepository();
    await repo.save(makeDecision());
    expect(await repo.exists('dec-1')).toBe(true);
    expect(await repo.exists('missing')).toBe(false);
  });

  it('search filters by query, categories and statuses', async () => {
    const repo = new InMemoryDecisionRepository();
    await repo.save(
      makeDecision({
        id: 'd1',
        title: 'Buy a house',
        description: 'Real estate',
        category: 'strategic',
        status: { value: 'pending' },
      }),
    );
    await repo.save(
      makeDecision({
        id: 'd2',
        title: 'Hire a dev',
        description: 'Recruiting',
        category: 'tactical',
        status: { value: 'completed' },
      }),
    );
    const byQuery = await repo.search({ query: 'house' }, page1);
    expect(byQuery.data.map((d) => d.id)).toEqual(['d1']);
    const byCategory = await repo.search({ query: '', categories: ['tactical'] }, page1);
    expect(byCategory.data.map((d) => d.id)).toEqual(['d2']);
    const byStatus = await repo.search({ query: '', statuses: ['completed'] }, page1);
    expect(byStatus.data.map((d) => d.id)).toEqual(['d2']);
    const none = await repo.search({ query: 'zzz' }, page1);
    expect(none.data).toHaveLength(0);
  });

  it('returns empty results for knowledge/memory linkage queries', async () => {
    const repo = new InMemoryDecisionRepository();
    await repo.save(makeDecision());
    expect(await repo.findByKnowledgeNodeId('kn-1')).toEqual([]);
    expect(await repo.findByMemoryId('mm-1')).toEqual([]);
  });

  it('finds pending and recently completed decisions', async () => {
    const repo = new InMemoryDecisionRepository();
    await repo.save(makeDecision({ id: 'd1', status: { value: 'pending' } }));
    await repo.save(makeDecision({ id: 'd2', status: { value: 'completed' } }));
    await repo.save(makeDecision({ id: 'd3', status: { value: 'completed' } }));
    const pending = await repo.findPendingDecisions(page1);
    expect(pending.data.map((d) => d.id)).toEqual(['d1']);
    const recent = await repo.findRecentlyCompleted(2);
    expect(recent).toHaveLength(2);
    // Miss path: once the pending decision is removed, the query is empty.
    await repo.delete('d1');
    expect((await repo.findPendingDecisions(page1)).data).toHaveLength(0);
  });

  it('counts decisions and aggregates by category/status/linkage', async () => {
    const repo = new InMemoryDecisionRepository();
    await repo.save(
      makeDecision({
        id: 'd1',
        category: 'strategic',
        status: { value: 'pending' },
        knowledgeNodeId: 'kn-1',
      }),
    );
    await repo.save(
      makeDecision({
        id: 'd2',
        category: 'tactical',
        status: { value: 'completed' },
        memoryId: 'mm-1',
      }),
    );
    await repo.save(
      makeDecision({ id: 'd3', category: 'strategic', status: { value: 'completed' } }),
    );
    expect(await repo.count()).toBe(3);
    const byCategory = await repo.countByCategory();
    expect(byCategory.strategic).toBe(2);
    expect(byCategory.tactical).toBe(1);
    const byStatus = await repo.countByStatus();
    expect(byStatus.completed).toBe(2);
    expect(byStatus.pending).toBe(1);
    expect(await repo.countLinked()).toBe(2);
  });
});

// ── Execution ────────────────────────────────────────────────────────────────

describe('InMemoryExecutionRepository', () => {
  it('findById returns the saved plan and null for a miss', async () => {
    const repo = new InMemoryExecutionRepository();
    expect(await repo.findById('plan-1')).toBeNull();
    await repo.save(makePlan());
    expect((await repo.findById('plan-1'))?.title).toBe('Launch plan');
    expect(await repo.findById('missing')).toBeNull();
  });

  it('findByPlanningLevel and findByStatus filter correctly', async () => {
    const repo = new InMemoryExecutionRepository();
    await repo.save(makePlan({ id: 'p1', planningLevel: 'tactical', status: { value: 'active' } }));
    await repo.save(
      makePlan({ id: 'p2', planningLevel: 'strategic', status: { value: 'completed' } }),
    );
    const tactical = await repo.findByPlanningLevel('tactical', page1);
    expect(tactical.data.map((p) => p.id)).toEqual(['p1']);
    const completed = await repo.findByStatus('completed', page1);
    expect(completed.data.map((p) => p.id)).toEqual(['p2']);
    const miss = await repo.findByStatus('pending', page1);
    expect(miss.data).toHaveLength(0);
  });

  it('update upserts and delete removes', async () => {
    const repo = new InMemoryExecutionRepository();
    await repo.save(makePlan());
    await repo.update(makePlan({ title: 'Renamed plan' }));
    expect((await repo.findById('plan-1'))?.title).toBe('Renamed plan');
    await repo.delete('plan-1');
    expect(await repo.findById('plan-1')).toBeNull();
    await expect(repo.delete('nope')).resolves.toBeUndefined();
  });

  it('exists reflects presence by id', async () => {
    const repo = new InMemoryExecutionRepository();
    await repo.save(makePlan());
    expect(await repo.exists('plan-1')).toBe(true);
    expect(await repo.exists('missing')).toBe(false);
  });

  it('search filters by query, statuses and planning levels', async () => {
    const repo = new InMemoryExecutionRepository();
    await repo.save(
      makePlan({
        id: 'p1',
        title: 'Build website',
        description: 'Frontend',
        status: { value: 'active' },
        planningLevel: 'tactical',
      }),
    );
    await repo.save(
      makePlan({
        id: 'p2',
        title: 'Annual planning',
        description: 'Strategy',
        status: { value: 'completed' },
        planningLevel: 'strategic',
      }),
    );
    const byQuery = await repo.search({ query: 'website' }, page1);
    expect(byQuery.data.map((p) => p.id)).toEqual(['p1']);
    const byStatus = await repo.search({ query: '', statuses: ['completed'] }, page1);
    expect(byStatus.data.map((p) => p.id)).toEqual(['p2']);
    const byLevel = await repo.search({ query: '', planningLevels: ['strategic'] }, page1);
    expect(byLevel.data.map((p) => p.id)).toEqual(['p2']);
    const none = await repo.search({ query: 'zzz' }, page1);
    expect(none.data).toHaveLength(0);
  });

  it('returns empty results for goal/decision linkage queries', async () => {
    const repo = new InMemoryExecutionRepository();
    await repo.save(makePlan());
    expect(await repo.findByGoalId('goal-1')).toEqual([]);
    expect(await repo.findByDecisionId('dec-1')).toEqual([]);
  });

  it('finds active and recently completed plans', async () => {
    const repo = new InMemoryExecutionRepository();
    await repo.save(makePlan({ id: 'p1', status: { value: 'active' } }));
    await repo.save(makePlan({ id: 'p2', status: { value: 'completed' } }));
    await repo.save(makePlan({ id: 'p3', status: { value: 'completed' } }));
    const active = await repo.findActivePlans(page1);
    expect(active.data.map((p) => p.id)).toEqual(['p1']);
    expect(await repo.findRecentlyCompleted(2)).toHaveLength(2);
  });

  it('counts plans and aggregates by level/status/active/overdue', async () => {
    const repo = new InMemoryExecutionRepository();
    await repo.save(
      makePlan({
        id: 'p1',
        planningLevel: 'tactical',
        status: { value: 'active' },
        dueDate: new Date('2020-01-01'),
      }),
    );
    await repo.save(
      makePlan({
        id: 'p2',
        planningLevel: 'strategic',
        status: { value: 'completed' },
        dueDate: new Date('2999-01-01'),
      }),
    );
    await repo.save(
      makePlan({ id: 'p3', planningLevel: 'tactical', status: { value: 'pending' } }),
    );
    expect(await repo.count()).toBe(3);
    const byLevel = await repo.countByPlanningLevel();
    expect(byLevel.tactical).toBe(2);
    expect(byLevel.strategic).toBe(1);
    const byStatus = await repo.countByStatus();
    expect(byStatus.active).toBe(1);
    expect(byStatus.completed).toBe(1);
    expect(byStatus.pending).toBe(1);
    expect(await repo.countActive()).toBe(1);
    expect(await repo.countOverdue()).toBe(1);
  });
});

// ── Knowledge Graph ──────────────────────────────────────────────────────────

describe('InMemoryKnowledgeRepository', () => {
  it('node CRUD and existence checks', async () => {
    const repo = new InMemoryKnowledgeRepository();
    expect(await repo.findNodeById('node-1')).toBeNull();
    await repo.saveNode(makeNode());
    expect((await repo.findNodeById('node-1'))?.label).toBe('Python');
    expect(await repo.nodeExists('node-1')).toBe(true);
    expect(await repo.nodeExists('missing')).toBe(false);
    await repo.updateNode(makeNode({ label: 'Python 3' }));
    expect((await repo.findNodeById('node-1'))?.label).toBe('Python 3');
    await repo.deleteNode('node-1');
    expect(await repo.findNodeById('node-1')).toBeNull();
    await expect(repo.deleteNode('nope')).resolves.toBeUndefined();
  });

  it('finds nodes by category, label and graph', async () => {
    const repo = new InMemoryKnowledgeRepository();
    await repo.saveNode(
      makeNode({ id: 'n1', graphId: 'graph-1', category: { value: 'skill' }, label: 'Python' }),
    );
    await repo.saveNode(
      makeNode({ id: 'n2', graphId: 'graph-1', category: 'knowledge', label: 'Rust' }),
    );
    await repo.saveNode(
      makeNode({ id: 'n3', graphId: 'graph-2', category: { value: 'skill' }, label: 'Go' }),
    );
    const skills = await repo.findNodesByCategory('skill', page1);
    expect(skills.data.map((n) => n.id).sort()).toEqual(['n1', 'n3']);
    const byLabel = await repo.findNodesByLabel('Py', page1);
    expect(byLabel.data.map((n) => n.id)).toEqual(['n1']);
    const byGraph = await repo.findNodesByGraph('graph-2', page1);
    expect(byGraph.data.map((n) => n.id)).toEqual(['n3']);
  });

  it('edge CRUD, existence, and lookup queries', async () => {
    const repo = new InMemoryKnowledgeRepository();
    expect(await repo.findEdgeById('edge-1')).toBeNull();
    await repo.saveEdge(makeEdge());
    expect((await repo.findEdgeById('edge-1'))?.type).toBe('RELATES_TO');
    expect(await repo.edgeExists('edge-1')).toBe(true);
    expect(await repo.edgeExists('missing')).toBe(false);

    const between = await repo.findEdgesBetween('node-1', 'node-2');
    expect(between).toHaveLength(1);
    const notBetween = await repo.findEdgesBetween('node-1', 'node-9');
    expect(notBetween).toHaveLength(0);

    const forNode = await repo.findEdgesForNode('node-2');
    expect(forNode).toHaveLength(1);
    const forMiss = await repo.findEdgesForNode('node-9');
    expect(forMiss).toHaveLength(0);

    const byType = await repo.findEdgesByType('RELATES_TO', page1);
    expect(byType.data).toHaveLength(1);
    const byCategory = await repo.findEdgesByCategory('association', page1);
    expect(byCategory.data).toHaveLength(1);

    await repo.updateEdge(makeEdge({ type: 'DEPENDS_ON' }));
    expect((await repo.findEdgeById('edge-1'))?.type).toBe('DEPENDS_ON');
    await repo.deleteEdge('edge-1');
    expect(await repo.findEdgeById('edge-1')).toBeNull();
    await expect(repo.deleteEdge('nope')).resolves.toBeUndefined();
  });

  it('graph CRUD and listing', async () => {
    const repo = new InMemoryKnowledgeRepository();
    expect(await repo.findGraphById('graph-1')).toBeNull();
    await repo.saveGraph(makeGraph());
    expect((await repo.findGraphById('graph-1'))?.label).toBe('Career');
    const all = await repo.findAllGraphs(page1);
    expect(all.data).toHaveLength(1);
    expect(all.total).toBe(1);
    await repo.updateGraph(makeGraph({ label: 'Career 2.0' }));
    expect((await repo.findGraphById('graph-1'))?.label).toBe('Career 2.0');
    await repo.deleteGraph('graph-1');
    expect(await repo.findGraphById('graph-1')).toBeNull();
    await expect(repo.deleteGraph('nope')).resolves.toBeUndefined();
  });

  it('searches nodes by text and by tags', async () => {
    const repo = new InMemoryKnowledgeRepository();
    await repo.saveNode(
      makeNode({ id: 'n1', label: 'Python', description: 'Programming language', tags: ['code'] }),
    );
    await repo.saveNode(
      makeNode({ id: 'n2', label: 'Data Science', description: 'Analytics', tags: ['data'] }),
    );
    const byLabel = await repo.searchNodes('python', page1);
    expect(byLabel.data.map((n) => n.id)).toEqual(['n1']);
    const byDesc = await repo.searchNodes('analytics', page1);
    expect(byDesc.data.map((n) => n.id)).toEqual(['n2']);
    const none = await repo.searchNodes('zzz', page1);
    expect(none.data).toHaveLength(0);
    const byTag = await repo.searchNodesByTags(['data'], page1);
    expect(byTag.data.map((n) => n.id)).toEqual(['n2']);
    const noTag = await repo.searchNodesByTags(['none'], page1);
    expect(noTag.data).toHaveLength(0);
  });

  it('counts nodes, edges and aggregates by category', async () => {
    const repo = new InMemoryKnowledgeRepository();
    await repo.saveNode(makeNode({ id: 'n1', graphId: 'graph-1', category: { value: 'skill' } }));
    await repo.saveNode(makeNode({ id: 'n2', graphId: 'graph-1', category: 'skill' }));
    await repo.saveNode(makeNode({ id: 'n3', graphId: 'graph-2', category: { value: 'goal' } }));
    await repo.saveEdge(makeEdge({ id: 'e1', graphId: 'graph-1' }));
    await repo.saveEdge(makeEdge({ id: 'e2', graphId: 'graph-2' }));
    expect(await repo.countNodes('graph-1')).toBe(2);
    expect(await repo.countNodes('graph-9')).toBe(0);
    expect(await repo.countEdges('graph-1')).toBe(1);
    expect(await repo.countEdges('graph-2')).toBe(1);
    const byCategory = await repo.countNodesByCategory('graph-1');
    expect(byCategory.skill).toBe(2);
    expect(byCategory.goal).toBeUndefined();
    expect(await repo.countGraphs()).toBe(0);
    await repo.saveGraph(makeGraph());
    expect(await repo.countGraphs()).toBe(1);
  });
});
