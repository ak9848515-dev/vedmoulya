// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Dependency Graph tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { OSDependencyGraphService } from '../services/OSDependencyGraphService.js';
import { OS_ENGINE_IDS } from '../../types/os-types.js';
import { OS_CONSUMPTION_MATRIX, OS_PACKAGE_DEPENDENCIES } from '../../catalog/os-catalog.js';

const service = new OSDependencyGraphService();

describe('OSDependencyGraphService.buildGraph', () => {
  it('registers every engine as a node', () => {
    const graph = service.buildGraph();
    expect(graph.nodes).toEqual([...OS_ENGINE_IDS]);
  });

  it('builds the package edges from the real package dependencies', () => {
    const graph = service.buildGraph();
    const edgeCount = Object.values(OS_PACKAGE_DEPENDENCIES).reduce(
      (sum, deps) => sum + deps.length,
      0,
    );
    expect(graph.packageEdges).toHaveLength(edgeCount);
    expect(graph.packageEdges.every((e) => e.kind === 'package')).toBe(true);
    expect(graph.packageEdges.every((e) => e.valid)).toBe(true);
  });

  it('builds the consultation edges from the integration matrix', () => {
    const graph = service.buildGraph();
    const edgeCount = Object.values(OS_CONSUMPTION_MATRIX).reduce(
      (sum, deps) => sum + deps.length,
      0,
    );
    expect(graph.consultationEdges).toHaveLength(edgeCount);
    expect(graph.consultationEdges.every((e) => e.kind === 'consultation')).toBe(true);
  });

  it('reports the consultation matrix', () => {
    const graph = service.buildGraph();
    expect(graph.matrix.goals).toEqual(OS_CONSUMPTION_MATRIX.goals);
    expect(graph.matrix.memory).toContain('knowledge');
  });

  it('declares the package graph acyclic (no circular dependencies)', () => {
    const graph = service.buildGraph();
    expect(graph.acyclic).toBe(true);
    expect(graph.packageCycles).toEqual([]);
  });

  it('reports consultation cycles as informational (integrated OS)', () => {
    const graph = service.buildGraph();
    expect(graph.consultationCycles.length).toBeGreaterThan(0);
  });
});

describe('cycle detection', () => {
  it('finds a direct two-node cycle', () => {
    const cycles = service.findCycles({ a: ['b'], b: ['a'] });
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]![0]).toBe('a');
    expect(cycles[0]![cycles[0]!.length - 1]).toBe('a');
  });

  it('finds a three-node cycle', () => {
    const cycles = service.findCycles({ a: ['b'], b: ['c'], c: ['a'], d: [] });
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('returns no cycles for a DAG', () => {
    const cycles = service.findCycles({ a: ['b', 'c'], b: ['d'], c: ['d'], d: [] });
    expect(cycles).toEqual([]);
  });

  it('handles self-loops', () => {
    const cycles = service.findCycles({ a: ['a'] });
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('returns no cycles for an empty or sparsely-keyed matrix', () => {
    expect(service.findCycles({})).toEqual([]);
    // `b` has no matrix entry — the traversal must not throw.
    expect(service.findCycles({ a: ['b'] })).toEqual([]);
  });
});
