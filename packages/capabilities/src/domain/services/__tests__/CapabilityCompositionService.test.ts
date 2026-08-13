import { describe, expect, it } from 'vitest';
import { Capability } from '../../entities/Capability.js';
import { CapabilityCompositionService } from '../CapabilityCompositionService.js';
import { createCapabilityId } from '../../value-objects/CapabilityId.js';

function makeCap(id: string, composition: Array<{ slot: string; id: string }> = []): Capability {
  return Capability.create({
    id: createCapabilityId(id),
    name: id,
    category: 'content',
    description: id,
    owner: 'test',
    composition: composition.map((c) => ({ slot: c.slot, id: createCapabilityId(c.id) })),
  });
}

describe('CapabilityCompositionService', () => {
  const service = new CapabilityCompositionService();

  it('validates a composition with all children present', () => {
    const all = [
      makeCap('research'),
      makeCap('writing'),
      makeCap('review'),
      makeCap('content_generation', [
        { slot: 'research', id: 'research' },
        { slot: 'writing', id: 'writing' },
        { slot: 'review', id: 'review' },
      ]),
    ];
    const check = service.validate(all[3], all);
    expect(check.valid).toBe(true);
    expect(check.missing).toHaveLength(0);
  });

  it('reports missing composition children', () => {
    const all = [makeCap('content_generation', [{ slot: 'research', id: 'ghost' }])];
    const check = service.validate(all[0], all);
    expect(check.valid).toBe(false);
    expect(check.missing).toContain('ghost');
  });

  it('reports self-references', () => {
    const all = [makeCap('self', [{ slot: 'self', id: 'self' }])];
    const check = service.validate(all[0], all);
    expect(check.valid).toBe(false);
    expect(check.selfReferences).toContain('self');
  });

  it('detects composition cycles', () => {
    const all = [makeCap('a', [{ slot: 'b', id: 'b' }]), makeCap('b', [{ slot: 'a', id: 'a' }])];
    const check = service.validate(all[0], all);
    expect(check.valid).toBe(false);
    expect(check.cycles.length).toBeGreaterThan(0);
  });

  it('builds a composition tree with leaf counts', () => {
    const all = [
      makeCap('research'),
      makeCap('writing'),
      makeCap('review'),
      makeCap('content_generation', [
        { slot: 'research', id: 'research' },
        { slot: 'writing', id: 'writing' },
        { slot: 'review', id: 'review' },
      ]),
    ];
    const tree = service.buildTree(all, createCapabilityId('content_generation'));
    expect(tree.isComposition).toBe(true);
    expect(tree.leafCount).toBe(3);
    expect(tree.children.map((c) => c.slot)).toEqual(['research', 'writing', 'review']);
  });

  it('builds a leaf node for unknown ids (resilient)', () => {
    const all: Capability[] = [];
    const tree = service.buildTree(all, createCapabilityId('missing'));
    expect(tree.isComposition).toBe(false);
    expect(tree.leafCount).toBe(1);
  });

  it('flattens a composition tree to ordered leaf ids', () => {
    const all = [
      makeCap('research'),
      makeCap('writing'),
      makeCap('review'),
      makeCap('content_generation', [
        { slot: 'research', id: 'research' },
        { slot: 'writing', id: 'writing' },
        { slot: 'review', id: 'review' },
      ]),
    ];
    const tree = service.buildTree(all, createCapabilityId('content_generation'));
    expect(service.flattenTree(tree)).toEqual(['research', 'writing', 'review']);
  });
});
