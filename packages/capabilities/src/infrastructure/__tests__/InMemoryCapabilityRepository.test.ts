import { describe, expect, it } from 'vitest';
import { Capability } from '../../domain/entities/Capability.js';
import { CapabilityStatus } from '../../domain/value-objects/CapabilityStatus.js';
import { createCapabilityId } from '../../domain/value-objects/CapabilityId.js';
import { InMemoryCapabilityRepository } from '../InMemoryCapabilityRepository.js';

interface MakeCapOverrides {
  category?: Capability['category'];
  status?: Capability['status']['value'];
  description?: string;
  tags?: string[];
  businessModules?: Capability['businessModules'][number][];
  dependencies?: string[];
  composition?: Array<{ id: string; slot: string }>;
  requiredAIFeatures?: Capability['requiredAIFeatures'][number][];
}

function makeCap(id: string, overrides: MakeCapOverrides = {}): Capability {
  return Capability.create({
    id: createCapabilityId(id),
    name: id,
    category: overrides.category ?? 'content',
    description: overrides.description ?? `${id} description`,
    owner: 'test',
    tags: overrides.tags ?? [id],
    businessModules: overrides.businessModules ?? ['content-agency'],
    status: CapabilityStatus.fromStatus(overrides.status ?? 'active'),
    dependencies: (overrides.dependencies ?? []).map((d) => createCapabilityId(d)),
    requiredAIFeatures: overrides.requiredAIFeatures ?? ['reasoning'],
    composition: (overrides.composition ?? []).map((c) => ({
      id: createCapabilityId(c.id),
      slot: c.slot,
    })),
  });
}

