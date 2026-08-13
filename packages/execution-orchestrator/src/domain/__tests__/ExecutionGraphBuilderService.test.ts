// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator Tests: Graph Builder
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionGraphBuilderService } from '../services/ExecutionGraphBuilderService.js';
import { ExecutionGraphValidatorService } from '../services/ExecutionGraphValidatorService.js';
import { createBlogGraphInput } from '../../catalog/orchestrator-catalog.js';

describe('ExecutionGraphBuilderService', () => {
  const builder = new ExecutionGraphBuilderService();

  it('builds a graph with nodes, edges, stages, and checkpoints', () => {
    const graph = builder.build(createBlogGraphInput());
    expect(graph.graphId).toMatch(/^graph_/);
    expect(graph.strategyId).toBe('strategy_blog_seed');
    expect(graph.nodes).toHaveLength(5);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.stages).toHaveLength(5);
    expect(graph.checkpoints).toHaveLength(5);
    expect(graph.criticalPath.length).toBeGreaterThan(0);
  });

  it('wires sequential edges and dependencies', () => {
    const graph = builder.build(createBlogGraphInput());
    const sequential = graph.edges.filter((e) => e.type === 'sequential');
    expect(sequential.length).toBeGreaterThanOrEqual(1);
    // Research must be a dependency of Writing.
    const writing = graph.nodes.find((n) => n.label === 'Writing');
    expect(writing?.dependencies).toContain('node_research');
  });

  it('creates a merge edge after a parallel group', () => {
    const graph = builder.build(createBlogGraphInput());
    expect(graph.edges.some((e) => e.type === 'merge')).toBe(true);
    expect(graph.parallelGroups.length).toBeGreaterThan(0);
    expect(graph.parallelGroups[0]).toContain('node_seo');
  });

  it('produces a valid DAG', () => {
    const graph = builder.build(createBlogGraphInput());
    const validator = new ExecutionGraphValidatorService();
    expect(validator.isDag(graph)).toBe(true);
    expect(validator.findCycle(graph)).toHaveLength(0);
  });

  it('scales timeouts and budgets across nodes', () => {
    const graph = builder.build(createBlogGraphInput());
    for (const node of graph.nodes) {
      expect(node.timeoutMs).toBeGreaterThan(0);
      expect(node.budget.expectedTokens).toBeGreaterThan(0);
      expect(node.budget.maxCostUsd).toBeGreaterThan(0);
    }
    const totalTokens = graph.nodes.reduce((s, n) => s + n.budget.expectedTokens, 0);
    expect(totalTokens).toBeLessThanOrEqual(8000);
  });

  it('prioritizes earlier nodes higher within the base priority band', () => {
    const graph = builder.build(createBlogGraphInput());
    expect(graph.nodes[0]?.priority).toBeGreaterThanOrEqual(graph.nodes[1]?.priority ?? 0);
  });
});
