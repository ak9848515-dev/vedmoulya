// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator Tests: Scheduler
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionGraphBuilderService } from '../services/ExecutionGraphBuilderService.js';
import { ExecutionSchedulerService } from '../services/ExecutionSchedulerService.js';
import {
  createBlogGraphInput,
  createNewsletterGraphInput,
} from '../../catalog/orchestrator-catalog.js';

describe('ExecutionSchedulerService', () => {
  const builder = new ExecutionGraphBuilderService();
  const scheduler = new ExecutionSchedulerService();

  it('produces a topological order covering every node', () => {
    const graph = builder.build(createBlogGraphInput());
    const schedule = scheduler.schedule(graph, 4, 'session_test');
    expect(schedule.order).toHaveLength(graph.nodes.length);
    expect(new Set(schedule.order).size).toBe(graph.nodes.length);
  });

  it('respects dependency ordering (dependencies run first)', () => {
    const graph = builder.build(createBlogGraphInput());
    const schedule = scheduler.schedule(graph, 4, 'session_test');
    const index = new Map(schedule.order.map((id, idx) => [id, idx]));
    for (const node of graph.nodes) {
      for (const dep of node.dependencies) {
        expect(index.get(dep) ?? -1).toBeLessThan(index.get(node.nodeId) ?? -1);
      }
    }
  });

  it('classifies parallel group members as parallel entries', () => {
    const graph = builder.build(createBlogGraphInput());
    const schedule = scheduler.schedule(graph, 4, 'session_test');
    const parallelEntries = schedule.entries.filter((e) => e.kind === 'parallel');
    expect(parallelEntries.length).toBeGreaterThan(0);
    const ids = new Set(parallelEntries.map((e) => e.nodeId));
    expect(ids.has('node_seo')).toBe(true);
    expect(ids.has('node_review')).toBe(true);
  });

  it('limits concurrency to the max', () => {
    const graph = builder.build(createBlogGraphInput());
    const schedule = scheduler.schedule(graph, 2, 'session_test');
    // With maxConcurrency 2, at most 2 entries share the same wave metadata.
    const waves = new Map<number, number>();
    for (const e of schedule.entries) {
      const wave = Number(e.metadata.wave ?? 0);
      waves.set(wave, (waves.get(wave) ?? 0) + 1);
    }
    for (const count of waves.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('schedules a fully sequential graph as sequential entries', () => {
    const graph = builder.build(createNewsletterGraphInput());
    const schedule = scheduler.schedule(graph, 4, 'session_test');
    expect(schedule.entries.every((e) => e.kind === 'sequential')).toBe(true);
  });

  it('stops gracefully on a cyclic graph (defensive)', () => {
    const graph = builder.build(createBlogGraphInput());
    // Introduce a real cycle: research → writing → research (edge + dependency).
    graph.edges.push({
      edgeId: 'edge_cycle',
      from: 'node_writing',
      to: 'node_research',
      type: 'sequential',
      metadata: {},
    });
    const research = graph.nodes.find((n) => n.nodeId === 'node_research');
    research?.dependencies.push('node_writing');
    const schedule = scheduler.schedule(graph, 4, 'session_test');
    expect(schedule.order.length).toBeLessThan(graph.nodes.length);
    expect(schedule.description).toContain('Partial');
  });
});
