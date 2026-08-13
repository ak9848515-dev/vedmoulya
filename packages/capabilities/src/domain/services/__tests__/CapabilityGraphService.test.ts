import { describe, expect, it } from 'vitest';
import { Capability } from '../../entities/Capability.js';
import { CapabilityGraphService } from '../CapabilityGraphService.js';
import { createCapabilityId } from '../../value-objects/CapabilityId.js';

function makeCap(id: string, dependencies: string[] = []): Capability {
  return Capability.create({
    id: createCapabilityId(id),
    name: id,
    category: 'platform',
    description: id,
    owner: 'test',
    dependencies: dependencies.map((d) => createCapabilityId(d)),
  });
}

describe('CapabilityGraphService', () => {
  it('builds a DAG with roots and depth', () => {
    const caps = [makeCap('a'), makeCap('b', ['a']), makeCap('c', ['b']), makeCap('d')];
    const graph = new CapabilityGraphService().buildGraph(caps);

    expect(graph.cycles).toHaveLength(0);
    expect(graph.dangling).toHaveLength(0);
    expect(graph.roots).toEqual(['a', 'd']);
    const nodeC = graph.nodes.find((n) => n.id === 'c');
    expect(nodeC?.depth).toBe(2);
  });

  it('computes the critical path (deepest chain)', () => {
    const caps = [makeCap('a'), makeCap('b', ['a']), makeCap('c', ['b']), makeCap('side', ['a'])];
    const graph = new CapabilityGraphService().buildGraph(caps);
    const critical = graph.nodes.filter((n) => n.critical).map((n) => n.id);
    expect(critical).toContain('c');
    expect(critical).toContain('b');
    expect(critical).toContain('a');
    expect(critical).not.toContain('side');
  });

  it('flags dangling dependencies referencing missing capabilities', () => {
    const caps = [makeCap('a', ['ghost'])];
    const graph = new CapabilityGraphService().buildGraph(caps);
    expect(graph.dangling).toContain('a');
  });

  it('detects cycles', () => {
    const caps = [makeCap('a', ['b']), makeCap('b', ['a'])];
    const result = new CapabilityGraphService().detectCycles(caps);
    expect(result.hasCycle).toBe(true);
    expect(result.cycles.length).toBeGreaterThan(0);
  });

  it('reports no cycles for a clean DAG', () => {
    const caps = [makeCap('a'), makeCap('b', ['a']), makeCap('c', ['b'])];
    const result = new CapabilityGraphService().detectCycles(caps);
    expect(result.hasCycle).toBe(false);
  });

  it('resolves transitive dependencies excluding the capability itself', () => {
    const caps = [makeCap('a'), makeCap('b', ['a']), makeCap('c', ['b']), makeCap('unrelated')];
    const service = new CapabilityGraphService();
    const transitive = service.getTransitiveDependencies(caps, createCapabilityId('c'));
    expect(transitive.sort()).toEqual(['a', 'b']);
    expect(transitive).not.toContain('c');
    expect(transitive).not.toContain('unrelated');
  });
});