describe('InMemoryCapabilityRepository', () => {
  it('saves and finds by id', async () => {
    const repo = new InMemoryCapabilityRepository();
    const cap = makeCap('writing');
    await repo.save(cap);
    expect(await repo.findById(createCapabilityId('writing'))).toBe(cap);
    expect(await repo.findById(createCapabilityId('missing'))).toBeNull();
  });

  it('seeds from a list', async () => {
    const repo = new InMemoryCapabilityRepository([makeCap('a'), makeCap('b')]);
    expect(await repo.count()).toBe(2);
  });

  it('updates and deletes', async () => {
    const repo = new InMemoryCapabilityRepository();
    const cap = makeCap('a');
    await repo.save(cap);
    cap.updateDetails({ description: 'updated' });
    await repo.update(cap);
    expect((await repo.findById(createCapabilityId('a')))?.description).toBe('updated');

    await repo.delete(createCapabilityId('a'));
    expect(await repo.exists(createCapabilityId('a'))).toBe(false);
  });

  it('finds by category, status, tag, and business module', async () => {
    const repo = new InMemoryCapabilityRepository([
      makeCap('writing', { category: 'writing', status: 'active' }),
      makeCap('research', {
        category: 'research',
        status: 'design',
        businessModules: ['learning'],
      }),
    ]);
    expect((await repo.findByCategory('writing', { page: 1, limit: 10 })).total).toBe(1);
    expect((await repo.findByStatus('active', { page: 1, limit: 10 })).total).toBe(1);
    expect((await repo.findByTag('research', { page: 1, limit: 10 })).total).toBe(1);
    expect((await repo.findByBusinessModule('learning', { page: 1, limit: 10 })).total).toBe(1);
  });

  it('paginates results', async () => {
    const repo = new InMemoryCapabilityRepository([
      makeCap('a'),
      makeCap('b'),
      makeCap('c'),
      makeCap('d'),
    ]);
    const page1 = await repo.search({}, { page: 1, limit: 2 });
    const page2 = await repo.search({}, { page: 2, limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(4);
    expect(page1.totalPages).toBe(2);
    expect(page2.data).toHaveLength(2);
  });

  it('searches by query across name, description, and tags', async () => {
    const repo = new InMemoryCapabilityRepository([
      makeCap('content_generation', { description: 'on-brand content production' }),
      makeCap('research', { tags: ['grounding'] }),
      makeCap('other'),
    ]);
    const byDesc = await repo.search({ query: 'on-brand' }, { page: 1, limit: 10 });
    const byTag = await repo.search({ query: 'grounding' }, { page: 1, limit: 10 });
    const byName = await repo.search({ query: 'content_generation' }, { page: 1, limit: 10 });
    expect(byDesc.total).toBe(1);
    expect(byTag.total).toBe(1);
    expect(byName.total).toBe(1);
  });

  it('filters by category, status, business module, tag, dependsOn, compositions', async () => {
    const repo = new InMemoryCapabilityRepository([
      makeCap('research', { category: 'research' }),
      makeCap('writing', { category: 'writing', dependencies: ['research'] }),
      makeCap('gen', {
        category: 'content',
        composition: [{ id: 'writing', slot: 'writing' }],
        businessModules: ['content-agency', 'marketing'],
      }),
    ]);
    expect((await repo.search({ categories: ['research'] }, { page: 1, limit: 10 })).total).toBe(1);
    expect((await repo.search({ statuses: ['design'] }, { page: 1, limit: 10 })).total).toBe(0);
    expect(
      (await repo.search({ businessModules: ['marketing'] }, { page: 1, limit: 10 })).total,
    ).toBe(1);
    expect((await repo.search({ dependsOn: 'research' }, { page: 1, limit: 10 })).total).toBe(1);
    expect((await repo.search({ onlyCompositions: true }, { page: 1, limit: 10 })).total).toBe(1);
  });

  it('finds dependents of a capability', async () => {
    const repo = new InMemoryCapabilityRepository([
      makeCap('research'),
      makeCap('writing', { dependencies: ['research'] }),
    ]);
    const dependents = await repo.findByDependency(createCapabilityId('research'));
    expect(dependents.map((c) => c.id)).toEqual(['writing']);
  });

  it('finds by AI features', async () => {
    const repo = new InMemoryCapabilityRepository([makeCap('a'), makeCap('b')]);
    const result = await repo.findByAIFeatures(['reasoning']);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.requiredAIFeatures.includes('reasoning'))).toBe(true);
  });

  it('finds by composition parent', async () => {
    const repo = new InMemoryCapabilityRepository([
      makeCap('child', { composition: [{ id: 'parent', slot: 'main' }] }),
      makeCap('other'),
    ]);
    const result = await repo.findByCompositionParent(createCapabilityId('parent'));
    expect(result.map((c) => c.id)).toEqual([createCapabilityId('child')]);
  });

  it('filters search by tags and dependsOn', async () => {
    const repo = new InMemoryCapabilityRepository([
      makeCap('a', { tags: ['core'], dependencies: ['b'] }),
      makeCap('b', { tags: ['other'] }),
    ]);
    const byTag = await repo.search({ tags: ['core'] }, { page: 1, limit: 50 });
    expect(byTag.data.map((c) => c.id)).toContain(createCapabilityId('a'));
    const byDep = await repo.search({ dependsOn: 'b' }, { page: 1, limit: 50 });
    expect(byDep.data.map((c) => c.id)).toContain(createCapabilityId('a'));
  });

  it('counts by status, category, and business module', async () => {
    const repo = new InMemoryCapabilityRepository([
      makeCap('a', { status: 'active', category: 'content', businessModules: ['content-agency'] }),
      makeCap('b', { status: 'design', category: 'research', businessModules: ['learning'] }),
    ]);
    const byStatus = await repo.countByStatus();
    expect(byStatus.active).toBe(1);
    expect(byStatus.design).toBe(1);
    expect(byStatus.archived).toBe(0);
    const byCategory = await repo.countByCategory();
    expect(byCategory.content).toBe(1);
    const byModule = await repo.countByBusinessModule();
    expect(byModule['content-agency']).toBe(1);
    expect(byModule.learning).toBe(1);
  });
});
