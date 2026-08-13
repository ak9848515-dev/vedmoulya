// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator Tests: Graph Validator
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionGraphBuilderService } from '../services/ExecutionGraphBuilderService.js';
import { ExecutionGraphValidatorService } from '../services/ExecutionGraphValidatorService.js';
import { createBlogGraphInput } from '../../catalog/orchestrator-catalog.js';
import type { ExecutionGraph } from '../../types/orchestrator-types.js';

describe('ExecutionGraphValidatorService', () => {
  const builder = new ExecutionGraphBuilderService();
  const validator = new ExecutionGraphValidatorService();

  it('validates a healthy built graph', () => {
    const graph = builder.build(createBlogGraphInput());
    const validation = validator.validate(graph);
    expect(validation.passed).toBe(true);
    expect(validation.checks.length).toBe(9);
    expect(validation.summary).toContain('valid');
  });

  it('detects a cycle in a mutated graph', () => {
    const graph = builder.build(createBlogGraphInput());
    // Introduce a real cycle: research → writing → research.
    graph.edges.push({
      edgeId: 'edge_cycle',
      from: 'node_writing',
      to: 'node_research',
      type: 'sequential',
      metadata: {},
    });
    expect(validator.isDag(graph)).toBe(false);
    const cycle = validator.findCycle(graph);
    expect(cycle.length).toBeGreaterThan(0);
    expect(validator.validate(graph).passed).toBe(false);
  });

  it('flags edges referencing unknown nodes', () => {
    const graph = builder.build(createBlogGraphInput());
    graph.edges.push({
      edgeId: 'edge_bad',
      from: 'node_ghost',
      to: 'node_research',
      type: 'sequential',
      metadata: {},
    });
    const validation = validator.validate(graph);
    const edgeCheck = validation.checks.find((c) => c.check === 'edges-reference-nodes');
    expect(edgeCheck?.passed).toBe(false);
    expect(validation.passed).toBe(false);
  });

  it('flags non-finite budgets and zero timeouts', () => {
    const graph = builder.build(createBlogGraphInput());
    if (graph.nodes[0]) graph.nodes[0].timeoutMs = 0;
    if (graph.nodes[1]) graph.nodes[1].budget.expectedTokens = Number.NaN;
    const validation = validator.validate(graph);
    const budgetCheck = validation.checks.find((c) => c.check === 'budgets-finite');
    expect(budgetCheck?.passed).toBe(false);
  });

  it('flags nodes missing capabilities', () => {
    const graph = builder.build(createBlogGraphInput());
    if (graph.nodes[0]) {
      graph.nodes[0].capability = '' as never;
    }
    const validation = validator.validate(graph);
    const capCheck = validation.checks.find((c) => c.check === 'capabilities-present');
    expect(capCheck?.passed).toBe(false);
  });

  it('flags stages that do not cover every node', () => {
    const graph = builder.build(createBlogGraphInput());
    graph.stages = graph.stages.filter((s) => s.stageId !== 'stage_research');
    const validation = validator.validate(graph);
    const stageCheck = validation.checks.find((c) => c.check === 'stages-cover-nodes');
    expect(stageCheck?.passed).toBe(false);
  });

  it('flags an empty critical path', () => {
    const graph: ExecutionGraph = {
      ...builder.build(createBlogGraphInput()),
      criticalPath: [],
    };
    const validation = validator.validate(graph);
    const cpCheck = validation.checks.find((c) => c.check === 'critical-path-resolvable');
    expect(cpCheck?.passed).toBe(false);
  });
});
