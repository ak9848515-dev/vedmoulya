// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Application tests
// APP-001 — Post-V1 Application Platform Layer
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ContextFabricApplicationService } from '../ContextFabricApplicationService.js';
import {
  createCatalogFabricEntities,
  createCatalogFabricRelationships,
} from '../../catalog/fabric-catalog.js';
import { InMemoryGraphRepository } from '../../infrastructure/InMemoryGraphRepository.js';
import type { FabricEngines } from '../../contracts/fabric-engines.js';

async function makeService(engines?: Partial<FabricEngines>): Promise<{
  service: ContextFabricApplicationService;
  repo: InMemoryGraphRepository;
}> {
  const repo = new InMemoryGraphRepository();
  for (const entity of createCatalogFabricEntities()) {
    await repo.saveEntity(entity);
  }
  for (const relationship of createCatalogFabricRelationships()) {
    await repo.saveRelationship(relationship);
  }
  const service = new ContextFabricApplicationService(repo, {
    context: {
      searchContext: async () => ({
        success: true,
        data: { items: [], total: 0 },
      }),
    },
    memory: {
      retrieve: async () => ({ success: true, data: [] }),
    },
    knowledge: {
      search: async () => ({ success: true, data: [] }),
    },
    goals: {
      searchGoals: async () => ({ success: true, data: { items: [], total: 0 } }),
    },
    capabilities: {
      getMarketplace: async () =>
        ({
          success: true,
          data: {
            capabilities: [{ id: 'content_generation', name: 'Content Generation' }],
            total: 1,
          },
        }) as never,
    },
    ...engines,
  });
  return { service, repo };
}

describe('ContextFabricApplicationService', () => {
  it('returns the personal graph', async () => {
    const { service } = await makeService();
    const result = await service.getPersonalGraph('user_001');
    expect(result.success).toBe(true);
    expect(result.data?.entities.length).toBeGreaterThan(10);
    expect(result.data?.stats.countByType.goal).toBe(2);
  });

  it('returns the business graph', async () => {
    const { service } = await makeService();
    const result = await service.getBusinessGraph('org_vedmoulya');
    expect(result.success).toBe(true);
    expect(result.data?.entities.some((e) => e.type === 'organization')).toBe(true);
  });

  it('returns an entity with a permission evaluation', async () => {
    const { service } = await makeService();
    const result = await service.getEntity('user_001', 'personal:goal:goal_blog_seed');
    expect(result.success).toBe(true);
    expect(result.data?.permission.allowed).toBe(true);
    expect(result.data?.entity.label).toContain('blog');
  });

  it('fails cleanly for a missing entity', async () => {
    const { service } = await makeService();
    const result = await service.getEntity('user_001', 'missing:id');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns relationships for an entity', async () => {
    const { service } = await makeService();
    const result = await service.getRelationships('user_001', 'personal:goal:goal_blog_seed', 1);
    expect(result.success).toBe(true);
    expect(result.data?.relationships.length).toBeGreaterThan(0);
  });

  it('performs permission-gated hybrid search', async () => {
    const { service } = await makeService();
    const result = await service.search({
      userId: 'user_001',
      query: 'enterprise blog platform',
    });
    expect(result.success).toBe(true);
    expect(result.data?.entities.length).toBeGreaterThan(0);
    // Every returned entity is permission-allowed for the requester.
    expect(
      result.data?.entities.every(
        (e) => e.permissions.owner === 'user_001' || e.permissions.scope !== 'private',
      ),
    ).toBe(true);
    expect(result.data?.ranking[0].reasons.length).toBeGreaterThan(0);
  });

  it('builds a context package with capabilities and token estimate', async () => {
    const { service } = await makeService();
    const result = await service.buildContextPackage({
      userId: 'user_001',
      goalId: 'goal_blog_seed',
      query: 'publish enterprise insights',
    });
    expect(result.success).toBe(true);
    const pkg = result.data;
    expect(pkg?.items.length).toBeGreaterThan(0);
    expect(pkg?.estimatedTokens).toBeGreaterThan(0);
    expect(pkg?.goalId).toBe('goal_blog_seed');
    expect(pkg?.contextVersion).toContain('fabric-');
  });

  it('explains a context selection with permission reasons', async () => {
    const { service } = await makeService();
    const result = await service.explainContextSelection({
      userId: 'user_001',
      entityId: 'personal:goal:goal_blog_seed',
      goalId: 'goal_blog_seed',
    });
    expect(result.success).toBe(true);
    expect(result.data?.[0].selected).toBe(true);
    expect(result.data?.[0].reasons.some((r) => r.includes('permission'))).toBe(true);
  });

  it('returns provenance facts for an entity', async () => {
    const { service } = await makeService();
    const result = await service.getProvenance('user_001', 'personal:goal:goal_blog_seed');
    expect(result.success).toBe(true);
    expect(result.data?.provenance).toContain('goal');
    expect(result.data?.facts.some((fact) => fact.includes('access: granted'))).toBe(true);
  });

  it('evaluates permissions for an entity', async () => {
    const { service } = await makeService();
    const result = await service.getPermissions('user_001', 'personal:goal:goal_blog_seed');
    expect(result.success).toBe(true);
    expect(result.data?.permission.allowed).toBe(true);
    expect(result.data?.label).toContain('owner:user_001');
  });

  it('denies access to a foreign private entity', async () => {
    const { service, repo } = await makeService();
    const foreign = createCatalogFabricEntities()[0];
    await repo.saveEntity({
      ...foreign,
      entityId: 'personal:document:foreign',
      ownerId: 'user_other',
      permissions: {
        owner: 'user_other',
        scope: 'private',
        allowedUsers: [],
        allowedRoles: [],
        capability: [],
        grantedAt: new Date().toISOString(),
      },
    });
    const result = await service.getEntity('user_001', 'personal:document:foreign');
    expect(result.success).toBe(true);
    expect(result.data?.permission.allowed).toBe(false);
  });

  it('returns sources with counts', async () => {
    const { service } = await makeService();
    const result = await service.getSources();
    expect(result.success).toBe(true);
    expect(result.data?.length).toBeGreaterThan(3);
    expect(result.data?.every((entry) => entry.entityCount > 0)).toBe(true);
  });

  it('returns fabric health', async () => {
    const { service } = await makeService();
    const result = await service.getHealth();
    expect(result.success).toBe(true);
    expect(result.data?.entityCount).toBe(createCatalogFabricEntities().length);
    expect(result.data?.relationshipCount).toBe(createCatalogFabricRelationships().length);
    expect(result.data?.permissionCoverage).toBeGreaterThan(0.9);
  });

  it('handles a failing engine port gracefully', async () => {
    const { service } = await makeService({
      capabilities: {
        getMarketplace: async () => ({ success: false, error: 'engine down' }),
      },
    });
    const result = await service.buildContextPackage({
      userId: 'user_001',
      query: 'test',
    });
    expect(result.success).toBe(true);
    expect(result.data?.relevantCapabilities).toEqual([]);
  });
});
