// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — WorldGraph tests (SPRINT-032)
// Bounded, owner-scoped, evidence-carrying graph over the existing estate:
//   • observations without provenance are REFUSED (no fabricated facts)
//   • stable-key dedup (re-observing the same external entity upserts)
//   • relation shapes are a closed vocabulary (structural)
//   • FIFO bounds per owner (no unbounded sinks)
//   • bounded + paginated queries (no whole-graph loads)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  WORLD_ENTITY_LIMIT_PER_OWNER,
  WORLD_RELATION_LIMIT_PER_OWNER,
  WorldGraph,
  relationShapeAllowed,
  type WorldEntityStoreLike,
  type WorldRelationStoreLike,
} from '../domain/WorldGraph.js';
import { InMemoryWorldStores } from '../infrastructure/InMemoryWorldStores.js';
import type { WorldEntity, WorldRelation } from '../types/world-types.js';

/** Non-evicting stub stores — used to exercise the GRAPH's own FIFO eviction
 *  (the real in-memory stores also evict on save, so the graph guard is
 *  unreachable with them). */
function makeStubStores(): { entities: WorldEntityStoreLike; relations: WorldRelationStoreLike } {
  const entityMap = new Map<string, WorldEntity>();
  const relationMap = new Map<string, WorldRelation>();
  return {
    entities: {
      save: (e): void => {
        entityMap.set(`${e.ownerId}:${e.id}`, e);
      },
      get: (ownerId, id): WorldEntity | undefined => entityMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): WorldEntity | undefined =>
        [...entityMap.values()].find((e) => e.ownerId === ownerId && e.stableKey === stableKey),
      list: (ownerId): WorldEntity[] =>
        [...entityMap.values()].filter((e) => e.ownerId === ownerId),
      listByType: (ownerId, type): WorldEntity[] =>
        [...entityMap.values()].filter((e) => e.ownerId === ownerId && e.type === type),
      count: (ownerId): number =>
        [...entityMap.values()].filter((e) => e.ownerId === ownerId).length,
      countByType: (ownerId): { type: string; count: number }[] => {
        const counts = new Map<string, number>();
        for (const e of entityMap.values()) {
          if (e.ownerId !== ownerId) continue;
          counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
        }
        return [...counts.entries()].map(([type, count]) => ({ type, count }));
      },
      remove: (ownerId, id): void => {
        entityMap.delete(`${ownerId}:${id}`);
      },
    },
    relations: {
      save: (r): void => {
        relationMap.set(`${r.ownerId}:${r.id}`, r);
      },
      getByKey: (ownerId, stableKey): WorldRelation | undefined =>
        [...relationMap.values()].find(
          (x) =>
            x.ownerId === ownerId && `${x.ownerId}:${x.type}:${x.fromId}:${x.toId}` === stableKey,
        ),
      list: (ownerId): WorldRelation[] =>
        [...relationMap.values()].filter((x) => x.ownerId === ownerId),
      count: (ownerId): number =>
        [...relationMap.values()].filter((x) => x.ownerId === ownerId).length,
      remove: (ownerId, id): void => {
        relationMap.delete(`${ownerId}:${id}`);
      },
    },
  };
}

const now = (): string => '2026-08-14T10:00:00.000Z';

function makeGraph(): { graph: WorldGraph; stores: InMemoryWorldStores } {
  const stores = new InMemoryWorldStores();
  const graph = new WorldGraph({ entities: stores.entities, relations: stores.relations }, now);
  return { graph, stores };
}

