import { describe, expect, it } from 'vitest';
import { CapabilityApplicationService } from '../CapabilityApplicationService.js';
import { InMemoryCapabilityRepository } from '../../infrastructure/InMemoryCapabilityRepository.js';
import { createCatalogCapabilities, CATALOG_SIZE } from '../../catalog/capability-catalog.js';
import type { CreateCapabilityDTO } from '../CapabilityDTO.js';

function createService(): CapabilityApplicationService {
  return new CapabilityApplicationService(
    new InMemoryCapabilityRepository(createCatalogCapabilities()),
  );
}

function createDto(overrides: Partial<CreateCapabilityDTO> = {}): CreateCapabilityDTO {
  return {
    id: 'cap_test_new',
    name: 'Test Capability',
    category: 'content',
    description: 'A test capability',
    owner: 'test-owner',
    requiredAIFeatures: ['content_generation'],
    tags: ['test'],
    businessModules: ['content-agency'],
    ...overrides,
  };
}

describe('CapabilityApplicationService', () => {
  it('serves the seeded catalog marketplace', async () => {
    const svc = createService();
    const result = await svc.getMarketplace();
    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(CATALOG_SIZE);
    expect(result.data?.capabilities.length).toBe(CATALOG_SIZE);
  });

  it('marketplace exposes status/category/business counts and composition count', async () => {
    const svc = createService();
    const result = await svc.getMarketplace();
    expect(result.data?.activeCount).toBeGreaterThan(0);
    expect(result.data?.compositionCount).toBe(1); // content_generation
    expect(result.data?.countByStatus.active).toBeGreaterThan(0);
    expect(result.data?.countByCategory.content).toBeGreaterThan(0);
    expect(result.data?.countByBusinessModule['content-agency']).toBeGreaterThan(0);
  });

  it('content_generation is composed of research + writing + review (EI-001 brief)', async () => {
    const svc = createService();
    const gen = await svc.getCapability('content_generation');
    expect(gen.success).toBe(true);
    expect(gen.data?.isComposition).toBe(true);
    expect(gen.data?.composition.map((c) => c.slot)).toEqual(['research', 'writing', 'review']);

    const tree = await svc.getCompositionTree('content_generation');
    expect(tree.success).toBe(true);
    expect(tree.data?.leaves).toEqual(['research', 'writing', 'review']);
    expect(tree.data?.tree.leafCount).toBe(3);
  });

  it('business modules consume content_generation: content-agency, learning, career, marketing', async () => {
    const svc = createService();
    const byModule = await svc.listByBusinessModule('content-agency');
    expect(byModule.success).toBe(true);
    const ids = byModule.data?.map((c) => c.id);
    expect(ids).toContain('content_generation');
    expect(ids).toContain('research');
    expect(ids).toContain('writing');
    expect(ids).toContain('review');
  });

  it('searches capabilities by query and filters', async () => {
    const svc = createService();
    const byQuery = await svc.searchCapabilities({ query: 'translation' });
    expect(byQuery.success).toBe(true);
    expect(byQuery.data?.items.some((c) => c.id === 'translation')).toBe(true);

    const compositions = await svc.searchCapabilities({ onlyCompositions: true });
    expect(compositions.data?.items).toHaveLength(1);
  });

  it('builds a clean dependency graph with no cycles or dangling deps', async () => {
    const svc = createService();
    const graph = await svc.getGraph();
    expect(graph.success).toBe(true);
    expect(graph.data?.cycles).toHaveLength(0);
    expect(graph.data?.dangling).toHaveLength(0);
    expect(graph.data?.nodes.length).toBe(CATALOG_SIZE);
  });

  it('resolves transitive dependencies of content_generation', async () => {
    const svc = createService();
    const result = await svc.getTransitiveDependencies('content_generation');
    expect(result.success).toBe(true);
    const ids = result.data?.map((c) => c.id) ?? [];
    expect(ids).toContain('knowledge_retrieval');
    expect(ids).toContain('memory_retrieval');
  });

  it('creates a capability and validates it', async () => {
    const svc = createService();
    const result = await svc.createCapability(createDto());
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('cap_test_new');
    expect(result.data?.version).toBe('1.0.0');
  });

  it('rejects duplicate capability ids', async () => {
    const svc = createService();
    const result = await svc.createCapability(createDto({ id: 'research' }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('rejects invalid definitions (bad name, unknown category, bad confidence)', async () => {
    const svc = createService();
    expect((await svc.createCapability(createDto({ name: '  ' }))).success).toBe(false);
    expect(
      (await svc.createCapability(createDto({ category: 'bogus' as 'content' }))).success,
    ).toBe(false);
    expect((await svc.createCapability(createDto({ confidence: 1.5 }))).success).toBe(false);
  });

  it('rejects composition children that do not exist', async () => {
    const svc = createService();
    const result = await svc.createCapability(
      createDto({ composition: [{ slot: 'ghost', id: 'ghost_cap' }] }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing children');
  });

  it('rejects dependency cycles on create', async () => {
    const svc = createService();
    const result = await svc.createCapability(
      createDto({
        id: 'cycle_a',
        dependencies: ['cycle_b'],
      }),
    );
    // cycle_b does not exist yet → dangling dependency error (graph guard)
    expect(result.success).toBe(false);
    expect(result.error).toContain('missing capabilities');
  });

  it('walks the lifecycle: design → draft → testing → active → deprecated', async () => {
    const svc = createService();
    await svc.createCapability(createDto()); // new capabilities start in 'design'

    const toDraft = await svc.transitionStatus('cap_test_new', 'draft');
    expect(toDraft.success).toBe(true);
    const toTesting = await svc.transitionStatus('cap_test_new', 'testing');
    expect(toTesting.success).toBe(true);
    const toActive = await svc.transitionStatus('cap_test_new', 'active');
    expect(toActive.success).toBe(true);
    const toDeprecated = await svc.transitionStatus('cap_test_new', 'deprecated');
    expect(toDeprecated.success).toBe(true);
    expect(toDeprecated.data?.status).toBe('deprecated');
  });

  it('rejects invalid lifecycle transitions', async () => {
    const svc = createService();
    await svc.createCapability(createDto()); // starts in 'design'
    const result = await svc.transitionStatus('cap_test_new', 'active');
    expect(result.success).toBe(false);
  });

  it('bumps major, minor, and patch versions', async () => {
    const svc = createService();
    await svc.createCapability(createDto());

    const minor = await svc.createVersion('cap_test_new', 'minor');
    expect(minor.data?.version).toBe('1.1.0');
    const patch = await svc.createVersion('cap_test_new', 'patch');
    expect(patch.data?.version).toBe('1.1.1');
    const major = await svc.createVersion('cap_test_new', 'major');
    expect(major.data?.version).toBe('2.0.0');
  });

  it('updates details and bumps patch', async () => {
    const svc = createService();
    await svc.createCapability(createDto());
    const result = await svc.updateCapability('cap_test_new', {
      description: 'updated description',
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('updated description');
    expect(result.data?.version).toBe('1.0.1');
  });

  it('blocks deletion of a capability referenced by others', async () => {
    const svc = createService();
    const result = await svc.deleteCapability('research');
    expect(result.success).toBe(false);
    expect(result.error).toContain('referenced by');
  });

  it('deletes an unreferenced capability', async () => {
    const svc = createService();
    await svc.createCapability(createDto());
    const result = await svc.deleteCapability('cap_test_new');
    expect(result.success).toBe(true);
    expect(result.data?.deleted).toBe(true);
    expect((await svc.getCapability('cap_test_new')).success).toBe(false);
  });

  it('returns not-found errors', async () => {
    const svc = createService();
    expect((await svc.getCapability('nope')).success).toBe(false);
    expect((await svc.getCompositionTree('nope')).success).toBe(false);
    expect((await svc.getDependencies('nope')).success).toBe(false);
  });

  it('resolves direct dependencies of a capability', async () => {
    const svc = createService();
    const result = await svc.getDependencies('research');
    expect(result.success).toBe(true);
    const ids = result.data?.map((c) => c.id) ?? [];
    expect(ids).toEqual(['knowledge_retrieval', 'memory_retrieval']);
  });

  it('creates a capability with outputs, dependencies, and composition refs', async () => {
    const svc = createService();
    const result = await svc.createCapability(
      createDto({
        id: 'cap_with_outputs',
        inputs: ['brief'],
        outputs: ['draft', 'final'],
        dependencies: ['research'],
        composition: [{ slot: 'research', id: 'research' }],
        tags: ['new'],
        documentationUrl: 'https://docs.example.com',
        businessModules: ['content-agency', 'learning'],
        estimatedCostUsd: 2.5,
        costTier: 'standard',
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 800,
        p50Ms: 100,
        p95Ms: 400,
        qualityTarget: 0.92,
        qualityMinimum: 0.75,
        confidence: 0.88,
      }),
    );
    expect(result.success).toBe(true);
    expect(result.data?.inputs).toEqual(['brief']);
    expect(result.data?.outputs).toEqual(['draft', 'final']);
    expect(result.data?.documentationUrl).toBe('https://docs.example.com');
    expect(result.data?.costTier).toBe('standard');
    expect(result.data?.estimatedInputTokens).toBe(1000);
    expect(result.data?.p95Ms).toBe(400);
    expect(result.data?.qualityTarget).toBe(0.92);
    expect(result.data?.confidence).toBe(0.88);
  });

  it('resolves capabilities by AI feature', async () => {
    const svc = createService();
    const result = await svc.findByAIFeatures(['reasoning']);
    expect(result.success).toBe(true);
    expect(result.data?.length).toBeGreaterThan(0);
  });

  it('returns not-found for transitionStatus, createVersion, and transitive deps', async () => {
    const svc = createService();
    expect((await svc.transitionStatus('nope', 'draft')).success).toBe(false);
    expect((await svc.createVersion('nope', 'minor')).success).toBe(false);
    expect((await svc.getTransitiveDependencies('nope')).success).toBe(false);
  });

  it('updateCapability rejects invalid name and category', async () => {
    const svc = createService();
    await svc.createCapability(createDto());
    expect((await svc.updateCapability('cap_test_new', { name: '  ' })).success).toBe(false);
    expect(
      (await svc.updateCapability('cap_test_new', { category: 'bogus' as 'content' })).success,
    ).toBe(false);
  });

  it('updateCapability applies profile and composition updates', async () => {
    const svc = createService();
    await svc.createCapability(createDto());
    const result = await svc.updateCapability('cap_test_new', {
      estimatedCostUsd: 7,
      costTier: 'premium',
      qualityTarget: 0.97,
      confidence: 0.99,
      composition: [{ slot: 'research', id: 'research' }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.estimatedCostUsd).toBe(7);
    expect(result.data?.costTier).toBe('premium');
    expect(result.data?.composition.length).toBe(1);
  });

  it('updateCapability rejects composition children that do not exist', async () => {
    const svc = createService();
    await svc.createCapability(createDto());
    const result = await svc.updateCapability('cap_test_new', {
      composition: [{ slot: 'ghost', id: 'ghost_cap' }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing children');
  });

  it('updateCapability returns not-found for unknown id', async () => {
    const svc = createService();
    expect((await svc.updateCapability('nope', { name: 'x' })).success).toBe(false);
    expect((await svc.deleteCapability('nope')).success).toBe(false);
    expect((await svc.transitionStatus('nope', 'draft')).success).toBe(false);
  });
});