describe('WorldGraph', () => {
  it('refuses an observation without provenance (no fabricated facts)', () => {
    const { graph } = makeGraph();
    const result = graph.observe({
      ownerId: 'u1',
      type: 'opportunity',
      label: 'Make a YouTube video',
      evidence: ['brain-opportunity'],
      provenance: { source: 'brain-opportunity', status: 'VERIFIED', observedAt: now() },
    });
    expect(result.success).toBe(true);

    const noProvenance = graph.observe({
      ownerId: 'u1',
      type: 'opportunity',
      label: 'Fabricated fact',
      evidence: [],
      provenance: { source: 'brain-opportunity', status: 'UNKNOWN', observedAt: now() },
    });
    expect(noProvenance.success).toBe(false);
  });

  it('refuses an observation without evidence', () => {
    const { graph } = makeGraph();
    const result = graph.observe({
      ownerId: 'u1',
      type: 'opportunity',
      label: 'No evidence',
      evidence: [],
      provenance: { source: 'brain-opportunity', status: 'VERIFIED', observedAt: now() },
    });
    expect(result.success).toBe(false);
  });

  it('stable-key dedup: re-observing the same external entity upserts, never duplicates', () => {
    const { graph, stores } = makeGraph();
    const first = graph.observe({
      ownerId: 'u1',
      type: 'opportunity',
      label: 'YouTube automation',
      externalId: 'opp-1',
      evidence: ['brain-opportunity opp-1'],
      provenance: { source: 'brain-opportunity', status: 'VERIFIED', observedAt: now() },
    });
    const second = graph.observe({
      ownerId: 'u1',
      type: 'opportunity',
      label: 'YouTube automation',
      externalId: 'opp-1',
      evidence: ['brain-opportunity opp-1 updated'],
      provenance: { source: 'brain-opportunity', status: 'VERIFIED', observedAt: now() },
    });
    expect(first.success && second.success).toBe(true);
    if (first.success && second.success) {
      expect(second.data.id).toBe(first.data.id); // upserted, same id
    }
    expect(stores.entities.count('u1')).toBe(1);
  });

  it('owner isolation: entities and relations are never shared across owners', () => {
    const { graph, stores } = makeGraph();
    for (const owner of ['u1', 'u2']) {
      graph.observe({
        ownerId: owner,
        type: 'task',
        label: `task-${owner}`,
        externalId: `t-${owner}`,
        evidence: ['brain-task'],
        provenance: { source: 'brain-task', status: 'VERIFIED', observedAt: now() },
      });
    }
    expect(stores.entities.count('u1')).toBe(1);
    expect(stores.entities.count('u2')).toBe(1);
    const u1 = graph.listEntities('u1');
    expect(u1.success && u1.data.total).toBe(1);
    if (u1.success) expect(u1.data.entities[0]?.label).toBe('task-u1');
  });

  it('links only EXISTING same-owner entities with an allowed shape', () => {
    const { graph } = makeGraph();
    const user = graph.observe({
      ownerId: 'u1',
      type: 'user',
      label: 'The owner',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    const goal = graph.observe({
      ownerId: 'u1',
      type: 'goal',
      label: 'Launch a service',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    expect(user.success && goal.success).toBe(true);
    if (!user.success || !goal.success) return;

    const linked = graph.link({
      ownerId: 'u1',
      type: 'has_goal',
      fromId: user.data.id,
      toId: goal.data.id,
    });
    expect(linked.success).toBe(true);

    // Wrong shape: user → goal with 'contains_task' is refused.
    const wrongShape = graph.link({
      ownerId: 'u1',
      type: 'contains_task',
      fromId: user.data.id,
      toId: goal.data.id,
    });
    expect(wrongShape.success).toBe(false);

    // Unknown entities refused.
    const unknown = graph.link({
      ownerId: 'u1',
      type: 'has_goal',
      fromId: 'nope',
      toId: goal.data.id,
    });
    expect(unknown.success).toBe(false);
  });

  it('linking is idempotent — the same edge never duplicates', () => {
    const { graph, stores } = makeGraph();
    const user = graph.observe({
      ownerId: 'u1',
      type: 'user',
      label: 'Owner',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    const goal = graph.observe({
      ownerId: 'u1',
      type: 'goal',
      label: 'Goal',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    if (!user.success || !goal.success) return;
    graph.link({ ownerId: 'u1', type: 'has_goal', fromId: user.data.id, toId: goal.data.id });
    graph.link({ ownerId: 'u1', type: 'has_goal', fromId: user.data.id, toId: goal.data.id });
    expect(stores.relations.count('u1')).toBe(1);
  });

  it('relation shapes are a closed vocabulary (structural)', () => {
    expect(relationShapeAllowed('has_goal', 'user', 'goal')).toBe(true);
    expect(relationShapeAllowed('served_by_provider', 'capability', 'provider')).toBe(true);
    expect(relationShapeAllowed('has_goal', 'task', 'provider')).toBe(false);
    expect(relationShapeAllowed('evidence_of', 'signal', 'opportunity')).toBe(true);
  });

  it('the graph is BOUNDED per owner (FIFO eviction — never an unbounded sink)', () => {
    const { graph, stores } = makeGraph();
    for (let i = 0; i < WORLD_ENTITY_LIMIT_PER_OWNER + 50; i += 1) {
      graph.observe({
        ownerId: 'u1',
        type: 'task',
        label: `task-${i}`,
        externalId: `t-${i}`,
        evidence: ['brain-task'],
        provenance: { source: 'brain-task', status: 'VERIFIED', observedAt: now() },
      });
    }
    expect(stores.entities.count('u1')).toBeLessThanOrEqual(WORLD_ENTITY_LIMIT_PER_OWNER);

    // Relations bounded too.
    const user = graph.observe({
      ownerId: 'u1',
      type: 'user',
      label: 'Owner',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    if (!user.success) return;
    for (let i = 0; i < WORLD_RELATION_LIMIT_PER_OWNER + 20; i += 1) {
      const goal = graph.observe({
        ownerId: 'u1',
        type: 'goal',
        label: `goal-${i}`,
        externalId: `g-${i}`,
        evidence: ['user-statement'],
        provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
      });
      if (goal.success) {
        graph.link({ ownerId: 'u1', type: 'has_goal', fromId: user.data.id, toId: goal.data.id });
      }
    }
    expect(stores.relations.count('u1')).toBeLessThanOrEqual(WORLD_RELATION_LIMIT_PER_OWNER);
  });

  it('queries are bounded + paginated (never loads the whole graph)', () => {
    const { graph } = makeGraph();
    for (let i = 0; i < 25; i += 1) {
      graph.observe({
        ownerId: 'u1',
        type: 'task',
        label: `task-${i}`,
        externalId: `t-${i}`,
        evidence: ['brain-task'],
        provenance: { source: 'brain-task', status: 'VERIFIED', observedAt: now() },
      });
    }
    const page1 = graph.listEntities('u1', { limit: 10, offset: 0 });
    const page2 = graph.listEntities('u1', { limit: 10, offset: 10 });
    expect(page1.success && page1.data.entities.length).toBe(10);
    expect(page2.success && page2.data.entities.length).toBe(10);
    if (page1.success && page2.success) {
      expect(page1.data.total).toBe(25);
      expect(page1.data.entities[0]?.id).not.toBe(page2.data.entities[0]?.id);
    }
    // Type filter.
    const goals = graph.listEntities('u1', { type: 'goal' });
    expect(goals.success && goals.data.total).toBe(0);
  });

  it('the world view is a bounded slice, never the full graph', () => {
    const { graph } = makeGraph();
    for (let i = 0; i < 30; i += 1) {
      graph.observe({
        ownerId: 'u1',
        type: 'task',
        label: `task-${i}`,
        externalId: `t-${i}`,
        evidence: ['brain-task'],
        provenance: { source: 'brain-task', status: 'VERIFIED', observedAt: now() },
      });
    }
    const view = graph.view('u1', { entityLimit: 5 });
    expect(view.entities.length).toBe(5);
    expect(view.totalEntities).toBe(30);
  });

  it('refuses an observation whose provenance source is EMPTY (no fabricated facts)', () => {
    const { graph } = makeGraph();
    const result = graph.observe({
      ownerId: 'u1',
      type: 'opportunity',
      label: 'No source',
      evidence: ['brain-opportunity'],
      provenance: { source: '', status: 'VERIFIED', observedAt: now() },
    });
    expect(result.success).toBe(false);
  });

  it('uses the real clock when no clock is injected', () => {
    const stores = new InMemoryWorldStores();
    const graph = new WorldGraph({ entities: stores.entities, relations: stores.relations });
    const before = Date.now();
    const result = graph.observe({
      ownerId: 'u1',
      type: 'task',
      label: 'Timestamped',
      evidence: ['brain-task'],
      provenance: {
        source: 'brain-task',
        status: 'VERIFIED',
        observedAt: new Date().toISOString(),
      },
    });
    const after = Date.now();
    expect(result.success).toBe(true);
    if (result.success) {
      const ts = Date.parse(result.data.createdAt);
      expect(ts).toBeGreaterThanOrEqual(before - 1000);
      expect(ts).toBeLessThanOrEqual(after + 1000);
    }
  });

  it('refuses a link whose TO entity does not exist (from exists, to missing)', () => {
    const { graph } = makeGraph();
    const user = graph.observe({
      ownerId: 'u1',
      type: 'user',
      label: 'Owner',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    if (!user.success) return;
    const missingTo = graph.link({
      ownerId: 'u1',
      type: 'has_goal',
      fromId: user.data.id,
      toId: 'ghost-goal',
    });
    expect(missingTo.success).toBe(false);
  });

  it('listRelations supports type filtering + pagination', () => {
    const { graph } = makeGraph();
    const user = graph.observe({
      ownerId: 'u1',
      type: 'user',
      label: 'Owner',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    if (!user.success) return;
    for (let i = 0; i < 5; i += 1) {
      const goal = graph.observe({
        ownerId: 'u1',
        type: 'goal',
        label: `goal-${i}`,
        externalId: `g-${i}`,
        evidence: ['user-statement'],
        provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
      });
      if (goal.success) {
        graph.link({ ownerId: 'u1', type: 'has_goal', fromId: user.data.id, toId: goal.data.id });
      }
    }
    const all = graph.listRelations('u1');
    const goals = graph.listRelations('u1', { type: 'has_goal' });
    expect(all.success && all.data.total).toBe(5);
    expect(goals.success && goals.data.total).toBe(5);
    const page = graph.listRelations('u1', { type: 'has_goal', limit: 2, offset: 1 });
    expect(page.success && page.data.relations.length).toBe(2);
  });

  it('the graph ITSELF evicts FIFO when the store does not (oldest entities + dangling edges)', () => {
    const stores = makeStubStores();
    const graph = new WorldGraph(stores, now);
    // A workflow entity created FIRST is the oldest — it will be evicted once
    // the per-owner bound is exceeded by later tasks.
    const workflow = graph.observe({
      ownerId: 'u1',
      type: 'workflow',
      label: 'Pipeline',
      externalId: 'wf-1',
      evidence: ['brain-workflow'],
      provenance: { source: 'brain-workflow', status: 'VERIFIED', observedAt: now() },
    });
    if (!workflow.success) return;
    // Link the workflow to every task so the eviction must also drop the
    // now-dangling edges.
    for (let i = 0; i < WORLD_ENTITY_LIMIT_PER_OWNER + 20; i += 1) {
      const task = graph.observe({
        ownerId: 'u1',
        type: 'task',
        label: `task-${i}`,
        externalId: `t-${i}`,
        evidence: ['brain-task'],
        provenance: { source: 'brain-task', status: 'VERIFIED', observedAt: now() },
      });
      if (task.success) {
        graph.link({
          ownerId: 'u1',
          type: 'decomposes_into',
          fromId: workflow.data.id,
          toId: task.data.id,
        });
      }
    }
    // The workflow is the oldest entity → evicted, and its edges are gone.
    expect(stores.entities.getByKey('u1', 'u1:workflow:wf-1')).toBeUndefined();
    expect(stores.entities.count('u1')).toBe(WORLD_ENTITY_LIMIT_PER_OWNER);
    expect(stores.relations.count('u1')).toBe(0); // dangling edges removed
  });

  it('dangling-edge cleanup leaves relations between LIVE entities untouched', () => {
    const stores = makeStubStores();
    const graph = new WorldGraph(stores, now);
    // A workflow and a task that both stay under the bound: their edge lives.
    const workflow = graph.observe({
      ownerId: 'u1',
      type: 'workflow',
      label: 'Pipeline',
      externalId: 'wf-live',
      evidence: ['brain-workflow'],
      provenance: { source: 'brain-workflow', status: 'VERIFIED', observedAt: now() },
    });
    const task = graph.observe({
      ownerId: 'u1',
      type: 'task',
      label: 'Live task',
      externalId: 't-live',
      evidence: ['brain-task'],
      provenance: { source: 'brain-task', status: 'VERIFIED', observedAt: now() },
    });
    if (!workflow.success || !task.success) return;
    graph.link({
      ownerId: 'u1',
      type: 'decomposes_into',
      fromId: workflow.data.id,
      toId: task.data.id,
    });
    expect(stores.relations.count('u1')).toBe(1);
    // Evict an unrelated OLD entity; the live edge must survive.
    graph.observe({
      ownerId: 'u1',
      type: 'task',
      label: 'Old evictable task',
      externalId: 't-old',
      evidence: ['brain-task'],
      provenance: { source: 'brain-task', status: 'VERIFIED', observedAt: now() },
    });
    graph.observe({
      ownerId: 'u1',
      type: 'task',
      label: 'Old evictable task 2',
      externalId: 't-old-2',
      evidence: ['brain-task'],
      provenance: { source: 'brain-task', status: 'VERIFIED', observedAt: now() },
    });
    expect(stores.relations.count('u1')).toBe(1); // live edge kept
    expect(stores.entities.count('u1')).toBe(4);
  });

  it('the graph ITSELF bounds relations FIFO when the store does not', () => {
    const stores = makeStubStores();
    const graph = new WorldGraph(stores, now);
    // Seed the relation store directly (the stub never evicts) so the GRAPH's
    // own boundRelations guard has to do the FIFO work on the next link.
    for (let i = 0; i < WORLD_RELATION_LIMIT_PER_OWNER + 20; i += 1) {
      stores.relations.save({
        id: `wr-${i}`,
        ownerId: 'u1',
        type: 'has_goal',
        fromType: 'user',
        fromId: 'seed-user',
        toType: 'goal',
        toId: `seed-goal-${i}`,
        createdAt: now(),
      });
    }
    expect(stores.relations.count('u1')).toBe(WORLD_RELATION_LIMIT_PER_OWNER + 20);
    // One more link triggers the graph's boundRelations eviction → 500.
    const user = graph.observe({
      ownerId: 'u1',
      type: 'user',
      label: 'Owner',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    const goal = graph.observe({
      ownerId: 'u1',
      type: 'goal',
      label: 'New goal',
      externalId: 'g-new',
      evidence: ['user-statement'],
      provenance: { source: 'user-statement', status: 'VERIFIED', observedAt: now() },
    });
    if (!user.success || !goal.success) return;
    graph.link({ ownerId: 'u1', type: 'has_goal', fromId: user.data.id, toId: goal.data.id });
    expect(stores.relations.count('u1')).toBe(WORLD_RELATION_LIMIT_PER_OWNER);
  });

  it('listRelations returns an empty page beyond the end (offset past total)', () => {
    const { graph } = makeGraph();
    const past = graph.listRelations('u1', { limit: 5, offset: 999 });
    expect(past.success && past.data.relations).toEqual([]);
    expect(past.success && past.data.total).toBe(0);
  });
});
